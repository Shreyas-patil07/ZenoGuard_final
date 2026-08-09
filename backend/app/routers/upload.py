import io
import os

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageStat
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RiderProfile
from ..routers.auth import get_current_user
from ..services.document_verification import verify_driving_license

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

router = APIRouter(prefix="/upload", tags=["upload"])
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def _cloudinary_ready():
    return all(os.getenv(key) for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"))


async def _read_image(file: UploadFile):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WebP image.")
    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB limit.")
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid image file.") from exc
    return raw, image


def _quality(image):
    gray = image.convert("L")
    brightness = ImageStat.Stat(gray).mean[0]
    edges = gray.filter(ImageFilter.FIND_EDGES)
    sharpness = ImageStat.Stat(edges).var[0]
    issues = []
    if image.width < 400 or image.height < 400:
        issues.append("Resolution is below the recommended 400×400px minimum.")
    if brightness < 40:
        issues.append("Image is too dark.")
    elif brightness > 220:
        issues.append("Image is over-exposed.")
    if sharpness < 80:
        issues.append("Image may be blurry.")
    return brightness, sharpness, issues


async def _upload(file: UploadFile, folder: str):
    raw, image = await _read_image(file)
    if not _cloudinary_ready():
        raise HTTPException(status_code=503, detail="Cloudinary is not configured on the backend.")
    try:
        result = cloudinary.uploader.upload(io.BytesIO(raw), folder=folder, resource_type="image", overwrite=False)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Cloudinary upload failed.") from exc
    brightness, sharpness, issues = _quality(image)
    return {
        "filename": file.filename,
        "size_bytes": len(raw),
        "width": image.width,
        "height": image.height,
        "brightness": round(brightness, 1),
        "sharpness": round(sharpness, 1),
        "quality": "good" if not issues else "review",
        "issues": issues,
        "cloudinary_url": result.get("secure_url", ""),
        "public_id": result.get("public_id", ""),
    }


@router.post("/evidence")
async def upload_evidence(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    result = await _upload(file, "zenoguard/evidence")
    return {"file_type": "image", **result}


@router.post("/kyc-document")
async def upload_kyc_document(file: UploadFile = File(...), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if (current_user.kyc_status or "unverified").lower() in {"verified", "under_review"}:
        raise HTTPException(status_code=409, detail="Identity documents cannot be changed after submission.")

    raw, image = await _read_image(file)
    profile = db.query(RiderProfile).filter(RiderProfile.rider_id == current_user.id).first()
    if not profile:
        profile = RiderProfile(rider_id=current_user.id)
        db.add(profile)
        db.flush()

    brightness, sharpness, quality_issues = _quality(image)
    if quality_issues:
        raise HTTPException(status_code=422, detail="Image quality is not sufficient for document verification: " + " ".join(quality_issues))

    id_type = (profile.id_type or "driving_license").strip().lower()
    if id_type != "driving_license":
        raise HTTPException(status_code=422, detail="AI document verification currently supports driving licences. Select Driving licence for this upload.")

    try:
        verification = verify_driving_license(image, expected_name=current_user.name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail="Document AI verification failed. Please try a clearer image.") from exc

    if verification["status"] != "verified":
        db.rollback()
        return {
            "document_type": "identity",
            "uploaded": False,
            "verification": verification,
            "message": "Document needs review. Upload a clearer, unobstructed driving licence image.",
        }

    if verification["fields"].get("dl_number"):
        profile.id_number = verification["fields"]["dl_number"]
    if verification["fields"].get("dob"):
        profile.date_of_birth = verification["fields"]["dob"]
    profile.ai_document_status = verification["status"]
    profile.ai_document_confidence = verification["detection_confidence"]
    profile.ai_document_type = verification["document_type"]
    profile.ai_extracted_name = verification["fields"].get("name")
    profile.ai_extracted_dob = verification["fields"].get("dob")
    profile.ai_extracted_id_number = verification["fields"].get("dl_number")
    profile.ai_verification_note = " ".join(verification["notes"]) or "AI document checks passed."

    if not _cloudinary_ready():
        raise HTTPException(status_code=503, detail="Cloudinary is not configured on the backend.")
    try:
        cloudinary_result = cloudinary.uploader.upload(io.BytesIO(raw), folder=f"zenoguard/kyc/{current_user.id}", resource_type="image", overwrite=False)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail="Cloudinary upload failed.") from exc

    profile.id_document_url = cloudinary_result.get("secure_url", "")
    db.commit()
    db.refresh(profile)

    return {
        "document_type": "identity",
        "uploaded": True,
        "filename": file.filename,
        "size_bytes": len(raw),
        "width": image.width,
        "height": image.height,
        "brightness": round(brightness, 1),
        "sharpness": round(sharpness, 1),
        "quality": "good",
        "cloudinary_url": profile.id_document_url,
        "verification": verification,
        "message": "Driving licence passed the automated document AI checks.",
    }


@router.post("/kyc-selfie")
async def upload_kyc_selfie(file: UploadFile = File(...), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if (current_user.kyc_status or "unverified").lower() in {"verified", "under_review"}:
        raise HTTPException(status_code=409, detail="Identity documents cannot be changed after submission.")
    result = await _upload(file, f"zenoguard/kyc/{current_user.id}")
    profile = db.query(RiderProfile).filter(RiderProfile.rider_id == current_user.id).first()
    if not profile:
        profile = RiderProfile(rider_id=current_user.id)
        db.add(profile)
    profile.selfie_url = result["cloudinary_url"]
    db.commit()
    return {"document_type": "selfie", **result}
