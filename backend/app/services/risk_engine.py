"""ZenoGuard prototype pricing engine.

Prototype factors are taken from the PS1 specification. This module is the
 deterministic pricing layer; the serialized ML risk model remains separate.
"""

COVERAGE_TIERS = {
    "basic": {"label": "Basic", "accident": 2500.0, "breakdown": 750.0, "weather": 500.0, "base_premium": 20.0},
    "standard": {"label": "Standard", "accident": 5000.0, "breakdown": 1500.0, "weather": 1000.0, "base_premium": 50.0},
    "plus": {"label": "Plus", "accident": 10000.0, "breakdown": 3000.0, "weather": 2000.0, "base_premium": 100.0},
}

DURATION_FACTORS = {7: 1.0, 30: 0.90, 90: 0.80}
INCOME_BANDS = [(8000, 0.60), (12000, 0.75), (16000, 0.90), (20000, 1.00), (25000, 1.10), (30000, 1.20), (40000, 1.30)]

def _income_factor(income: float) -> float:
    if income <= INCOME_BANDS[0][0]:
        return INCOME_BANDS[0][1]
    if income >= INCOME_BANDS[-1][0]:
        return INCOME_BANDS[-1][1]
    for (lo_income, lo_factor), (hi_income, hi_factor) in zip(INCOME_BANDS, INCOME_BANDS[1:]):
        if lo_income <= income <= hi_income:
            t = (income - lo_income) / (hi_income - lo_income)
            return round(lo_factor + t * (hi_factor - lo_factor), 4)
    return 1.0

def _hours_surcharge(hours: float) -> float:
    return round((hours - 10) * 1.5, 2) if hours > 10 else 0.0

def calculate_premium_from_earnings(earnings_log, tier: str = "standard", duration_days: int = 30) -> tuple:
    tier_key = (tier or "standard").lower()
    tier_info = COVERAGE_TIERS.get(tier_key, COVERAGE_TIERS["standard"])
    income = float(earnings_log.income or 0.0)
    hours = float(earnings_log.hours_worked or 0.0)
    inc_factor = _income_factor(income)
    dur_factor = DURATION_FACTORS.get(duration_days, 0.90)
    surcharge = _hours_surcharge(hours)
    income_norm = min(income / 40000.0, 1.0)
    hours_norm = min(hours / 14.0, 1.0)
    risk_score = round((income_norm * 0.6 + hours_norm * 0.4) * 10.0, 2)
    daily_premium = round(max(10.0, tier_info["base_premium"] * inc_factor * dur_factor + surcharge), 2)
    explanation = (f"[Prototype] Tier: {tier_info['label']} | Base ₹{tier_info['base_premium']} × income factor {inc_factor} × duration factor {dur_factor} + shift surcharge ₹{surcharge} = ₹{daily_premium}/day")
    return daily_premium, risk_score, explanation, tier_info

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
