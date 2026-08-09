import os
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Rider, RiderProfile
from ..routers.auth import get_current_user
from ..services.document_verification import verify_driving_license, verify_secondary_document
from PIL import Image
import cloudinary

router = APIRouter(prefix="/kyc", tags=["kyc"])
ALLOWED_SECONDARY_IDS = {"aadhaar", "pan"}


class ProfileUpdate(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    date_of_birth: str = Field(default="", max_length=20)
    address: str = Field(min_length=3, max_length=250)
    city: str = Field(min_length=2, max_length=100)
    secondary_id_type: str = Field(min_length=6, max_length=20)


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
        "ai_document_status": profile.ai_document_status or "pending",
        "ai_document_confidence": profile.ai_document_confidence,
        "ai_document_type": profile.ai_document_type,
        "ai_extracted_name": profile.ai_extracted_name,
        "ai_extracted_dob": profile.ai_extracted_dob,
        "ai_extracted_id_number_masked": _masked(profile.ai_extracted_id_number),
        "ai_verification_note": profile.ai_verification_note,
        "secondary_ai_document_status": profile.secondary_ai_document_status or "pending",
        "secondary_ai_document_confidence": profile.secondary_ai_document_confidence,
        "secondary_ai_document_type": profile.secondary_ai_document_type,
        "secondary_ai_extracted_name": profile.secondary_ai_extracted_name,
        "secondary_ai_extracted_id_number_masked": _masked(profile.secondary_ai_extracted_id_number),
        "secondary_ai_verification_note": profile.secondary_ai_verification_note,
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
    secondary_type = payload.secondary_id_type.strip().lower()
    if secondary_type not in ALLOWED_SECONDARY_IDS:
        raise HTTPException(status_code=422, detail="Choose either Aadhaar or PAN as your additional identity document.")
    profile = _profile(db, current_user.id)
    profile.phone = payload.phone.strip()
    if payload.date_of_birth.strip():
        profile.date_of_birth = payload.date_of_birth.strip()
    profile.address = payload.address.strip()
    profile.city = payload.city.strip()
    if profile.secondary_id_type != secondary_type:
        profile.secondary_id_number = None
        profile.secondary_id_document_url = None
        profile.secondary_ai_document_status = "pending"
        profile.secondary_ai_extracted_name = None
        profile.secondary_ai_extracted_id_number = None
    profile.secondary_id_type = secondary_type
    db.commit()
    db.refresh(profile)
    return {"message": "Profile details saved. Document numbers are extracted from uploaded documents.", "profile": _profile_dict(profile, current_user)}


@router.post("/submit")
def submit_kyc(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    profile = _profile(db, current_user.id)
    if not profile.phone or not profile.address or not profile.city:
        raise HTTPException(status_code=400, detail="Complete phone, address and city before submitting KYC.")
    if profile.id_type != "driving_license" or not profile.id_document_url:
        raise HTTPException(status_code=400, detail="Upload the mandatory driving licence before submitting.")
    secondary_type = (profile.secondary_id_type or "").lower()
    if secondary_type not in ALLOWED_SECONDARY_IDS or not profile.secondary_id_document_url:
        raise HTTPException(status_code=400, detail="Upload exactly one additional document: Aadhaar or PAN.")

    # AI is deliberately invoked here, never during upload.
    try:
        dl_result = _verify_cloudinary_document(profile.id_document_url, "driving_license", current_user.name)
        secondary_result = _verify_cloudinary_document(profile.secondary_id_document_url, secondary_type, current_user.name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail="Document AI verification failed. Please try again with clear documents.") from exc

    profile.ai_document_status = dl_result["status"]
    profile.ai_document_confidence = dl_result["detection_confidence"]
    profile.ai_document_type = dl_result["document_type"]
    profile.ai_extracted_name = dl_result["fields"].get("name")
    profile.ai_extracted_dob = dl_result["fields"].get("dob")
    profile.ai_extracted_id_number = dl_result["fields"].get("dl_number")
    profile.ai_verification_note = " ".join(dl_result["notes"]) or "Driving licence AI checks passed."
    profile.secondary_ai_document_status = secondary_result["status"]
    profile.secondary_ai_document_confidence = secondary_result["detection_confidence"]
    profile.secondary_ai_document_type = secondary_result["document_type"]
    profile.secondary_ai_extracted_name = secondary_result["fields"].get("name")
    profile.secondary_ai_extracted_id_number = secondary_result["fields"].get("id_number")
    profile.secondary_ai_verification_note = " ".join(secondary_result["notes"]) or f"{secondary_type.upper()} AI checks passed."

    if dl_result["status"] != "verified" or secondary_result["status"] != "verified":
        db.commit()
        raise HTTPException(status_code=422, detail={"message": "One or more documents failed automated checks. Fix the document and submit again.", "driving_license": dl_result, secondary_type: secondary_result})

    profile.id_number = dl_result["fields"].get("dl_number")
    profile.date_of_birth = dl_result["fields"].get("dob") or profile.date_of_birth
    profile.secondary_id_number = secondary_result["fields"].get("id_number")

    current_status = (current_user.kyc_status or "unverified").lower()
    if current_status == "verified":
        db.commit()
        return {"message": "Identity is already verified.", "profile": _profile_dict(profile, current_user)}
    if current_status == "under_review":
        db.commit()
        return {"message": "Identity verification is already under review.", "profile": _profile_dict(profile, current_user)}
    current_user.kyc_status = "under_review"
    profile.submitted_at = datetime.utcnow()
    profile.reviewed_at = None
    profile.review_note = None
    db.commit()
    db.refresh(profile)
    return {"message": "Both uploaded documents passed AI checks and KYC was submitted for review.", "profile": _profile_dict(profile, current_user)}


def _verify_cloudinary_document(url: str, document_type: str, expected_name: str):
    if not url:
        raise RuntimeError(f"Missing {document_type} document URL.")
    import requests
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    image = Image.open(__import__("io").BytesIO(response.content)).convert("RGB")
    if document_type == "driving_license":
        return verify_driving_license(image, expected_name=expected_name)
    return verify_secondary_document(image, document_type, expected_name=expected_name)


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
