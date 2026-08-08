from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, kyc, wallet, company, earnings, premium, claims, contract, ml, upload
from .health import health

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ZenoGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(kyc.router)
app.include_router(wallet.router)
app.include_router(company.router)
app.include_router(earnings.router)
app.include_router(premium.router)
app.include_router(claims.router)
app.include_router(contract.router)
app.include_router(ml.router)
app.include_router(upload.router)
app.include_router(health.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to ZenoGuard API"}
