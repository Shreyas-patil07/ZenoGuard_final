import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Rider, RiderProfile
from ..routers.auth import get_current_user

router = APIRouter(prefix="/kyc", tags=["kyc"])
ALLOWED_SECONDARY_IDS = {"aadhaar", "pan"}


class ProfileUpdate(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    date_of_birth: str = Field(min_length=8, max_length=20)
    address: str = Field(min_length=3, max_length=250)
    city: str = Field(min_length=2, max_length=100)
    id_type: str = Field(min_length=2, max_length=40)
    id_number: str = Field(min_length=4, max_length=80)
    secondary_id_type: str = Field(min_length=6, max_length=20)
    secondary_id_number: str = Field(min_length=4, max_length=80)


class ReviewDecision(BaseModel):
    status: str
    note: str | None = None


def _profile(db: Session, rider_id: int) -> RiderProfile:
    profile = db.query(RiderProfile).filter(RiderProfile.rider_id == rider_id).first()
    if not profile:
        profile = RiderProfile(rider_id=rider_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _masked(value: str | None) -> str | None:
    if not value:
        return None
    return f"{'*' * max(0, len(value) - 4)}{value[-4:]}"


def _profile_dict(profile: RiderProfile, rider) -> dict:
    return {
        "name": rider.name,
        "email": rider.email,
        "phone": profile.phone,
        "date_of_birth": profile.date_of_birth,
        "address": profile.address,
        "city": profile.city,
        "id_type": profile.id_type,
        "id_number_masked": _masked(profile.id_number),
        "id_document_url": profile.id_document_url,
        "secondary_id_type": profile.secondary_id_type,
        "secondary_id_number_masked": _masked(profile.secondary_id_number),
        "secondary_id_document_url": profile.secondary_id_document_url,
        "kyc_status": rider.kyc_status or "unverified",
        "submitted_at": profile.submitted_at.isoformat() if profile.submitted_at else None,
        "reviewed_at": profile.reviewed_at.isoformat() if profile.reviewed_at else None,
        "review_note": profile.review_note,
        "ai_document_status": profile.ai_document_status or "pending",
        "ai_document_confidence": profile.ai_document_confidence,
        "ai_document_type": profile.ai_document_type,
        "ai_extracted_name": profile.ai_extracted_name,
        "ai_extracted_dob": profile.ai_extracted_dob,
        "ai_extracted_id_number_masked": _masked(profile.ai_extracted_id_number),
        "ai_verification_note": profile.ai_verification_note,
    }


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return _profile_dict(_profile(db, current_user.id), current_user)


@router.put("/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if (current_user.kyc_status or "unverified").lower() in {"verified", "under_review"}:
        raise HTTPException(status_code=409, detail="Verified or submitted identity details cannot be edited. Contact support if they are incorrect.")

    secondary_type = payload.secondary_id_type.strip().lower()
    if secondary_type not in ALLOWED_SECONDARY_IDS:
        raise HTTPException(status_code=422, detail="Choose either Aadhaar or PAN as your additional identity document.")

    profile = _profile(db, current_user.id)
    profile.phone = payload.phone.strip()
    profile.date_of_birth = payload.date_of_birth.strip()
    profile.address = payload.address.strip()
    profile.city = payload.city.strip()
    profile.id_type = "driving_license"
    profile.id_number = payload.id_number.strip()
    profile.secondary_id_type = secondary_type
    profile.secondary_id_number = payload.secondary_id_number.strip()
    db.commit()
    db.refresh(profile)
    return {"message": "Profile saved.", "profile": _profile_dict(profile, current_user)}


@router.post("/submit")
def submit_kyc(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    profile = _profile(db, current_user.id)
    missing = [
        field for field in (
            "phone", "date_of_birth", "address", "city", "id_number",
            "id_document_url", "secondary_id_type", "secondary_id_number",
            "secondary_id_document_url",
        ) if not getattr(profile, field, None)
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Complete your profile and upload the mandatory driving licence plus Aadhaar or PAN. Missing: {', '.join(missing)}",
        )

    if profile.id_type != "driving_license":
        raise HTTPException(status_code=422, detail="Driving licence is mandatory for KYC.")

    if (profile.secondary_id_type or "").lower() not in ALLOWED_SECONDARY_IDS:
        raise HTTPException(status_code=422, detail="Choose either Aadhaar or PAN as the additional identity document.")

    if (profile.ai_document_status or "pending").lower() != "verified":
        raise HTTPException(status_code=422, detail="The driving licence has not passed the automated document checks yet. Re-upload a clear driving licence image.")

    current_status = (current_user.kyc_status or "unverified").lower()
    if current_status == "verified":
        return {"message": "Identity is already verified.", "profile": _profile_dict(profile, current_user)}
    if current_status == "under_review":
        return {"message": "Identity verification is already under review.", "profile": _profile_dict(profile, current_user)}

    current_user.kyc_status = "under_review"
    profile.submitted_at = datetime.utcnow()
    profile.reviewed_at = None
    profile.review_note = None
    db.commit()
    db.refresh(profile)
    return {"message": "Identity verification submitted for review.", "profile": _profile_dict(profile, current_user)}


@router.post("/review/{rider_id}")
def review_kyc(rider_id: int, payload: ReviewDecision, x_kyc_review_key: str | None = Header(default=None), db: Session = Depends(get_db)):
    configured_key = os.getenv("KYC_REVIEW_KEY")
    if not configured_key or x_kyc_review_key != configured_key:
        raise HTTPException(status_code=403, detail="KYC review access denied")
    status = payload.status.lower().strip()
    if status not in {"verified", "rejected"}:
        raise HTTPException(status_code=400, detail="Review status must be verified or rejected")

    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    profile = _profile(db, rider.id)
    rider.kyc_status = status
    profile.reviewed_at = datetime.utcnow()
    profile.review_note = (payload.note or "").strip() or None
    db.commit()
    db.refresh(profile)
    return {"message": f"Identity marked {status}.", "profile": _profile_dict(profile, rider)}
