from fastapi import APIRouter

router = APIRouter(prefix="/kyc", tags=["kyc"])

@router.post("/upload")
def upload_kyc():
    return {"message": "KYC upload placeholder"}
