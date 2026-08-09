import os
import re
from typing import Any

from PIL import Image

ROBOFLOW_API_URL = "https://serverless.roboflow.com"
DL_MODEL_ID = os.getenv(
    "ROBOFLOW_DL_MODEL_ID",
    "indian-driving-licence-reader-rlxel/1",
)

REQUIRED_CLASSES = ("name", "dl_number", "dob")


def _client():
    api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured.")
    try:
        from inference_sdk import InferenceHTTPClient
    except ImportError as exc:
        raise RuntimeError(
            "inference-sdk is not installed. Run: pip install -r requirements.txt"
        ) from exc

    return InferenceHTTPClient(api_url=ROBOFLOW_API_URL, api_key=api_key)


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return {}


def _predictions(result: Any) -> list[dict]:
    data = _as_dict(result)
    return [_as_dict(item) for item in data.get("predictions", [])]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def _normalize_id(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", _normalize_text(value))


def _looks_like_dl(value: str) -> bool:
    normalized = _normalize_id(value)
    return bool(13 <= len(normalized) <= 18 and re.fullmatch(r"[A-Z]{2}\d{11,16}", normalized))


def _ocr_text(client, image: Image.Image) -> str:
    result = client.ocr_image(inference_input=image)
    data = _as_dict(result)
    return _normalize_text(data.get("result", ""))


def _crop(image: Image.Image, prediction: dict) -> Image.Image | None:
    try:
        x = float(prediction["x"])
        y = float(prediction["y"])
        width = float(prediction["width"])
        height = float(prediction["height"])
    except (KeyError, TypeError, ValueError):
        return None

    left = max(0, int(x - width / 2))
    top = max(0, int(y - height / 2))
    right = min(image.width, int(x + width / 2))
    bottom = min(image.height, int(y + height / 2))
    if right <= left or bottom <= top:
        return None

    margin_x = max(8, int((right - left) * 0.08))
    margin_y = max(8, int((bottom - top) * 0.12))
    return image.crop((max(0, left - margin_x), max(0, top - margin_y), min(image.width, right + margin_x), min(image.height, bottom + margin_y)))


def _best_predictions(predictions: list[dict]) -> dict[str, dict]:
    selected: dict[str, dict] = {}
    for prediction in predictions:
        label = str(prediction.get("class") or prediction.get("label") or prediction.get("class_name") or "").strip().lower()
        confidence = float(prediction.get("confidence", 0.0) or 0.0)
        if label not in REQUIRED_CLASSES:
            continue
        if label not in selected or confidence > float(selected[label].get("confidence", 0.0)):
            selected[label] = prediction
    return selected


def _extract_dl_number(raw_text: str) -> str | None:
    compact = re.sub(r"[^A-Z0-9]", "", raw_text.upper())
    matches = re.findall(r"[A-Z]{2}\d{11,16}", compact)
    return max(matches, key=len) if matches else None


def _extract_dob(raw_text: str) -> str | None:
    for pattern in (r"\b\d{2}[/-]\d{2}[/-]\d{4}\b", r"\b\d{2}[.]\d{2}[.]\d{4}\b", r"\b\d{4}[/-]\d{2}[/-]\d{2}\b"):
        match = re.search(pattern, raw_text)
        if not match:
            continue
        value = match.group(0).replace(".", "/").replace("-", "/")
        parts = value.split("/")
        try:
            if len(parts[0]) == 4:
                year, month, day = parts
            else:
                day, month, year = parts
            return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
        except (TypeError, ValueError):
            return None
    return None


def _name_match(extracted: str, expected: str) -> bool | None:
    extracted_tokens = set(re.findall(r"[A-Z]{2,}", _normalize_text(extracted)))
    expected_tokens = set(re.findall(r"[A-Z]{2,}", _normalize_text(expected)))
    if not extracted_tokens or not expected_tokens:
        return None
    return len(extracted_tokens & expected_tokens) / max(1, len(expected_tokens)) >= 0.5


def verify_driving_license(image: Image.Image, expected_name: str | None = None) -> dict:
    client = _client()
    predictions = _predictions(client.infer(image, model_id=DL_MODEL_ID))
    selected = _best_predictions(predictions)

    fields: dict[str, dict] = {}
    for field in REQUIRED_CLASSES:
        prediction = selected.get(field)
        if not prediction:
            continue
        crop = _crop(image, prediction)
        if crop is None:
            continue
        fields[field] = {
            "text": _ocr_text(client, crop),
            "confidence": round(float(prediction.get("confidence", 0.0) or 0.0), 4),
        }

    extracted_name = fields.get("name", {}).get("text", "")
    extracted_number = _extract_dl_number(fields.get("dl_number", {}).get("text", ""))
    extracted_dob = _extract_dob(fields.get("dob", {}).get("text", ""))
    confidences = [item["confidence"] for item in fields.values() if item.get("confidence") is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    missing = [field for field in REQUIRED_CLASSES if field not in fields]
    number_valid = bool(extracted_number and _looks_like_dl(extracted_number))
    name_matches = _name_match(extracted_name, expected_name) if expected_name else None

    notes = []
    if missing:
        notes.append(f"Missing detected fields: {', '.join(missing)}.")
    if not number_valid:
        notes.append("Driving licence number could not be validated.")
    if not extracted_dob:
        notes.append("Date of birth could not be read.")
    if name_matches is False:
        notes.append("Document name does not sufficiently match the account name.")

    passed = not missing and number_valid and bool(extracted_dob) and avg_confidence >= 0.55 and name_matches is not False
    return {
        "document_type": "driving_license",
        "status": "verified" if passed else "review",
        "model_id": DL_MODEL_ID,
        "detection_confidence": round(avg_confidence, 4),
        "fields": {"name": extracted_name or None, "dl_number": extracted_number, "dob": extracted_dob},
        "field_confidence": fields,
        "name_match": name_matches,
        "notes": notes,
        "authenticity_verified": False,
    }
