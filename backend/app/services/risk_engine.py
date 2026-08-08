"""
ZenoGuard Risk Engine — PS1 compliant pricing.

SPEC REQUIREMENT (Section 8.2):
  "lower income generally leading to a lower premium"
  Income factors: ₹8,000 → 0.60, ₹40,000+ → 1.30

COVERAGE TIERS (Section 5):
  Basic    → Accident ₹2,500 | Breakdown ₹750  | Weather ₹500
  Standard → Accident ₹5,000 | Breakdown ₹1,500 | Weather ₹1,000
  Plus     → Accident ₹10,000 | Breakdown ₹3,000 | Weather ₹2,000

All values labelled [Prototype Assumption] per Section 2.
"""

# ── Coverage tier definitions ─────────────────────────────────────────────────
COVERAGE_TIERS = {
    "basic": {
        "label":     "Basic",
        "accident":  2500.0,
        "breakdown": 750.0,
        "weather":   500.0,
        "base_premium": 20.0,      # [Prototype Assumption]
    },
    "standard": {
        "label":     "Standard",
        "accident":  5000.0,
        "breakdown": 1500.0,
        "weather":   1000.0,
        "base_premium": 50.0,      # [Prototype Assumption]
    },
    "plus": {
        "label":     "Plus",
        "accident":  10000.0,
        "breakdown": 3000.0,
        "weather":   2000.0,
        "base_premium": 100.0,     # [Prototype Assumption]
    },
}

# Duration factors — [Prototype Assumption]
DURATION_FACTORS = {7: 1.0, 30: 0.90, 90: 0.80}

# Income → factor table from spec Section 8.2
# Higher income = higher factor = higher premium (more to protect)
INCOME_BANDS = [
    (8_000,  0.60),
    (12_000, 0.75),
    (16_000, 0.90),
    (20_000, 1.00),
    (25_000, 1.10),
    (30_000, 1.20),
    (40_000, 1.30),
]


def _income_factor(income: float) -> float:
    """
    Interpolate income factor from the spec table.
    Below ₹8,000 → 0.60 (minimum, affordable for poorest workers).
    Above ₹40,000 → 1.30 (capped).
    """
    if income <= INCOME_BANDS[0][0]:
        return INCOME_BANDS[0][1]
    if income >= INCOME_BANDS[-1][0]:
        return INCOME_BANDS[-1][1]
    # Linear interpolation between bands
    for i in range(len(INCOME_BANDS) - 1):
        lo_inc, lo_fac = INCOME_BANDS[i]
        hi_inc, hi_fac = INCOME_BANDS[i + 1]
        if lo_inc <= income <= hi_inc:
            t = (income - lo_inc) / (hi_inc - lo_inc)
            return round(lo_fac + t * (hi_fac - lo_fac), 4)
    return 1.00


def _hours_surcharge(hours: float) -> float:
    """
    Long-shift surcharge — [Prototype Assumption].
    Shifts > 10h increase accident probability.
    """
    if hours > 10:
        return round((hours - 10) * 1.5, 2)
    return 0.0


def calculate_premium_from_earnings(
    earnings_log,
    tier: str = "standard",
    duration_days: int = 30,
) -> tuple:
    """
    Calculate daily premium per spec Section 8.

    Formula (Section 8.1):
      Final Premium = Base Cost × Income Factor × Coverage Factor × Duration Factor
                    + hours surcharge

    Returns (daily_premium, risk_score, explanation, tier_info)
    """
    tier_key   = (tier or "standard").lower()
    tier_info  = COVERAGE_TIERS.get(tier_key, COVERAGE_TIERS["standard"])
    base       = tier_info["base_premium"]

    income     = earnings_log.income       or 0.0
    hours      = earnings_log.hours_worked or 0.0

    # Income factor — PS1 core requirement: higher income = higher factor
    inc_factor = _income_factor(income)

    # Duration factor
    dur_factor = DURATION_FACTORS.get(duration_days, 0.90)

    # Hours surcharge
    surcharge  = _hours_surcharge(hours)

    # Risk score for display (0–10): reflects how much coverage is being used
    # Higher income AND longer hours = higher risk score (more exposure)
    income_norm = min(income / 40_000, 1.0)          # 0→1 as income 0→₹40k
    hours_norm  = min(hours / 14.0, 1.0)
    risk_score  = round((income_norm * 0.6 + hours_norm * 0.4) * 10.0, 2)

    # Final daily premium
    daily_premium = round(
        max(10.0, base * inc_factor * dur_factor + surcharge), 2
    )

    explanation = (
        f"[Prototype] Tier: {tier_info['label']} | "
        f"Base ₹{base} × income factor {inc_factor} × duration factor {dur_factor} "
        f"+ shift surcharge ₹{surcharge} = ₹{daily_premium}/day"
    )

    return daily_premium, risk_score, explanation, tier_info


def get_payout_amount(event_type: str, tier: str = "standard") -> float:
    """
    Return the correct payout amount based on event type and coverage tier.
    Per spec Section 5.
    """
    tier_key  = (tier or "standard").lower()
    tier_info = COVERAGE_TIERS.get(tier_key, COVERAGE_TIERS["standard"])

    event_key = (event_type or "accident").strip().lower()
    if event_key == "accident":
        return tier_info["accident"]
    elif event_key in {"weather", "weather disruption"}:
        return tier_info["weather"]
    elif event_key in {"breakdown", "vehicle breakdown"}:
        return tier_info["breakdown"]
    return tier_info["accident"]   # default to accident benefit
