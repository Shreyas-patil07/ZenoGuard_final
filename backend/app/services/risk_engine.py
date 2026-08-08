def calculate_premium_from_earnings(earnings_log):
    """
    Simple risk engine:
    - Base premium: ₹15.0
    - Compute a risk score (0-10) from income and hours_worked
    - Weighted contribution -> added to base
    - Apply simple discounts (high income -> discount)

    Returns (premium: float, risk_score: float, explanation: str)
    """
    base = 15.0
    income = earnings_log.income or 0.0
    hours = earnings_log.hours_worked or 0.0

    # income factor: lower income -> higher risk (scaled 0..1)
    income_target = 30000.0
    income_factor = max(0.0, (income_target - income) / income_target)

    # hours factor: longer shifts slightly increase risk (0..1, cap at 16h)
    hours_cap = 16.0
    hours_factor = min(hours / hours_cap, 1.0)

    # combine into a 0..10 risk score
    risk_score = round((income_factor * 0.6 + hours_factor * 0.4) * 10.0, 2)

    # weight the risk score into currency (multiplier)
    weight_multiplier = 0.5
    weighted = round(risk_score * weight_multiplier, 2)

    # simple discount: high earners get a small discount
    discount = 0.0
    if income >= 50000:
        discount = 2.0

    premium = round(max(5.0, base + weighted - discount), 2)

    explanation = (
        f"Base ₹{base} + weighted risk (risk_score={risk_score})*{weight_multiplier} = ₹{weighted:.2f}"
        f" - discounts ₹{discount:.2f} => ₹{premium:.2f}"
    )

    return premium, risk_score, explanation
