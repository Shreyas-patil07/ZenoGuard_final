import os
import re
from typing import Any
from PIL import Image

ROBOFLOW_API_URL = "https://serverless.roboflow.com"
DL_MODEL_ID = os.getenv("ROBOFLOW_DL_MODEL_ID", "indian-driving-licence-reader-rlxel/1")
AADHAAR_MODEL_ID = os.getenv("ROBOFLOW_AADHAAR_MODEL_ID", "")
PAN_MODEL_ID = os.getenv("ROBOFLOW_PAN_MODEL_ID", "")


def _client():
    api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured.")
    try:
        from inference_sdk import InferenceHTTPClient
    except ImportError as exc:
        raise RuntimeError("inference-sdk is not installed. Run: pip install -r requirements.txt") from exc
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
    return [_as_dict(item) for item in _as_dict(result).get("predictions", [])]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def _normalize_id(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", _normalize_text(value))


def _ocr_text(client, image: Image.Image) -> str:
    result = client.ocr_image(inference_input=image)
    return _normalize_text(_as_dict(result).get("result", ""))


def _crop(image: Image.Image, prediction: dict) -> Image.Image | None:
    try:
        x, y = float(prediction["x"]), float(prediction["y"])
        width, height = float(prediction["width"]), float(prediction["height"])
    except (KeyError, TypeError, ValueError):
        return None
    left, top = max(0, int(x - width / 2)), max(0, int(y - height / 2))
    right, bottom = min(image.width, int(x + width / 2)), min(image.height, int(y + height / 2))
    if right <= left or bottom <= top:
        return None
    mx, my = max(8, int((right - left) * .08)), max(8, int((bottom - top) * .12))
    return image.crop((max(0, left - mx), max(0, top - my), min(image.width, right + mx), min(image.height, bottom + my)))


def _best_predictions(predictions: list[dict], aliases: dict[str, set[str]]) -> dict[str, dict]:
    selected = {}
    for prediction in predictions:
        label = str(prediction.get("class") or prediction.get("label") or prediction.get("class_name") or "").strip().lower()
        field = next((name for name, values in aliases.items() if label in values), None)
        if not field:
            continue
        confidence = float(prediction.get("confidence", 0) or 0)
        if field not in selected or confidence > float(selected[field].get("confidence", 0)):
            selected[field] = prediction
    return selected


def _field_ocr(client, image, predictions, aliases):
    selected = _best_predictions(predictions, aliases)
    fields = {}
    for field, prediction in selected.items():
        crop = _crop(image, prediction)
        if crop is not None:
            fields[field] = {"text": _ocr_text(client, crop), "confidence": round(float(prediction.get("confidence", 0) or 0), 4)}
    return fields


def _name_match(extracted: str, expected: str | None) -> bool | None:
    if not expected:
        return None
    a = set(re.findall(r"[A-Z]{2,}", _normalize_text(extracted)))
    b = set(re.findall(r"[A-Z]{2,}", _normalize_text(expected)))
    return None if not a or not b else len(a & b) / max(1, len(b)) >= .5


def _extract_dl_number(text: str) -> str | None:
    compact = _normalize_id(text)
    matches = re.findall(r"[A-Z]{2}\d{11,16}", compact)
    return max(matches, key=len) if matches else None


def _extract_dob(text: str) -> str | None:
    for pattern in (r"\b\d{2}[/-]\d{2}[/-]\d{4}\b", r"\b\d{2}[.]\d{2}[.]\d{4}\b", r"\b\d{4}[/-]\d{2}[/-]\d{2}\b"):
        match = re.search(pattern, text)
        if match:
            parts = match.group(0).replace(".", "/").replace("-", "/").split("/")
            try:
                year, month, day = parts if len(parts[0]) == 4 else (parts[2], parts[1], parts[0])
                return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
            except ValueError:
                return None
    return None


def verify_driving_license(image: Image.Image, expected_name: str | None = None) -> dict:
    client = _client()
    predictions = _predictions(client.infer(image, model_id=DL_MODEL_ID))
    aliases = {"name": {"name"}, "dl_number": {"dl_number", "driving_license_number", "license_number"}, "dob": {"dob", "date_of_birth"}}
    fields = _field_ocr(client, image, predictions, aliases)
    extracted_name = fields.get("name", {}).get("text", "")
    extracted_number = _extract_dl_number(fields.get("dl_number", {}).get("text", ""))
    extracted_dob = _extract_dob(fields.get("dob", {}).get("text", ""))
    confidences = [x["confidence"] for x in fields.values()]
    avg = sum(confidences) / len(confidences) if confidences else 0
    missing = [x for x in aliases if x not in fields]
    number_valid = bool(extracted_number and 13 <= len(extracted_number) <= 18)
    name_match = _name_match(extracted_name, expected_name)
    notes = []
    if missing: notes.append(f"Missing detected fields: {', '.join(missing)}.")
    if not number_valid: notes.append("Driving licence number could not be validated.")
    if not extracted_dob: notes.append("Date of birth could not be read.")
    if name_match is False: notes.append("Document name does not sufficiently match the account name.")
    passed = not missing and number_valid and bool(extracted_dob) and avg >= .55 and name_match is not False
    return {"document_type": "driving_license", "status": "verified" if passed else "review", "model_id": DL_MODEL_ID, "detection_confidence": round(avg, 4), "fields": {"name": extracted_name or None, "dl_number": extracted_number, "dob": extracted_dob}, "field_confidence": fields, "name_match": name_match, "notes": notes, "authenticity_verified": False}


def verify_secondary_document(image: Image.Image, document_type: str, expected_name: str | None = None) -> dict:
    document_type = document_type.lower().strip()
    model_id = AADHAAR_MODEL_ID if document_type == "aadhaar" else PAN_MODEL_ID if document_type == "pan" else ""
    if not model_id:
        raise RuntimeError(f"ROBOFLOW_{document_type.upper()}_MODEL_ID is not configured.")
    client = _client()
    predictions = _predictions(client.infer(image, model_id=model_id))
    number_aliases = {"aadhaar": {"aadhaar", "aadhaar_number", "number", "id_number"}, "pan": {"pan", "pan_number", "number", "id_number"}}[document_type]
    aliases = {"name": {"name", "full_name"}, "id_number": number_aliases}
    fields = _field_ocr(client, image, predictions, aliases)
    extracted_name = fields.get("name", {}).get("text", "")
    raw_number = fields.get("id_number", {}).get("text", "")
    compact = _normalize_id(raw_number)
    if document_type == "aadhaar":
        match = re.search(r"\d{12}", compact)
    else:
        match = re.search(r"[A-Z]{5}\d{4}[A-Z]", compact)
    extracted_number = match.group(0) if match else None
    confidences = [x["confidence"] for x in fields.values()]
    avg = sum(confidences) / len(confidences) if confidences else 0
    name_match = _name_match(extracted_name, expected_name)
    notes = []
    if "name" not in fields: notes.append("Name could not be detected.")
    if not extracted_number: notes.append(f"{document_type.upper()} number could not be validated.")
    if name_match is False: notes.append("Document name does not sufficiently match the account name.")
    passed = "name" in fields and bool(extracted_number) and avg >= .55 and name_match is not False
    return {"document_type": document_type, "status": "verified" if passed else "review", "model_id": model_id, "detection_confidence": round(avg, 4), "fields": {"name": extracted_name or None, "id_number": extracted_number}, "field_confidence": fields, "name_match": name_match, "notes": notes, "authenticity_verified": False}
