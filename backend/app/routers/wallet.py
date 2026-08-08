from fastapi import APIRouter

router = APIRouter(prefix="/wallet", tags=["wallet"])

@router.post("/connect")
def connect_wallet():
    return {"message": "Connect wallet placeholder"}
