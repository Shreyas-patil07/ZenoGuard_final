# ZenoGuard

Unified ZenoGuard application combining the frontend/backend, ML models, and blockchain insurance contracts.

## Structure

- `frontend/` — React/Vite application
- `backend/` — FastAPI application
- `backend/models/` — local YOLO11s KYC document detectors
- `ml/` — premium and claim/fraud models
- `blockchain/` — Solidity/Hardhat insurance contracts

## KYC document AI

The KYC flow is connected end-to-end through the FastAPI backend. The authenticated frontend uploads the driving licence and one additional government ID (Aadhaar or PAN) to the backend. The backend stores the images in Cloudinary and runs AI verification only when the user submits KYC.

The local YOLO11s detectors are:

- Driving licence: detects `name`, `dl_no`, and `dob`.
- Aadhaar: detects `name`, `Aadhar_number`, and `fake`.
- PAN: detects `name`, `father-s_name`, and `pan_number`.

The backend crops detected fields and runs OCR, validates the extracted identifiers, checks account-name consistency, and records the result in the rider KYC profile. A detected `fake` indicator on Aadhaar/PAN forces the document into review.

Place the trained weights in `backend/models/`:

```text
backend/models/dl_detector.pt
backend/models/aadhaar_detector.pt
backend/models/pan_detector.pt
```

`ultralytics` and `pytesseract` are backend dependencies. Roboflow remains optional: when `ROBOFLOW_API_KEY` is configured, its OCR is preferred; otherwise local Tesseract OCR is used. The Roboflow API key is never sent to the frontend.

Set these backend environment variables when needed:

```env
KYC_DL_MODEL_PATH=backend/models/dl_detector.pt
KYC_AADHAAR_MODEL_PATH=backend/models/aadhaar_detector.pt
KYC_PAN_MODEL_PATH=backend/models/pan_detector.pt
KYC_MODEL_DEVICE=cpu
KYC_MODEL_IMGSZ=640
KYC_MODEL_CONF=0.25
```

The automated check validates detected fields, basic document-number formats, image quality, and account-name consistency. It is **not** an authoritative government authenticity check.

Then run:

```bash
pip install -r backend/requirements.txt
python backend/scripts/migrate_postgres.py
```
