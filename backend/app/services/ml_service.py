from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
PREMIUM_MODEL_PATH = ROOT / "ml" / "premium" / "models" / "premium_model.pkl"
CLAIM_MODEL_PATH = ROOT / "ml" / "claim_fraud" / "models" / "claim_fraud_model.pkl"

PREMIUM_FEATURE_DEFAULTS = {
    "platform": "Swiggy",
    "worker_type": "Delivery",
    "location": "Mumbai",
    "age": 24,
    "experience_months": 12,
    "working_hours": 8.0,
    "daily_income": 0.0,
    "avg_daily_distance_km": 50.0,
    "weather_risk": 0.50,
    "traffic_risk": 0.50,
    "area_risk": 0.50,
    "night_work_ratio": 0.20,
    "historical_incidents": 0,
    "safety_score": 0.75,
    "days_active_last_30": 25,
    "previous_claims": 0,
    "avg_trip_duration_min": 25.0,
}

CLAIM_FEATURE_DEFAULTS = {
    "claim_amount": 0.0,
    "previous_claims": 0,
    "days_since_last_claim": 365,
    "evidence_quality": 1.0,
    "policy_age_days": 0,
    "hours_worked": 8.0,
    "location_consistency": 1.0,
    "event_consistency": 1.0,
    "duplicate_signal": 0,
    "work_session_active": 1,
}


def _load_model(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"ML model artifact not found: {path}")
    return joblib.load(path)


def build_premium_features(worker_data: dict | None = None) -> dict:
    data = {**PREMIUM_FEATURE_DEFAULTS, **(worker_data or {})}
    return {key: data[key] for key in PREMIUM_FEATURE_DEFAULTS}


def predict_premium(worker_data: dict) -> float:
    features = build_premium_features(worker_data)
    model = _load_model(PREMIUM_MODEL_PATH)
    return round(float(model.predict(pd.DataFrame([features]))[0]), 2)


def _claim_features(model, claim_data: dict) -> dict:
    data = {**CLAIM_FEATURE_DEFAULTS, **(claim_data or {})}
    names = getattr(model, "feature_names_in_", None)
    if names is None and hasattr(model, "named_steps"):
        for step in reversed(list(model.named_steps.values())):
            names = getattr(step, "feature_names_in_", None)
            if names is not None:
                break
    if names is None:
        return data
    return {name: data.get(name, 0.0) for name in names}


def predict_claim(claim_data: dict) -> dict:
    artifact = _load_model(CLAIM_MODEL_PATH)
    model = artifact["model"]
    threshold = float(artifact.get("threshold", 0.50))
    features = _claim_features(model, claim_data)
    probability = float(model.predict_proba(pd.DataFrame([features]))[0][1])

    if probability < 0.30:
        decision = "VALID"
    elif probability < 0.70:
        decision = "REVIEW"
    else:
        decision = "HIGH_RISK"

    return {
        "fraud_probability": round(probability, 4),
        "verification_confidence": round(1 - probability, 4),
        "decision": decision,
        "model_threshold": threshold,
    }
