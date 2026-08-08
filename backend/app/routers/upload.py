import io
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageStat

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
        "note": "Evidence remains off-chain; this endpoint performs quality pre-check only.",
    }
