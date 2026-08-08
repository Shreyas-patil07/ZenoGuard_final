from pathlib import Path
import joblib
import pandas as pd

ARTIFACT_PATH = Path(__file__).parent / "models" / "claim_fraud_model.pkl"
_artifact = joblib.load(ARTIFACT_PATH)
_model = _artifact["model"]
_THRESHOLD = _artifact["threshold"]

def predict_claim(claim_data: dict) -> dict:
    X = pd.DataFrame([claim_data])
    probability = float(_model.predict_proba(X)[0][1])

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
        "model_threshold": _THRESHOLD,
    }
