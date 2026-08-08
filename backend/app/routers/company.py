from fastapi import APIRouter

router = APIRouter(prefix="/company", tags=["company"])

@router.post("/select")
def select_company():
    return {"message": "Select company placeholder"}
