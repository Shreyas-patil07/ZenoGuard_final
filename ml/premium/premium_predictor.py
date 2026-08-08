from pathlib import Path
import joblib
import pandas as pd

MODEL_PATH = Path(__file__).parent / "models" / "premium_model.pkl"
_model = joblib.load(MODEL_PATH)

def predict_premium(worker_data: dict) -> float:
    X = pd.DataFrame([worker_data])
    return round(float(_model.predict(X)[0]), 2)
