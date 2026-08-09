# ZenoGuard

Unified ZenoGuard application combining the frontend/backend, ML models, and blockchain insurance contracts.

## Structure

- `frontend/` — React/Vite application
- `backend/` — FastAPI application
- `ml/` — premium and claim/fraud models
- `blockchain/` — Solidity/Hardhat insurance contracts

## KYC document AI

Driving-licence uploads run through the Roboflow `indian-driving-licence-reader-rlxel/1` detector and Roboflow DocTR OCR on the FastAPI backend. The frontend never receives the Roboflow API key.

Set these backend environment variables before testing:

```env
ROBOFLOW_API_KEY=your_key
ROBOFLOW_DL_MODEL_ID=indian-driving-licence-reader-rlxel/1
```

Then run:

```bash
pip install -r requirements.txt
python scripts/migrate_postgres.py
```

The automated check validates detected `name`, `dl_number`, and `dob` fields, basic DL-number format, image quality, and account-name consistency. It is **not** an authoritative government authenticity check.
