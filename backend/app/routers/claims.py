from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Claim, Policy
from ..routers.auth import get_current_user
from ..routers.contract import create_payout_for_claim
from ..schemas import ClaimCreate
from ..services.risk_engine import get_payout_amount

router = APIRouter(prefix="/claims", tags=["claims"])

ACTIVE_STATUSES = {"active"}
SUPPORTED_EVENTS = {"accident", "breakdown", "weather"}


def get_active_policy(db: Session, rider_id: int) -> Policy | None:
    now = datetime.utcnow()
    policy = (
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
    return policy


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


def determine_verification_status(event_type: str) -> str:
    # Claim verification is intentionally conservative until the complete
    # evidence + ML + external-event verification pipeline is connected.
    if event_type not in SUPPORTED_EVENTS:
        return "REJECTED"
    return "REVIEW"


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

    claim_timestamp = datetime.utcnow()
    verification_status = determine_verification_status(event_type)

    claim = Claim(
        policy_id=policy.id,
        event_type=event_type,
        location=payload.location,
        screenshot_url=payload.screenshot_url or "",
        timestamp=claim_timestamp,
        verification_status=verification_status,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    return {
        "message": "Claim submitted for verification",
        "claim_id": claim.id,
        "policy_id": policy.id,
        "verification_status": verification_status,
        "event_type": event_type,
        "location": claim.location,
        "potential_benefit": get_payout_amount(event_type, policy.tier),
        "payout_tx_hash": None,
    }


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
    return [
        {
            "id": claim.id,
            "policy_id": claim.policy_id,
            "event_type": claim.event_type,
            "timestamp": claim.timestamp.isoformat(),
            "location": claim.location,
            "verification_status": claim.verification_status,
            "evidence": claim.screenshot_url,
            "potential_benefit": get_payout_amount(claim.event_type, claim.policy.tier),
            "payout_tx_hash": claim.payout.tx_hash if claim.payout else None,
        }
        for claim in claims
    ]


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

    return {
        "id": claim.id,
        "policy_id": claim.policy_id,
        "event_type": claim.event_type,
        "timestamp": claim.timestamp.isoformat(),
        "location": claim.location,
        "verification_status": claim.verification_status,
        "evidence": claim.screenshot_url,
        "potential_benefit": get_payout_amount(claim.event_type, claim.policy.tier),
        "payout_tx_hash": claim.payout.tx_hash if claim.payout else None,
    }
