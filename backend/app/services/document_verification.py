import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "dl_detector.pt"
MODEL_NAME = "dl_detector"
CONFIDENCE_THRESHOLD = 0.55

_DL_MODEL = None


def _load_dl_model():
    global _DL_MODEL
    if _DL_MODEL is not None:
        return _DL_MODEL

    if not MODEL_PATH.exists():
        raise RuntimeError(f"Driving licence model not found: {MODEL_PATH}")

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError("Ultralytics is not installed on the backend.") from exc

    try:
        _DL_MODEL = YOLO(str(MODEL_PATH))
    except Exception as exc:
        raise RuntimeError("Driving licence model could not be loaded.") from exc

    return _DL_MODEL


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def _normalize_id(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", _normalize_text(value))


def _label(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def _predict(image: Image.Image) -> list[dict]:
    model = _load_dl_model()

    try:
        results = model.predict(
            source=image,
            imgsz=640,
            conf=0.25,
            device="cpu",
            verbose=False,
            save=False,
        )
    except Exception as exc:
        raise RuntimeError("Driving licence model inference failed.") from exc

    if not results:
        return []

    result = results[0]
    names = result.names or {}
    predictions: list[dict] = []

    if result.boxes is None:
        return predictions

    for box in result.boxes:
        try:
            cls_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
        except Exception:
            continue

        label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
        predictions.append(
            {
                "class": label,
                "confidence": confidence,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
            }
        )

    return predictions


def _tesseract_ocr(image: Image.Image) -> str:
    try:
        import pytesseract
        from pytesseract import TesseractNotFoundError
    except ImportError as exc:
        raise RuntimeError("pytesseract is not installed on the backend.") from exc

    try:
        image = ImageOps.grayscale(image)
        image = ImageOps.autocontrast(image)
        image = image.resize((max(image.width * 2, 1200), max(image.height * 2, 600)))
        image = image.filter(ImageFilter.SHARPEN)
        image = ImageEnhance.Contrast(image).enhance(1.5)
        return _normalize_text(pytesseract.image_to_string(image, config="--psm 6"))
    except TesseractNotFoundError as exc:
        raise RuntimeError("Tesseract OCR is not installed on the Render service.") from exc


def _crop(image: Image.Image, prediction: dict) -> Image.Image | None:
    try:
        left = int(prediction["x1"])
        top = int(prediction["y1"])
        right = int(prediction["x2"])
        bottom = int(prediction["y2"])
    except (KeyError, TypeError, ValueError):
        return None

    left = max(0, left)
    top = max(0, top)
    right = min(image.width, right)
    bottom = min(image.height, bottom)

    if right <= left or bottom <= top:
        return None

    mx = max(8, int((right - left) * 0.10))
    my = max(8, int((bottom - top) * 0.15))
    return image.crop(
        (
            max(0, left - mx),
            max(0, top - my),
            min(image.width, right + mx),
            min(image.height, bottom + my),
        )
    )


def _best_predictions(predictions: list[dict]) -> dict[str, dict]:
    aliases = {
        "name": {"name", "fullname", "full_name", "fname", "holdername"},
        "dl_number": {
            "dlno",
            "dl_number",
            "drivinglicensenumber",
            "licensenumber",
            "drivinglicenseno",
        },
        "dob": {"dob", "dateofbirth", "date_of_birth"},
    }
    normalized_aliases = {field: {_label(x) for x in values} for field, values in aliases.items()}
    selected: dict[str, dict] = {}

    for prediction in predictions:
        label = _label(str(prediction.get("class", "")))
        field = next((name for name, values in normalized_aliases.items() if label in values), None)
        if not field:
            continue

        confidence = float(prediction.get("confidence", 0) or 0)
        if field not in selected or confidence > float(selected[field].get("confidence", 0) or 0):
            selected[field] = prediction

    return selected


def _extract_dl_number(text: str) -> str | None:
    compact = _normalize_id(text)
    patterns = (
        r"[A-Z]{2}\d{11,16}",
        r"[A-Z]{2}\d{2}\d{4}\d{4,8}",
    )
    matches: list[str] = []
    for pattern in patterns:
        matches.extend(re.findall(pattern, compact))
    return max(matches, key=len) if matches else None


def _extract_dob(text: str) -> str | None:
    for pattern in (
        r"\b\d{2}[/-]\d{2}[/-]\d{4}\b",
        r"\b\d{2}[.]\d{2}[.]\d{4}\b",
        r"\b\d{4}[/-]\d{2}[/-]\d{2}\b",
    ):
        match = re.search(pattern, text)
        if not match:
            continue

        parts = match.group(0).replace(".", "/").replace("-", "/").split("/")
        try:
            year, month, day = parts if len(parts[0]) == 4 else (parts[2], parts[1], parts[0])
            return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
        except ValueError:
            return None

    return None


def _name_match(extracted: str, expected: str | None) -> bool | None:
    if not expected:
        return None

    actual = set(re.findall(r"[A-Z]{2,}", _normalize_text(extracted)))
    target = set(re.findall(r"[A-Z]{2,}", _normalize_text(expected)))
    return None if not actual or not target else len(actual & target) / max(1, len(target)) >= 0.5


def verify_driving_license(
    image: Image.Image,
    expected_name: str | None = None,
    expected_dl_number: str | None = None,
    expected_dob: str | None = None,
) -> dict[str, Any]:
    """Verify the uploaded Driving Licence using only local dl_detector + OCR."""
    predictions = _predict(image)
    selected = _best_predictions(predictions)
    detected_fields: dict[str, dict] = {}

    for field, prediction in selected.items():
        crop = _crop(image, prediction)
        if crop is None:
            continue

        text = _tesseract_ocr(crop)
        detected_fields[field] = {
            "text": text,
            "confidence": round(float(prediction.get("confidence", 0) or 0), 4),
        }

    full_text = _tesseract_ocr(image)

    extracted_name = detected_fields.get("name", {}).get("text", "")
    extracted_number = (
        _extract_dl_number(detected_fields.get("dl_number", {}).get("text", ""))
        or _extract_dl_number(full_text)
    )
    extracted_dob = (
        _extract_dob(detected_fields.get("dob", {}).get("text", ""))
        or _extract_dob(full_text)
    )

    if not extracted_name:
        extracted_name = full_text

    confidences = [float(item["confidence"]) for item in detected_fields.values()]
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    name_match = _name_match(extracted_name, expected_name)
    entered_number = _normalize_id(expected_dl_number or "")
    detected_number = _normalize_id(extracted_number or "")
    dl_number_match = bool(entered_number and detected_number and entered_number == detected_number)
    dob_match = None if not expected_dob or not extracted_dob else expected_dob == extracted_dob

    notes: list[str] = []
    if not predictions:
        notes.append("The Driving Licence detector found no fields.")
    if "name" not in detected_fields:
        notes.append("Name field was not detected; full-document OCR was used as fallback.")
    if "dl_number" not in detected_fields:
        notes.append("Driving licence number field was not detected; full-document OCR was used as fallback.")
    if "dob" not in detected_fields:
        notes.append("Date of birth field was not detected; full-document OCR was used as fallback.")
    if not extracted_number:
        notes.append("Driving licence number could not be read.")
    if expected_dl_number and not dl_number_match:
        notes.append("Entered driving licence number does not match the uploaded licence.")
    if not extracted_dob:
        notes.append("Date of birth could not be read.")
    if dob_match is False:
        notes.append("Date of birth does not match the stored profile value.")
    if name_match is False:
        notes.append("Document name does not match the account name.")
    if average_confidence < CONFIDENCE_THRESHOLD:
        notes.append("Document detection confidence is below the verification threshold.")

    passed = (
        bool(extracted_number)
        and bool(extracted_dob)
        and dl_number_match
        and name_match is not False
        and dob_match is not False
        and average_confidence >= CONFIDENCE_THRESHOLD
    )

    return {
        "document_type": "driving_license",
        "status": "verified" if passed else "review",
        "model_id": MODEL_NAME,
        "model_path": str(MODEL_PATH),
        "detection_confidence": round(average_confidence, 4),
        "fields": {
            "name": extracted_name or None,
            "dl_number": extracted_number,
            "dob": extracted_dob,
        },
        "field_confidence": detected_fields,
        "name_match": name_match,
        "dl_number_match": dl_number_match,
        "dob_match": dob_match,
        "notes": notes,
        "authenticity_verified": False,
    }
