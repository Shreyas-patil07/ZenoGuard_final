import os
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Claim, Payout
from ..routers.auth import get_current_user

router = APIRouter(prefix="/contract", tags=["contract"])


def create_payout_for_claim(db: Session, claim: Claim, current_user) -> Payout:
    """
    Option 3 — Internal wallet payout.
    Payout amount is based on the rider's coverage tier and event type.
    Per spec Section 5 — [Prototype Assumption].
    """
    from ..routers.wallet import credit_wallet
    from ..services.risk_engine import get_payout_amount

    # Get tier from the policy linked to this claim
    tier = "standard"
    if claim.policy:
        tier = claim.policy.tier or "standard"

    payout_amount = get_payout_amount(claim.event_type, tier)

    txn = credit_wallet(
        db=db,
        rider=current_user,
        amount=payout_amount,
        description=(
            f"Claim #{claim.id} payout — {claim.event_type.title()} at {claim.location} "
            f"({tier.title()} tier) [Prototype]"
        ),
        reference_id=str(claim.id),
    )

    payout = Payout(
        claim_id=claim.id,
        amount=payout_amount,
        tx_hash=f"internal_wallet_txn_{txn.id}",
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout


@router.post("/payout", status_code=status.HTTP_201_CREATED)
def trigger_payout(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.verification_status != "verified":
        raise HTTPException(status_code=400, detail="Claim is not verified")
    if claim.policy and claim.policy.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to payout this claim")

    try:
        payout = create_payout_for_claim(db, claim, current_user)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Payout failed: {str(exc)}") from exc

    return {
        "message": "Payout credited to your ZenoGuard wallet.",
        "claim_id": claim.id,
        "amount": payout.amount,
        "new_balance": current_user.wallet_balance,
        "payout_id": payout.id,
    }
