"""ZenoGuard prototype premium calculation.

The trained premium model supplies the ML premium signal. This module then
applies the deterministic PS1 pricing factors for coverage tier, policy
 duration, income and long shifts. The ML artifact in this repository predicts
recommended premium directly; it is therefore treated as an ML premium signal,
not mislabeled as an expected-loss model.
"""

from .ml_service import predict_premium

COVERAGE_TIERS = {
    "basic": {"label": "Basic", "accident": 2500.0, "breakdown": 750.0, "weather": 500.0, "base_premium": 20.0},
    "standard": {"label": "Standard", "accident": 5000.0, "breakdown": 1500.0, "weather": 1000.0, "base_premium": 50.0},
    "plus": {"label": "Plus", "accident": 10000.0, "breakdown": 3000.0, "weather": 2000.0, "base_premium": 100.0},
}

DURATION_FACTORS = {7: 1.0, 30: 0.90, 90: 0.80}
INCOME_BANDS = [(8000, 0.60), (12000, 0.75), (16000, 0.90), (20000, 1.00), (25000, 1.10), (30000, 1.20), (40000, 1.30)]
ML_PREMIUM_MIN = 6.5
ML_PREMIUM_MAX = 18.0


def _income_factor(daily_income: float) -> float:
    """Map daily earnings to the prototype monthly income bands using 26 days."""
    monthly_income = max(0.0, daily_income) * 26.0
    if monthly_income <= INCOME_BANDS[0][0]:
        return INCOME_BANDS[0][1]
    if monthly_income >= INCOME_BANDS[-1][0]:
        return INCOME_BANDS[-1][1]
    for (lo_income, lo_factor), (hi_income, hi_factor) in zip(INCOME_BANDS, INCOME_BANDS[1:]):
        if lo_income <= monthly_income <= hi_income:
            t = (monthly_income - lo_income) / (hi_income - lo_income)
            return round(lo_factor + t * (hi_factor - lo_factor), 4)
    return 1.0


def _hours_surcharge(hours: float) -> float:
    return round((hours - 10) * 1.5, 2) if hours > 10 else 0.0


def _risk_score_from_ml_premium(ml_premium: float) -> float:
    normalized = (ml_premium - ML_PREMIUM_MIN) / (ML_PREMIUM_MAX - ML_PREMIUM_MIN)
    return round(max(0.0, min(1.0, normalized)) * 10.0, 2)


def calculate_premium_from_earnings(earnings_log, tier: str = "standard", duration_days: int = 30) -> tuple:
    tier_key = (tier or "standard").lower()
    if tier_key not in COVERAGE_TIERS:
        raise ValueError("Tier must be basic, standard, or plus")
    if duration_days not in DURATION_FACTORS:
        raise ValueError("Duration must be 7, 30, or 90 days")

    tier_info = COVERAGE_TIERS[tier_key]
    income = float(earnings_log.income or 0.0)
    hours = float(earnings_log.hours_worked or 0.0)

    ml_features = {
        "daily_income": income,
        "working_hours": hours,
    }
    ml_premium = predict_premium(ml_features)
    inc_factor = _income_factor(income)
    dur_factor = DURATION_FACTORS[duration_days]
    tier_factor = tier_info["base_premium"] / COVERAGE_TIERS["standard"]["base_premium"]
    surcharge = _hours_surcharge(hours)

    daily_premium = round(max(5.0, ml_premium * tier_factor * inc_factor * dur_factor + surcharge), 2)
    risk_score = _risk_score_from_ml_premium(ml_premium)
    explanation = (
        f"ML premium signal ₹{ml_premium}/day × {tier_info['label']} factor {tier_factor:.2f} "
        f"× income factor {inc_factor:.2f} × duration factor {dur_factor:.2f} "
        f"+ shift surcharge ₹{surcharge} = ₹{daily_premium}/day"
    )
    return daily_premium, risk_score, explanation, tier_info, ml_premium


def get_payout_amount(event_type: str, tier: str = "standard") -> float:
    tier_info = COVERAGE_TIERS.get((tier or "standard").lower(), COVERAGE_TIERS["standard"])
    event_key = (event_type or "accident").strip().lower()
    if event_key == "accident":
        return tier_info["accident"]
    if event_key in {"weather", "weather disruption"}:
        return tier_info["weather"]
    if event_key in {"breakdown", "vehicle breakdown"}:
        return tier_info["breakdown"]
    return tier_info["accident"]
