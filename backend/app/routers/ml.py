from fastapi import APIRouter, HTTPException

from ..services.ml_service import predict_claim, predict_premium

router = APIRouter(prefix="/ml", tags=["machine-learning"])


@router.post("/premium")
def premium_prediction(payload: dict):
    try:
        premium = predict_premium(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Premium prediction failed: {exc}") from exc

    return {"recommended_premium": premium}


@router.post("/claim-check")
def claim_prediction(payload: dict):
    try:
        return predict_claim(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Claim prediction failed: {exc}") from exc
