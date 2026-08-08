import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EarningsLog, Policy
from ..routers.auth import get_current_user
from ..services.risk_engine import calculate_premium_from_earnings, COVERAGE_TIERS, DURATION_FACTORS

router = APIRouter(prefix="/premium", tags=["premium"])


class PremiumRequest(BaseModel):
    tier: Optional[str] = "standard"
    duration_days: Optional[int] = 30


def get_active_locked_policy(db: Session, rider_id: int) -> Optional[Policy]:
    now = datetime.datetime.utcnow()
    return (
        db.query(Policy)
        .filter(Policy.rider_id == rider_id, Policy.locked == True, Policy.active == True, Policy.end_date >= now)
        .order_by(Policy.id.desc())
        .first()
    )


def get_pending_policy(db: Session, rider_id: int) -> Optional[Policy]:
    return (
        db.query(Policy)
        .filter(Policy.rider_id == rider_id, Policy.blockchain_status == "PENDING")
        .order_by(Policy.id.desc())
        .first()
    )


def _policy_dict(p: Policy) -> dict:
    tier_info = COVERAGE_TIERS.get(p.tier or "standard", COVERAGE_TIERS["standard"])
    days_remaining = max(0, (p.end_date - datetime.datetime.utcnow()).days) if p.end_date else None
    return {
        "policy_id": p.id,
        "tier": p.tier,
        "tier_label": tier_info["label"],
        "duration_days": p.duration_days,
        "premium": p.premium,
        "total_premium": round(p.premium * p.duration_days, 2),
        "risk_score": p.risk_score,
        "active": p.active,
        "locked": p.locked,
        "blockchain_policy_id": p.blockchain_policy_id,
        "purchase_tx_hash": p.purchase_tx_hash,
        "blockchain_status": p.blockchain_status,
        "start_date": p.start_date.isoformat() if p.start_date else None,
        "end_date": p.end_date.isoformat() if p.end_date else None,
        "days_remaining": days_remaining,
        "coverage": {"accident": tier_info["accident"], "breakdown": tier_info["breakdown"], "weather": tier_info["weather"]},
    }


@router.get("/tiers")
def get_tiers():
    return {
        "tiers": {key: {"label": val["label"], "accident": val["accident"], "breakdown": val["breakdown"], "weather": val["weather"], "base_premium": val["base_premium"]} for key, val in COVERAGE_TIERS.items()},
        "durations": list(DURATION_FACTORS.keys()),
        "note": "[Prototype Assumption] — not IRDAI-approved rates",
    }


@router.get("/active-policy")
def get_active_policy(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    policy = get_active_locked_policy(db, current_user.id)
    pending = get_pending_policy(db, current_user.id) if not policy else None
    return {"has_active_policy": bool(policy), "policy": _policy_dict(policy) if policy else None, "pending_policy": _policy_dict(pending) if pending else None}


@router.get("/calculate")
def calculate_premium(tier: str = "standard", duration_days: int = 30, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tier = tier.lower()
    if tier not in COVERAGE_TIERS or duration_days not in DURATION_FACTORS:
        raise HTTPException(status_code=400, detail="Tier must be basic, standard, or plus; duration must be 7, 30, or 90 days")
    earnings = db.query(EarningsLog).filter(EarningsLog.rider_id == current_user.id).order_by(EarningsLog.date.desc()).first()
    if not earnings:
        earnings = EarningsLog(rider_id=current_user.id, income=0.0, hours_worked=8.0)
        prefix = "Default rate (no earnings logged yet) — "
    else:
        prefix = ""
    daily_premium, risk_score, explanation, tier_info, ml_premium = calculate_premium_from_earnings(earnings, tier=tier, duration_days=duration_days)
    return {
        "premium": daily_premium,
        "total_premium": round(daily_premium * duration_days, 2),
        "duration_days": duration_days,
        "tier": tier,
        "tier_label": tier_info["label"],
        "risk_score": risk_score,
        "ml_premium_signal": ml_premium,
        "explanation": prefix + explanation,
        "coverage": {"accident": tier_info["accident"], "breakdown": tier_info["breakdown"], "weather": tier_info["weather"]},
        "earnings_used": earnings.income,
        "note": "[Prototype Assumption] — not IRDAI-approved rates",
    }


@router.post("/activate")
def activate_policy(payload: PremiumRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    existing = get_active_locked_policy(db, current_user.id)
    if existing:
        return {"message": "You already have an active policy.", "policy": _policy_dict(existing)}

    pending = get_pending_policy(db, current_user.id)
    if pending:
        return {"message": "A premium payment is already pending.", "policy": _policy_dict(pending), "next_step": f"POST /payments/premium/order with policy_id={pending.id}"}

    tier = (payload.tier or "standard").lower()
    duration = payload.duration_days or 30
    if tier not in COVERAGE_TIERS or duration not in DURATION_FACTORS:
        raise HTTPException(status_code=400, detail="Tier must be basic, standard, or plus; duration must be 7, 30, or 90 days")

    earnings = db.query(EarningsLog).filter(EarningsLog.rider_id == current_user.id).order_by(EarningsLog.date.desc()).first()
    if not earnings:
        earnings = EarningsLog(rider_id=current_user.id, income=0.0, hours_worked=8.0)

    daily_premium, risk_score, _, _, _ = calculate_premium_from_earnings(earnings, tier=tier, duration_days=duration)
    policy = Policy(
        rider_id=current_user.id,
        premium=daily_premium,
        risk_score=risk_score,
        active=False,
        locked=False,
        tier=tier,
        duration_days=duration,
        blockchain_status="PENDING",
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    return {
        "message": "Policy created. Razorpay premium payment is required before coverage becomes active.",
        "policy": _policy_dict(policy),
        "next_step": f"POST /payments/premium/order with policy_id={policy.id}",
    }
