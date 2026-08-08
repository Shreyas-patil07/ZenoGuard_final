import io
import os

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageStat

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


@router.post("/evidence")
async def upload_evidence(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WebP image.")

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Evidence file exceeds the 10 MB limit.")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid image file.") from exc

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

    if not os.getenv("CLOUDINARY_CLOUD_NAME") or not os.getenv("CLOUDINARY_API_KEY") or not os.getenv("CLOUDINARY_API_SECRET"):
        raise HTTPException(status_code=503, detail="Cloudinary is not configured on the backend.")

    try:
        upload_result = cloudinary.uploader.upload(
            io.BytesIO(raw),
            folder="zenoguard/evidence",
            resource_type="image",
            overwrite=False,
        )
        cloudinary_url = upload_result.get("secure_url", "")
        public_id = upload_result.get("public_id", "")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Cloudinary upload failed.") from exc

    return {
        "file_type": "image",
        "filename": file.filename,
        "size_bytes": len(raw),
        "width": image.width,
        "height": image.height,
        "brightness": round(brightness, 1),
        "sharpness": round(sharpness, 1),
        "quality": "good" if not issues else "review",
        "issues": issues,
        "cloudinary_url": cloudinary_url,
        "public_id": public_id,
    }
