# ZenoGuard KYC YOLO models

Place the trained Ultralytics YOLO11s weights in this directory with these exact names:

- `dl_detector.pt` — Indian driving licence detector (`name`, `dl_no`, `dob`)
- `aadhaar_detector.pt` — Aadhaar detector (`name`, `Aadhar_number`, `fake`)
- `pan_detector.pt` — PAN detector (`name`, `father-s_name`, `pan_number`)

The FastAPI KYC service loads these models locally. It does not send document images to Roboflow for detection when the corresponding local weight exists.

Environment variables can override the paths:

```env
KYC_DL_MODEL_PATH=backend/models/dl_detector.pt
KYC_AADHAAR_MODEL_PATH=backend/models/aadhaar_detector.pt
KYC_PAN_MODEL_PATH=backend/models/pan_detector.pt
KYC_MODEL_DEVICE=cpu
KYC_MODEL_IMGSZ=640
KYC_MODEL_CONF=0.25
```

The `.pt` binaries are intentionally not embedded in this text file. Copy the three trained weights into this directory before starting the backend.
