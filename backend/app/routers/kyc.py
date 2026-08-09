import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Rider, RiderProfile
from ..routers.auth import get_current_user
from ..services.document_verification import verify_driving_license

router = APIRouter(prefix="/kyc", tags=["kyc"])


class ProfileUpdate(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    driving_license_number: str = Field(min_length=8, max_length=30)
    address: str = Field(min_length=3, max_length=250)
    city: str = Field(min_length=2, max_length=100)
    date_of_birth: str = Field(default="", max_length=20)


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
        "driving_license_number_masked": _masked(profile.id_number),
        "id_type": profile.id_type,
        "id_number_masked": _masked(profile.id_number),
        "id_document_url": profile.id_document_url,
        "secondary_id_type": None,
        "secondary_id_number_masked": None,
        "secondary_id_document_url": None,
        "tertiary_id_type": None,
        "tertiary_id_number_masked": None,
        "tertiary_id_document_url": None,
        "documents": {
            "driving_license": {
                "document_type": "driving_license",
                "uploaded": bool(profile.id_document_url),
                "number_masked": _masked(profile.id_number),
                "document_url": profile.id_document_url,
                "ai_status": profile.ai_document_status or "pending",
                "ai_confidence": profile.ai_document_confidence,
                "ai_extracted_name": profile.ai_extracted_name,
                "ai_extracted_number_masked": _masked(profile.ai_extracted_id_number),
                "ai_extracted_dob": profile.ai_extracted_dob,
                "ai_verification_note": profile.ai_verification_note,
            }
        },
        "ai_document_status": profile.ai_document_status or "pending",
        "ai_document_confidence": profile.ai_document_confidence,
        "ai_document_type": profile.ai_document_type,
        "ai_extracted_name": profile.ai_extracted_name,
        "ai_extracted_dob": profile.ai_extracted_dob,
        "ai_extracted_id_number_masked": _masked(profile.ai_extracted_id_number),
        "ai_verification_note": profile.ai_verification_note,
        "kyc_status": rider.kyc_status or "unverified",
        "submitted_at": profile.submitted_at.isoformat() if profile.submitted_at else None,
        "reviewed_at": profile.reviewed_at.isoformat() if profile.reviewed_at else None,
        "review_note": profile.review_note,
    }


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return _profile_dict(_profile(db, current_user.id), current_user)


@router.put("/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if (current_user.kyc_status or "unverified").lower() in {"verified", "under_review"}:
        raise HTTPException(status_code=409, detail="Verified or submitted identity details cannot be edited.")

    profile = _profile(db, current_user.id)
    profile.phone = payload.phone.strip()
    profile.address = payload.address.strip()
    profile.city = payload.city.strip()
    profile.id_number = payload.driving_license_number.strip().upper().replace(" ", "")
    if payload.date_of_birth.strip():
        profile.date_of_birth = payload.date_of_birth.strip()
    profile.id_type = "driving_license"
    db.commit()
    db.refresh(profile)

    return {
        "message": "Profile details saved. The driving licence number, name and DOB will be cross-verified when you submit verification.",
        "profile": _profile_dict(profile, current_user),
    }


def _download_image(url: str):
    if not url:
        raise RuntimeError("Driving licence document is missing.")
    import io
    import requests
    from PIL import Image

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGB")
    except Exception as exc:
        raise RuntimeError("The saved driving licence could not be downloaded for verification.") from exc


@router.post("/submit")
def submit_kyc(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    profile = _profile(db, current_user.id)

    if not profile.phone or not profile.address or not profile.city:
        raise HTTPException(status_code=400, detail="Complete phone, address and city before submitting KYC.")
    if not profile.id_document_url:
        raise HTTPException(status_code=400, detail="Driving licence is mandatory. Upload it before submitting.")
    if not profile.id_number:
        raise HTTPException(status_code=400, detail="Driving licence number is mandatory. Save it before submitting.")

    if (current_user.kyc_status or "unverified").lower() == "verified":
        return {"message": "Identity is already verified.", "profile": _profile_dict(profile, current_user)}
    if (current_user.kyc_status or "unverified").lower() == "under_review":
        return {"message": "Identity verification is already under review.", "profile": _profile_dict(profile, current_user)}

    try:
        image = _download_image(profile.id_document_url)
        result = verify_driving_license(
            image,
            expected_name=current_user.name,
            expected_dl_number=profile.id_number,
            expected_dob=profile.date_of_birth,
        )
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail="Driving licence AI verification failed. Please try again with a clear document image.") from exc

    profile.ai_document_status = result["status"]
    profile.ai_document_confidence = result["detection_confidence"]
    profile.ai_document_type = "driving_license"
    profile.ai_extracted_name = result["fields"].get("name")
    profile.ai_extracted_dob = result["fields"].get("dob")
    profile.ai_extracted_id_number = result["fields"].get("dl_number")
    profile.ai_verification_note = " ".join(result["notes"]) or "Driving licence AI checks passed."

    if result["status"] != "verified":
        db.commit()
        db.refresh(profile)
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Driving licence verification needs correction or manual review.",
                "driving_license": result,
                "profile": _profile_dict(profile, current_user),
            },
        )

    current_user.kyc_status = "under_review"
    profile.submitted_at = datetime.utcnow()
    profile.reviewed_at = None
    profile.review_note = None
    db.commit()
    db.refresh(profile)

    return {
        "message": "Driving licence passed AI and credential checks. KYC was submitted for review.",
        "profile": _profile_dict(profile, current_user),
        "driving_license": result,
        "documents": [result],
    }


@router.post("/review/{rider_id}")
def review_kyc(
    rider_id: int,
    payload: ReviewDecision,
    x_kyc_review_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
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
