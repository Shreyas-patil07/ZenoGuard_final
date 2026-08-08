from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Claim, Policy, Payout
from ..routers.auth import get_current_user
from ..schemas import ClaimCreate
from ..services.claim_verification import verify_claim
from ..services.razorpay_service import RazorpayConfigError, create_vpa_payout
from ..services.risk_engine import get_payout_amount

router = APIRouter(prefix="/claims", tags=["claims"])

SUPPORTED_EVENTS = {"accident", "breakdown", "weather"}


def get_active_policy(db: Session, rider_id: int) -> Policy | None:
    now = datetime.utcnow()
    return (
        db.query(Policy)
        .filter(
            Policy.rider_id == rider_id,
            Policy.active.is_(True),
            Policy.locked.is_(True),
            Policy.start_date <= now,
            Policy.end_date >= now,
        )
        .order_by(Policy.id.desc())
        .first()
    )


def has_duplicate_claim(db: Session, policy_id: int, event_type: str) -> bool:
    return (
        db.query(Claim)
        .filter(
            Claim.policy_id == policy_id,
            Claim.event_type == event_type,
            Claim.verification_status.in_(["pending", "VALID", "REVIEW", "PAID"]),
        )
        .first()
        is not None
    )


def claim_dict(claim: Claim) -> dict:
    return {
        "id": claim.id,
        "policy_id": claim.policy_id,
        "event_type": claim.event_type,
        "timestamp": claim.timestamp.isoformat(),
        "location": claim.location,
        "verification_status": claim.verification_status,
        "evidence": claim.screenshot_url,
        "potential_benefit": get_payout_amount(claim.event_type, claim.policy.tier),
        "payout": {
            "id": claim.payout.id,
            "amount": claim.payout.amount,
            "status": claim.payout.status,
            "tx_id": claim.payout.tx_hash,
        } if claim.payout else None,
        "payout_tx_hash": claim.payout.tx_hash if claim.payout else None,
    }


def _trigger_auto_payout(db: Session, claim: Claim, current_user) -> None:
    if claim.verification_status != "VALID":
        return
    if not current_user.razorpay_fund_account_id:
        return
    if claim.payout and claim.payout.status in {"PROCESSING", "SUCCESS", "COMPLETED"}:
        return

    amount = float(get_payout_amount(claim.event_type, claim.policy.tier))
    payout_record = claim.payout or Payout(claim_id=claim.id, amount=amount, status="PENDING")
    if payout_record not in db:
        db.add(payout_record)
        db.flush()

    try:
        result = create_vpa_payout(
            fund_account_id=current_user.razorpay_fund_account_id,
            amount_inr=amount,
            reference_id=f"CLM-{claim.id}",
        )
        payout_record.tx_hash = result.get("id")
        payout_record.status = result.get("status", "PROCESSING").upper()
        claim.payout_tx_hash = result.get("id")
        db.commit()
    except RazorpayConfigError:
        payout_record.status = "PENDING"
        db.commit()
    except Exception as exc:
        payout_record.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Claim verified, but automatic Razorpay payout failed: {exc}")


@router.post("/submit", status_code=status.HTTP_201_CREATED)
def submit_claim(
    payload: ClaimCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    event_type = (payload.event_type or "").strip().lower()
    if event_type not in SUPPORTED_EVENTS:
        raise HTTPException(
            status_code=422,
            detail="event_type must be one of: accident, breakdown, weather",
        )

    policy = get_active_policy(db, current_user.id)
    if not policy:
        raise HTTPException(
            status_code=409,
            detail="No active policy. Purchase and activate a policy before submitting a claim.",
        )

    if has_duplicate_claim(db, policy.id, event_type):
        raise HTTPException(
            status_code=409,
            detail="A claim for this event type is already open or paid for this policy.",
        )

    claim = Claim(
        policy_id=policy.id,
        event_type=event_type,
        location=(payload.location or "").strip(),
        screenshot_url=(payload.screenshot_url or "").strip(),
        timestamp=datetime.utcnow(),
        verification_status="REVIEW",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    verification = verify_claim(claim, policy)
    claim.verification_status = verification["status"]
    db.commit()
    db.refresh(claim)

    if claim.verification_status == "VALID":
        _trigger_auto_payout(db, claim, current_user)
        db.refresh(claim)

    response = claim_dict(claim)
    response.update({
        "message": "Claim submitted and verification completed.",
        "verification": verification,
        "auto_payout": bool(claim.payout and claim.payout.status != "PENDING"),
    })
    return response


@router.get("")
def list_claims(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    claims = (
        db.query(Claim)
        .join(Policy)
        .filter(Policy.rider_id == current_user.id)
        .order_by(Claim.timestamp.desc())
        .all()
    )
    return [claim_dict(claim) for claim in claims]


@router.get("/{claim_id}")
def get_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    claim = (
        db.query(Claim)
        .join(Policy)
        .filter(Claim.id == claim_id, Policy.rider_id == current_user.id)
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim_dict(claim)
