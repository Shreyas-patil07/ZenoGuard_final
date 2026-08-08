import os
from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .database import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    checks = {"api": "ok", "database": "error", "ml": "error", "blockchain": "not_configured"}

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except SQLAlchemyError:
        checks["database"] = "error"
    finally:
        db.close()

    premium_model = os.getenv("PREMIUM_MODEL_PATH", "ml/premium/premium_model.pkl")
    claim_model = os.getenv("CLAIM_MODEL_PATH", "ml/claim_fraud/claim_fraud_model.pkl")
    if os.path.exists(premium_model) and os.path.exists(claim_model):
        checks["ml"] = "ok"

    rpc_url = os.getenv("WEB3_RPC_URL")
    addresses = [
        os.getenv("DRIVER_REGISTRY_ADDRESS"),
        os.getenv("SAFETY_SCORE_ORACLE_ADDRESS"),
        os.getenv("INSURANCE_POOL_ADDRESS"),
        os.getenv("INSURANCE_POLICY_ADDRESS"),
        os.getenv("CLAIM_MANAGER_ADDRESS"),
    ]
    if rpc_url and all(addresses):
        checks["blockchain"] = "configured"

    overall = "ok" if checks["database"] == "ok" and checks["ml"] == "ok" else "degraded"
    return {"status": overall, "checks": checks}
