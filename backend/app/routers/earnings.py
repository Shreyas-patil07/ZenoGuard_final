from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EarningsLog
from ..routers.auth import get_current_user
from ..schemas import EarningsLogCreate

router = APIRouter(prefix="/earnings", tags=["earnings"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_earnings(
    payload: EarningsLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    earnings_entry = EarningsLog(
        rider_id=current_user.id,
        income=payload.income,
        hours_worked=payload.hours_worked,
    )
    db.add(earnings_entry)
    db.commit()
    db.refresh(earnings_entry)

    return {
        "message": "Earnings saved successfully",
        "id": earnings_entry.id,
        "income": earnings_entry.income,
        "hours_worked": earnings_entry.hours_worked,
    }
