import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .health import router as health_router
from .routers import (
    auth,
    claims,
    company,
    contract,
    earnings,
    kyc,
    ml,
    payments,
    premium,
    sessions,
    upload,
    wallet,
    webhooks,
)

app = FastAPI(title="ZenoGuard API")

_default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
_frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
_allow_origins = _default_origins + ([_frontend_url] if _frontend_url else [])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(kyc.router)
app.include_router(wallet.router)
app.include_router(company.router)
app.include_router(earnings.router)
app.include_router(premium.router)
app.include_router(payments.router)
app.include_router(webhooks.router)
app.include_router(claims.router)
app.include_router(contract.router)
app.include_router(ml.router)
app.include_router(upload.router)
app.include_router(sessions.router)
app.include_router(health_router)


@app.get("/")
def read_root():
    return {"message": "Welcome to ZenoGuard API"}
