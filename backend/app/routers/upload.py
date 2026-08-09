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

load_dotenv()
cloudinary.config(cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"), api_key=os.getenv("CLOUDINARY_API_KEY"), api_secret=os.getenv("CLOUDINARY_API_SECRET"), secure=True)
router = APIRouter(prefix="/upload", tags=["upload"])
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_SECONDARY = {"aadhaar", "pan"}


def _cloudinary_ready():
    return all(os.getenv(key) for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"))


async def _read_image(file: UploadFile):
    if (file.content_type or "").lower() not in ALLOWED:
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
    sharpness = ImageStat.Stat(gray.filter(ImageFilter.FIND_EDGES)).var[0]
    issues = []
    if image.width < 400 or image.height < 400: issues.append("Resolution is below the recommended 400×400px minimum.")
    if brightness < 40: issues.append("Image is too dark.")
    elif brightness > 220: issues.append("Image is over-exposed.")
    if sharpness < 80: issues.append("Image may be blurry.")
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
    return {"filename": file.filename, "size_bytes": len(raw), "width": image.width, "height": image.height, "brightness": round(brightness, 1), "sharpness": round(sharpness, 1), "quality": "good" if not issues else "review", "issues": issues, "cloudinary_url": result.get("secure_url", ""), "public_id": result.get("public_id", "")}


@router.post("/evidence")
async def upload_evidence(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    return {"file_type": "image", **await _upload(file, "zenoguard/evidence")}


@router.post("/kyc-document")
async def upload_kyc_document(file: UploadFile = File(...), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if (current_user.kyc_status or "unverified").lower() in {"verified", "under_review"}:
        raise HTTPException(status_code=409, detail="Identity documents cannot be changed after submission.")
    result = await _upload(file, f"zenoguard/kyc/{current_user.id}/driving-license")
    profile = db.query(RiderProfile).filter(RiderProfile.rider_id == current_user.id).first()
    if not profile:
        profile = RiderProfile(rider_id=current_user.id)
        db.add(profile)
    profile.id_type = "driving_license"
    profile.id_document_url = result["cloudinary_url"]
    profile.ai_document_status = "uploaded"
    profile.ai_document_type = "driving_license"
    profile.ai_document_confidence = None
    profile.ai_extracted_name = None
    profile.ai_extracted_dob = None
    profile.ai_extracted_id_number = None
    profile.ai_verification_note = "Saved. AI verification runs only when KYC is submitted."
    db.commit()
    db.refresh(profile)
    return {"document_type": "driving_license", "uploaded": True, "verification_status": "pending_submit", **result, "message": "Driving licence saved. Verification will run when you submit KYC."}


@router.post("/kyc-secondary")
async def upload_kyc_secondary(file: UploadFile = File(...), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if (current_user.kyc_status or "unverified").lower() in {"verified", "under_review"}:
        raise HTTPException(status_code=409, detail="Identity documents cannot be changed after submission.")
    profile = db.query(RiderProfile).filter(RiderProfile.rider_id == current_user.id).first()
    if not profile:
        profile = RiderProfile(rider_id=current_user.id)
        db.add(profile)
    secondary_type = (profile.secondary_id_type or "").lower()
    if secondary_type not in ALLOWED_SECONDARY:
        raise HTTPException(status_code=422, detail="Choose Aadhaar or PAN before uploading the additional document.")
    result = await _upload(file, f"zenoguard/kyc/{current_user.id}/{secondary_type}")
    profile.secondary_id_document_url = result["cloudinary_url"]
    profile.secondary_ai_document_status = "uploaded"
    profile.secondary_ai_document_type = secondary_type
    profile.secondary_ai_document_confidence = None
    profile.secondary_ai_extracted_name = None
    profile.secondary_ai_extracted_id_number = None
    profile.secondary_ai_verification_note = "Saved. AI verification runs only when KYC is submitted."
    db.commit()
    db.refresh(profile)
    return {"document_type": secondary_type, "uploaded": True, "verification_status": "pending_submit", **result, "message": f"{secondary_type.upper()} document saved. Verification will run when you submit KYC."}


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
