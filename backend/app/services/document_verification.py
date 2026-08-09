import base64
import io
import os
import re
from typing import Any

import requests
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROBOFLOW_API_URL = "https://detect.roboflow.com"
DL_MODEL_ID = os.getenv("ROBOFLOW_DL_MODEL_ID", "indian-driving-licence-reader-rlxel/1")


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def _normalize_id(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", _normalize_text(value))


def _label(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def _roboflow_predictions(image: Image.Image) -> list[dict]:
    api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured on the backend.")

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    try:
        response = requests.post(
            f"{ROBOFLOW_API_URL}/{DL_MODEL_ID}",
            params={"api_key": api_key},
            data=encoded,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=45,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise RuntimeError("Driving licence AI service could not be reached.") from exc
    except ValueError as exc:
        raise RuntimeError("Driving licence AI service returned an invalid response.") from exc

    predictions = payload.get("predictions") or []
    if not isinstance(predictions, list):
        raise RuntimeError("Driving licence AI response did not contain predictions.")
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
        x, y = float(prediction["x"]), float(prediction["y"])
        width, height = float(prediction["width"]), float(prediction["height"])
    except (KeyError, TypeError, ValueError):
        return None

    left = max(0, int(x - width / 2))
    top = max(0, int(y - height / 2))
    right = min(image.width, int(x + width / 2))
    bottom = min(image.height, int(y + height / 2))
    if right <= left or bottom <= top:
        return None

    mx = max(8, int((right - left) * 0.10))
    my = max(8, int((bottom - top) * 0.15))
    return image.crop((max(0, left - mx), max(0, top - my), min(image.width, right + mx), min(image.height, bottom + my)))


def _best_predictions(predictions: list[dict]) -> dict[str, dict]:
    aliases = {
        "name": {"name", "fullname", "full_name"},
        "dl_number": {"dlno", "dl_number", "drivinglicensenumber", "licensenumber"},
        "dob": {"dob", "dateofbirth", "date_of_birth"},
    }
    normalized_aliases = {field: {_label(x) for x in values} for field, values in aliases.items()}
    selected: dict[str, dict] = {}

    for prediction in predictions:
        label = _label(str(prediction.get("class") or prediction.get("label") or prediction.get("class_name") or ""))
        field = next((name for name, values in normalized_aliases.items() if label in values), None)
        if not field:
            continue
        confidence = float(prediction.get("confidence", 0) or 0)
        if field not in selected or confidence > float(selected[field].get("confidence", 0) or 0):
            selected[field] = prediction
    return selected


def _extract_dl_number(text: str) -> str | None:
    compact = _normalize_id(text)
    patterns = [
        r"[A-Z]{2}\d{11,16}",
        r"[A-Z]{2}\d{2}\d{4}\d{4,8}",
    ]
    matches = []
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
    a = set(re.findall(r"[A-Z]{2,}", _normalize_text(extracted)))
    b = set(re.findall(r"[A-Z]{2,}", _normalize_text(expected)))
    return None if not a or not b else len(a & b) / max(1, len(b)) >= 0.5


def verify_driving_license(
    image: Image.Image,
    expected_name: str | None = None,
    expected_dl_number: str | None = None,
    expected_dob: str | None = None,
) -> dict[str, Any]:
    predictions = _roboflow_predictions(image)
    selected = _best_predictions(predictions)
    fields: dict[str, dict] = {}

    for field, prediction in selected.items():
        crop = _crop(image, prediction)
        if crop is not None:
            text = _tesseract_ocr(crop)
            fields[field] = {
                "text": text,
                "confidence": round(float(prediction.get("confidence", 0) or 0), 4),
            }

    # Full-document OCR is a fallback for layouts where the detector misses a field.
    full_text = _tesseract_ocr(image)
    extracted_name = fields.get("name", {}).get("text", "")
    extracted_number = _extract_dl_number(fields.get("dl_number", {}).get("text", "")) or _extract_dl_number(full_text)
    extracted_dob = _extract_dob(fields.get("dob", {}).get("text", "")) or _extract_dob(full_text)

    if not extracted_name:
        extracted_name = full_text

    confidences = [float(item["confidence"]) for item in fields.values()]
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    name_match = _name_match(extracted_name, expected_name)
    entered_number = _normalize_id(expected_dl_number or "")
    detected_number = _normalize_id(extracted_number or "")
    dl_number_match = bool(entered_number and detected_number and entered_number == detected_number)
    dob_match = None if not expected_dob or not extracted_dob else expected_dob == extracted_dob

    notes: list[str] = []
    if "name" not in fields:
        notes.append("Name field was not detected; full-document OCR was used as fallback.")
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
    if average_confidence < 0.55:
        notes.append("Document detection confidence is below the verification threshold.")

    passed = (
        bool(extracted_number)
        and bool(extracted_dob)
        and dl_number_match
        and name_match is not False
        and dob_match is not False
        and average_confidence >= 0.55
    )

    return {
        "document_type": "driving_license",
        "status": "verified" if passed else "review",
        "model_id": DL_MODEL_ID,
        "detection_confidence": round(average_confidence, 4),
        "fields": {
            "name": extracted_name or None,
            "dl_number": extracted_number,
            "dob": extracted_dob,
        },
        "field_confidence": fields,
        "name_match": name_match,
        "dl_number_match": dl_number_match,
        "dob_match": dob_match,
        "notes": notes,
        "authenticity_verified": False,
    }
