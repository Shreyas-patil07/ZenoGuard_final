from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EarningsLog, Policy
from ..routers.auth import get_current_user
from ..services.risk_engine import calculate_premium_from_earnings

router = APIRouter(prefix="/premium", tags=["premium"])


@router.get("/calculate")
def calculate_premium(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    earnings = (
        db.query(EarningsLog)
        .filter(EarningsLog.rider_id == current_user.id)
        .order_by(EarningsLog.date.desc())
        .first()
    )

    if not earnings:
        premium = 18.0
        risk_score = 4.5
        explanation = "Default premium — submit today's earnings for a personalized rate"
    else:
        premium, risk_score, explanation = calculate_premium_from_earnings(earnings)

    new_policy = Policy(rider_id=current_user.id, premium=premium, risk_score=risk_score)
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)

    return {"premium": premium, "risk_score": risk_score, "explanation": explanation}
