from datetime import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Claim, Policy
from ..routers.auth import get_current_user
from ..routers.contract import create_payout_for_claim
from ..schemas import ClaimCreate

router = APIRouter(prefix="/claims", tags=["claims"])


def get_or_create_policy(db: Session, current_user) -> Policy:
    policy = (
        db.query(Policy)
        .filter(Policy.rider_id == current_user.id)
        .order_by(Policy.id.desc())
        .first()
    )

    if policy:
        return policy

    default_policy = Policy(rider_id=current_user.id, premium=18.0, risk_score=4.5, active=True)
    db.add(default_policy)
    db.commit()
    db.refresh(default_policy)
    return default_policy


def determine_verification_status(event_type: str, timestamp: datetime) -> str:
    """
    Both 'accident' and 'weather' claims are auto-verified so the user
    receives their payout and the record is stored with status 'verified'.
    """
    event_type_key = (event_type or "").strip().lower()
    if event_type_key in {"accident", "weather"}:
        return "verified"
    return "verified"  # default: verify all claim types


@router.post("/submit", status_code=status.HTTP_201_CREATED)
def submit_claim(
    payload: ClaimCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    policy = get_or_create_policy(db, current_user)

    claim_timestamp = datetime.utcnow()
    verification_status = determine_verification_status(payload.event_type, claim_timestamp)

    claim = Claim(
        policy_id=policy.id,
        event_type=payload.event_type,
        location=payload.location,
        screenshot_url=payload.screenshot_url or "",
        timestamp=claim_timestamp,
        verification_status=verification_status,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    if claim.verification_status == "verified":
        payout = create_payout_for_claim(db, claim, current_user)
    else:
        payout = None

    return {
        "message": "Claim submitted successfully",
        "claim_id": claim.id,
        "verification_status": claim.verification_status,
        "event_type": claim.event_type,
        "location": claim.location,
        "payout_amount": payout.amount if payout else None,
        "payout_tx_hash": payout.tx_hash if payout else None,
    }
