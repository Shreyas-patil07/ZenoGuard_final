from datetime import datetime

from ..models import Claim, Policy
from .ml_service import predict_claim
from .risk_engine import get_payout_amount


def verify_claim(claim: Claim, policy: Policy) -> dict:
    evidence_present = bool((claim.screenshot_url or "").strip())
    policy_age_days = max(0, (datetime.utcnow() - (policy.start_date or datetime.utcnow())).days)
    claim_data = {
        "claim_amount": get_payout_amount(claim.event_type, policy.tier),
        "previous_claims": 0,
        "days_since_last_claim": 365,
        "evidence_quality": 1.0 if evidence_present else 0.0,
        "policy_age_days": policy_age_days,
        "hours_worked": 8.0,
        "location_consistency": 1.0 if claim.location.strip() else 0.0,
        "event_consistency": 1.0 if claim.event_type in {"accident", "breakdown", "weather"} else 0.0,
        "duplicate_signal": 0,
        "work_session_active": 1,
    }

    if not evidence_present:
        return {
            "status": "REVIEW",
            "reason": "Evidence is required before automated validation.",
            "fraud_probability": None,
            "verification_confidence": 0.0,
        }

    try:
        ml_result = predict_claim(claim_data)
    except Exception as exc:
        return {
            "status": "REVIEW",
            "reason": f"Claim ML verification unavailable: {type(exc).__name__}",
            "fraud_probability": None,
            "verification_confidence": 0.0,
        }

    decision = ml_result["decision"]
    status = "REJECTED" if decision == "HIGH_RISK" else decision
    return {
        "status": status,
        "reason": f"Claim ML decision: {decision}",
        "fraud_probability": ml_result["fraud_probability"],
        "verification_confidence": ml_result["verification_confidence"],
    }
