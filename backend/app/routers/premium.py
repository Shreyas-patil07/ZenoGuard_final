import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EarningsLog, Policy
from ..routers.auth import get_current_user
from ..services.risk_engine import (
    calculate_premium_from_earnings,
    COVERAGE_TIERS,
    DURATION_FACTORS,
)

router = APIRouter(prefix="/premium", tags=["premium"])


class PremiumRequest(BaseModel):
    tier: Optional[str] = "standard"
    duration_days: Optional[int] = 30


# ── helpers ────────────────────────────────────────────────────────────────────

def get_active_locked_policy(db: Session, rider_id: int) -> Optional[Policy]:
    """Return the rider's currently active and locked policy if it hasn't expired."""
    now = datetime.datetime.utcnow()
    return (
        db.query(Policy)
        .filter(
            Policy.rider_id == rider_id,
            Policy.locked == True,
            Policy.active == True,
            Policy.end_date >= now,
        )
        .order_by(Policy.id.desc())
        .first()
    )


def _policy_dict(p: Policy) -> dict:
    from ..services.risk_engine import COVERAGE_TIERS
    tier_info = COVERAGE_TIERS.get(p.tier or "standard", COVERAGE_TIERS["standard"])
    days_remaining = None
    if p.end_date:
        delta = p.end_date - datetime.datetime.utcnow()
        days_remaining = max(0, delta.days)
    return {
        "policy_id":     p.id,
        "tier":          p.tier,
        "tier_label":    tier_info["label"],
        "duration_days": p.duration_days,
        "premium":       p.premium,
        "total_premium": round(p.premium * p.duration_days, 2),
        "risk_score":    p.risk_score,
        "active":        p.active,
        "locked":        p.locked,
        "start_date":    p.start_date.isoformat() if p.start_date else None,
        "end_date":      p.end_date.isoformat() if p.end_date else None,
        "days_remaining": days_remaining,
        "coverage": {
            "accident":  tier_info["accident"],
            "breakdown": tier_info["breakdown"],
            "weather":   tier_info["weather"],
        },
    }


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.get("/tiers")
def get_tiers():
    """Return all available coverage tiers and their benefit amounts."""
    return {
        "tiers": {
            key: {
                "label":        val["label"],
                "accident":     val["accident"],
                "breakdown":    val["breakdown"],
                "weather":      val["weather"],
                "base_premium": val["base_premium"],
            }
            for key, val in COVERAGE_TIERS.items()
        },
        "durations": list(DURATION_FACTORS.keys()),
        "note": "[Prototype Assumption] — not IRDAI-approved rates",
    }


@router.get("/active-policy")
def get_active_policy(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return the rider's active locked policy if one exists.
    Frontend uses this to lock/unlock the tier selector.
    """
    policy = get_active_locked_policy(db, current_user.id)
    if not policy:
        return {"has_active_policy": False, "policy": None}
    return {"has_active_policy": True, "policy": _policy_dict(policy)}


@router.get("/calculate")
def calculate_premium(
    tier: str = "standard",
    duration_days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Calculate premium for a given tier and duration.
    Does NOT save a policy record — that only happens on payment (via razorpay).
    """
    earnings = (
        db.query(EarningsLog)
        .filter(EarningsLog.rider_id == current_user.id)
        .order_by(EarningsLog.date.desc())
        .first()
    )

    if not earnings:
        default_earnings = EarningsLog(
            rider_id=current_user.id,
            income=0.0,
            hours_worked=8.0,
            date=datetime.datetime.utcnow(),
        )
        daily_premium, risk_score, explanation, tier_info = calculate_premium_from_earnings(
            default_earnings, tier=tier, duration_days=duration_days
        )
        explanation = f"Default rate (no earnings logged yet) — {explanation}"
    else:
        daily_premium, risk_score, explanation, tier_info = calculate_premium_from_earnings(
            earnings, tier=tier, duration_days=duration_days
        )

    total_premium = round(daily_premium * duration_days, 2)

    return {
        "premium":       daily_premium,
        "total_premium": total_premium,
        "duration_days": duration_days,
        "tier":          tier,
        "tier_label":    tier_info["label"],
        "risk_score":    risk_score,
        "explanation":   explanation,
        "coverage": {
            "accident":  tier_info["accident"],
            "breakdown": tier_info["breakdown"],
            "weather":   tier_info["weather"],
        },
        "earnings_used": earnings.income if earnings else 0.0,
        "note":          "[Prototype Assumption] — not IRDAI-approved rates",
    }


@router.post("/activate")
def activate_policy(
    payload: PremiumRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Called after successful Razorpay payment to lock the policy.
    Creates a new locked active policy record.
    """
    # Check no active policy already
    existing = get_active_locked_policy(db, current_user.id)
    if existing:
        return {
            "message": "You already have an active policy.",
            "policy": _policy_dict(existing),
        }

    earnings = (
        db.query(EarningsLog)
        .filter(EarningsLog.rider_id == current_user.id)
        .order_by(EarningsLog.date.desc())
        .first()
    )

    tier = (payload.tier or "standard").lower()
    duration = payload.duration_days or 30

    if not earnings:
        default_earnings = EarningsLog(
            rider_id=current_user.id, income=0.0, hours_worked=8.0,
            date=datetime.datetime.utcnow(),
        )
        daily_premium, risk_score, _, _ = calculate_premium_from_earnings(
            default_earnings, tier=tier, duration_days=duration
        )
    else:
        daily_premium, risk_score, _, _ = calculate_premium_from_earnings(
            earnings, tier=tier, duration_days=duration
        )

    now = datetime.datetime.utcnow()
    policy = Policy(
        rider_id=current_user.id,
        premium=daily_premium,
        risk_score=risk_score,
        active=True,
        locked=True,           # LOCKED — cannot be changed until expiry
        tier=tier,
        duration_days=duration,
        start_date=now,
        end_date=now + datetime.timedelta(days=duration),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    return {
        "message": f"Policy activated and locked for {duration} days.",
        "policy":  _policy_dict(policy),
    }
