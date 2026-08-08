from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WorkSession
from ..routers.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["work sessions"])


class StartSessionRequest(BaseModel):
    latitude: float
    longitude: float
    consent: bool


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_session(
    payload: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not payload.consent:
        raise HTTPException(status_code=400, detail="Location consent is required to start a tracked work session")

    existing = (
        db.query(WorkSession)
        .filter(WorkSession.rider_id == current_user.id, WorkSession.ended_at.is_(None))
        .order_by(WorkSession.started_at.desc())
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A work session is already active")

    session = WorkSession(
        rider_id=current_user.id,
        started_at=datetime.utcnow(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        consent=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "session_id": session.id,
        "status": "active",
        "started_at": session.started_at.isoformat(),
        "latitude": session.latitude,
        "longitude": session.longitude,
        "consent": session.consent,
    }


@router.post("/{session_id}/stop")
def stop_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session = db.query(WorkSession).filter(
        WorkSession.id == session_id,
        WorkSession.rider_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Work session not found")
    if session.ended_at is not None:
        raise HTTPException(status_code=409, detail="Work session is already stopped")

    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return {
        "session_id": session.id,
        "status": "completed",
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat(),
    }


@router.get("/current")
def current_session(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session = (
        db.query(WorkSession)
        .filter(WorkSession.rider_id == current_user.id, WorkSession.ended_at.is_(None))
        .order_by(WorkSession.started_at.desc())
        .first()
    )
    if not session:
        return {"active": False, "session": None}
    return {
        "active": True,
        "session": {
            "session_id": session.id,
            "started_at": session.started_at.isoformat(),
            "latitude": session.latitude,
            "longitude": session.longitude,
            "consent": session.consent,
        },
    }


@router.get("/history")
def session_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sessions = (
        db.query(WorkSession)
        .filter(WorkSession.rider_id == current_user.id)
        .order_by(WorkSession.started_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "session_id": item.id,
            "started_at": item.started_at.isoformat(),
            "ended_at": item.ended_at.isoformat() if item.ended_at else None,
            "latitude": item.latitude,
            "longitude": item.longitude,
            "consent": item.consent,
            "status": "active" if item.ended_at is None else "completed",
        }
        for item in sessions
    ]
