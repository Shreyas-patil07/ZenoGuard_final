"""
Evidence upload router.
Accepts an image (jpg/png/webp) or PDF, extracts images from the PDF if needed,
and runs a basic image-quality check (blur, brightness, resolution).
Returns a quality report so the frontend can warn the user before submitting.
"""

import io
import math
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

# PIL is part of Pillow
try:
    from PIL import Image, ImageStat
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# pypdf for PDF extraction
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

router = APIRouter(prefix="/upload", tags=["upload"])

# ── constants ──────────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = 10
ALLOWED_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "application/pdf",
}
MIN_WIDTH = 400
MIN_HEIGHT = 400
BLUR_THRESHOLD = 80.0      # variance of Laplacian proxy; below this → blurry
DARK_THRESHOLD = 40.0      # mean brightness 0-255; below this → too dark
BRIGHT_THRESHOLD = 220.0   # mean brightness; above this → over-exposed


# ── helpers ───────────────────────────────────────────────────────────────────

def _laplacian_variance(gray: "Image.Image") -> float:
    """
    Approximate Laplacian variance without numpy/cv2.
    Uses PIL's filter to compute edge energy as a blur proxy.
    """
    from PIL import ImageFilter
    edges = gray.filter(ImageFilter.FIND_EDGES)
    stat = ImageStat.Stat(edges)
    return stat.var[0]


def _assess_image(img: "Image.Image") -> dict:
    """Return a quality dict for a single PIL Image."""
    issues = []
    suggestions = []

    w, h = img.size
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        issues.append(f"Resolution too low ({w}×{h}px). Minimum is {MIN_WIDTH}×{MIN_HEIGHT}px.")
        suggestions.append("Use a higher-resolution photo or move the camera closer.")

    gray = img.convert("L")

    # Brightness
    stat = ImageStat.Stat(gray)
    mean_brightness = stat.mean[0]
    if mean_brightness < DARK_THRESHOLD:
        issues.append(f"Image is too dark (brightness {mean_brightness:.0f}/255).")
        suggestions.append("Take the photo in better lighting or increase brightness.")
    elif mean_brightness > BRIGHT_THRESHOLD:
        issues.append(f"Image is over-exposed (brightness {mean_brightness:.0f}/255).")
        suggestions.append("Avoid pointing directly at bright light sources.")

    # Blur (Laplacian variance proxy)
    blur_score = _laplacian_variance(gray)
    if blur_score < BLUR_THRESHOLD:
        issues.append(f"Image appears blurry (sharpness score {blur_score:.1f}).")
        suggestions.append("Hold the camera steady and ensure the subject is in focus.")

    quality = "good" if not issues else ("acceptable" if len(issues) == 1 else "poor")

    return {
        "width": w,
        "height": h,
        "mean_brightness": round(mean_brightness, 1),
        "sharpness_score": round(blur_score, 1),
        "quality": quality,
        "issues": issues,
        "suggestions": suggestions,
    }


def _images_from_pdf(data: bytes) -> list["Image.Image"]:
    """Extract embedded images from a PDF using pypdf."""
    images: list[Image.Image] = []
    reader = pypdf.PdfReader(io.BytesIO(data))
    for page in reader.pages:
        if "/Resources" not in page:
            continue
        resources = page["/Resources"]
        if "/XObject" not in resources:
            continue
        x_objects = resources["/XObject"].get_object()
        for name in x_objects:
            obj = x_objects[name].get_object()
            if obj.get("/Subtype") == "/Image":
                try:
                    img_data = obj.get_data()
                    img = Image.open(io.BytesIO(img_data))
                    images.append(img.convert("RGB"))
                except Exception:
                    pass
    return images


# ── route ─────────────────────────────────────────────────────────────────────

@router.post("/evidence", status_code=status.HTTP_200_OK)
async def upload_evidence(file: Annotated[UploadFile, File(description="Image (jpg/png/webp) or PDF")]):
    """
    Upload incident evidence and receive an image-quality report.
    The file is NOT stored – quality is assessed in memory and the report
    is returned so the frontend can decide whether to proceed.
    """
    if not PIL_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image processing library (Pillow) is not installed on the server.",
        )

    # ── MIME check ────────────────────────────────────────────────────────────
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Please upload a JPG, PNG, WebP, or PDF.",
        )

    # ── Size check ────────────────────────────────────────────────────────────
    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {size_mb:.1f} MB exceeds the {MAX_FILE_SIZE_MB} MB limit.",
        )

    # ── Process ───────────────────────────────────────────────────────────────
    if "pdf" in content_type:
        if not PYPDF_AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PDF processing library (pypdf) is not installed on the server.",
            )
        images = _images_from_pdf(raw)
        if not images:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No images were found inside the PDF. Please upload a PDF that contains at least one photo of the incident.",
            )
        # Assess each extracted image, report on the best one
        reports = [_assess_image(img) for img in images]
        # Pick the one with the fewest issues
        best = min(reports, key=lambda r: len(r["issues"]))
        return JSONResponse({
            "file_type": "pdf",
            "images_found": len(images),
            "best_image_report": best,
            "all_reports": reports,
        })
    else:
        try:
            img = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not read the image file. Please ensure it is a valid image.",
            )
        report = _assess_image(img)
        return JSONResponse({
            "file_type": "image",
            "images_found": 1,
            "best_image_report": report,
            "all_reports": [report],
        })
