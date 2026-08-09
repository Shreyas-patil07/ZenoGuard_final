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

router = APIRouter(prefix="/kyc", tags=["kyc"])
ALLOWED_SECONDARY_IDS = {"aadhaar", "pan"}


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


def _doc_dict(doc_type, url, number, status, confidence, extracted_name, extracted_number, note):
    return {
        "document_type": doc_type,
        "uploaded": bool(url),
        "number_masked": _masked(number),
        "document_url": url,
        "ai_status": status or "pending",
        "ai_confidence": confidence,
        "ai_extracted_name": extracted_name,
        "ai_extracted_number_masked": _masked(extracted_number),
        "ai_verification_note": note,
    }


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
        "secondary_id_type": profile.secondary_id_type,
        "secondary_id_number_masked": _masked(profile.secondary_id_number),
        "secondary_id_document_url": profile.secondary_id_document_url,
        "tertiary_id_type": profile.tertiary_id_type,
        "tertiary_id_number_masked": _masked(profile.tertiary_id_number),
        "tertiary_id_document_url": profile.tertiary_id_document_url,
        "documents": {
            "driving_license": _doc_dict("driving_license", profile.id_document_url, profile.id_number, profile.ai_document_status, profile.ai_document_confidence, profile.ai_extracted_name, profile.ai_extracted_id_number, profile.ai_verification_note),
            "aadhaar": _doc_dict("aadhaar", profile.secondary_id_document_url if profile.secondary_id_type == "aadhaar" else profile.tertiary_id_document_url if profile.tertiary_id_type == "aadhaar" else None, profile.secondary_id_number if profile.secondary_id_type == "aadhaar" else profile.tertiary_id_number if profile.tertiary_id_type == "aadhaar" else None, profile.secondary_ai_document_status if profile.secondary_id_type == "aadhaar" else profile.tertiary_ai_document_status if profile.tertiary_id_type == "aadhaar" else None, profile.secondary_ai_document_confidence if profile.secondary_id_type == "aadhaar" else profile.tertiary_ai_document_confidence if profile.tertiary_id_type == "aadhaar" else None, profile.secondary_ai_extracted_name if profile.secondary_id_type == "aadhaar" else profile.tertiary_ai_extracted_name if profile.tertiary_id_type == "aadhaar" else None, profile.secondary_ai_extracted_id_number if profile.secondary_id_type == "aadhaar" else profile.tertiary_ai_extracted_id_number if profile.tertiary_id_type == "aadhaar" else None, profile.secondary_ai_verification_note if profile.secondary_id_type == "aadhaar" else profile.tertiary_ai_verification_note if profile.tertiary_id_type == "aadhaar" else None),
            "pan": _doc_dict("pan", profile.secondary_id_document_url if profile.secondary_id_type == "pan" else profile.tertiary_id_document_url if profile.tertiary_id_type == "pan" else None, profile.secondary_id_number if profile.secondary_id_type == "pan" else profile.tertiary_id_number if profile.tertiary_id_type == "pan" else None, profile.secondary_ai_document_status if profile.secondary_id_type == "pan" else profile.tertiary_ai_document_status if profile.tertiary_id_type == "pan" else None, profile.secondary_ai_document_confidence if profile.secondary_id_type == "pan" else profile.tertiary_ai_document_confidence if profile.tertiary_id_type == "pan" else None, profile.secondary_ai_extracted_name if profile.secondary_id_type == "pan" else profile.tertiary_ai_extracted_name if profile.tertiary_id_type == "pan" else None, profile.secondary_ai_extracted_id_number if profile.secondary_id_type == "pan" else profile.tertiary_ai_extracted_id_number if profile.tertiary_id_type == "pan" else None, profile.secondary_ai_verification_note if profile.secondary_id_type == "pan" else profile.tertiary_ai_verification_note if profile.tertiary_id_type == "pan" else None),
        },
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
    return {"message": "Profile details saved. The driving licence number, name and DOB will be cross-verified against the uploaded documents on submission.", "profile": _profile_dict(profile, current_user)}


def _verify_cloudinary_document(url: str, document_type: str, expected_name: str, expected_dl_number: str | None = None, expected_dob: str | None = None):
    if not url:
        raise RuntimeError(f"Missing {document_type} document URL.")
    import requests
    import io
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    if document_type == "driving_license":
        return verify_driving_license(image, expected_name=expected_name, expected_dl_number=expected_dl_number, expected_dob=expected_dob)
    return verify_secondary_document(image, document_type, expected_name=expected_name)


def _set_slot(profile, slot: str, result: dict):
    prefix = "secondary" if slot == "secondary" else "tertiary"
    setattr(profile, f"{prefix}_ai_document_status", result["status"])
    setattr(profile, f"{prefix}_ai_document_confidence", result["detection_confidence"])
    setattr(profile, f"{prefix}_ai_document_type", result["document_type"])
    setattr(profile, f"{prefix}_ai_extracted_name", result["fields"].get("name"))
    setattr(profile, f"{prefix}_ai_extracted_id_number", result["fields"].get("id_number"))
    setattr(profile, f"{prefix}_ai_verification_note", " ".join(result["notes"]) or f"{result['document_type'].upper()} AI checks passed.")
    setattr(profile, f"{prefix}_id_number", result["fields"].get("id_number"))


@router.post("/submit")
def submit_kyc(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    profile = _profile(db, current_user.id)
    if not profile.phone or not profile.address or not profile.city:
        raise HTTPException(status_code=400, detail="Complete phone, address and city before submitting KYC.")
    if not profile.id_document_url or not profile.id_number:
        raise HTTPException(status_code=400, detail="Driving licence and driving licence number are mandatory.")

    docs = []
    if profile.secondary_id_type in ALLOWED_SECONDARY_IDS and profile.secondary_id_document_url:
        docs.append(("secondary", profile.secondary_id_type, profile.secondary_id_document_url))
    if profile.tertiary_id_type in ALLOWED_SECONDARY_IDS and profile.tertiary_id_document_url:
        docs.append(("tertiary", profile.tertiary_id_type, profile.tertiary_id_document_url))
    if not docs:
        raise HTTPException(status_code=400, detail="Upload at least one additional identity document: Aadhaar or PAN.")

    try:
        dl_result = _verify_cloudinary_document(profile.id_document_url, "driving_license", current_user.name, profile.id_number, profile.date_of_birth)
        secondary_results = []
        for slot, doc_type, url in docs:
            secondary_results.append((slot, doc_type, _verify_cloudinary_document(url, doc_type, current_user.name)))
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
    profile.ai_verification_note = " ".join(dl_result["notes"]) or "Driving licence cross-verification passed."
    profile.id_number = dl_result["fields"].get("dl_number") or profile.id_number
    profile.date_of_birth = dl_result["fields"].get("dob") or profile.date_of_birth

    for slot, doc_type, result in secondary_results:
        _set_slot(profile, slot, result)

    failed_docs = []
    if dl_result["status"] != "verified":
        failed_docs.append({"document": "driving_license", **dl_result})
    for _, doc_type, result in secondary_results:
        if result["status"] != "verified":
            failed_docs.append({"document": doc_type, **result})

    # Cross-document consistency: every uploaded document must match the account name.
    name_failures = [x for x in [dl_result, *[r for _, _, r in secondary_results]] if x.get("name_match") is False]
    if name_failures:
        failed_docs.append({"document": "cross_document_name_match", "status": "review", "notes": ["Name mismatch detected across uploaded identity documents."]})

    if failed_docs:
        db.commit()
        raise HTTPException(status_code=422, detail={"message": "Cross-verification failed. Correct the mismatched credential or document and submit again.", "documents": failed_docs})

    current_status = (current_user.kyc_status or "unverified").lower()
    if current_status == "verified":
        db.commit()
        return {"message": "Identity is already verified.", "profile": _profile_dict(profile, current_user), "driving_license": dl_result, "documents": [r for _, _, r in secondary_results]}
    if current_status == "under_review":
        db.commit()
        return {"message": "Identity verification is already under review.", "profile": _profile_dict(profile, current_user)}

    current_user.kyc_status = "under_review"
    profile.submitted_at = datetime.utcnow()
    profile.reviewed_at = None
    profile.review_note = None
    db.commit()
    db.refresh(profile)
    return {"message": "All uploaded credentials passed AI and cross-document checks. KYC was submitted for review.", "profile": _profile_dict(profile, current_user), "driving_license": dl_result, "documents": [r for _, _, r in secondary_results]}


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
