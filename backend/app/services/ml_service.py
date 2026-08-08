from pathlib import Path
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
PREMIUM_MODEL_PATH = ROOT / "ml" / "premium" / "models" / "premium_model.pkl"
CLAIM_MODEL_PATH = ROOT / "ml" / "claim_fraud" / "models" / "claim_fraud_model.pkl"


def _load_model(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"ML model artifact not found: {path}")
    return joblib.load(path)


def predict_premium(worker_data: dict) -> float:
    model = _load_model(PREMIUM_MODEL_PATH)
    return round(float(model.predict(pd.DataFrame([worker_data]))[0]), 2)


def predict_claim(claim_data: dict) -> dict:
    artifact = _load_model(CLAIM_MODEL_PATH)
    model = artifact["model"]
    threshold = float(artifact.get("threshold", 0.50))
    probability = float(model.predict_proba(pd.DataFrame([claim_data]))[0][1])

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
