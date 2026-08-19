from datetime import datetime, timedelta
import os

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Rider
from ..schemas import RiderCreate, RiderLogin, Token

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be configured")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def normalize_email(email: str) -> str:
    return str(email).strip().lower()


def get_password_hash(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")

    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=15)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(Rider).filter(Rider.email == email).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/signup", response_model=Token)
def signup(rider: RiderCreate, db: Session = Depends(get_db)):
    normalized_email = normalize_email(rider.email)
    db_rider = db.query(Rider).filter(Rider.email == normalized_email).first()
    if db_rider:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(rider.password)
    new_rider = Rider(
        name=rider.name,
        email=normalized_email,
        password_hash=hashed_password,
    )
    db.add(new_rider)
    db.commit()
    db.refresh(new_rider)

    access_token = create_access_token(
        data={"sub": new_rider.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(rider: RiderLogin, db: Session = Depends(get_db)):
    normalized_email = normalize_email(rider.email)
    db_rider = db.query(Rider).filter(Rider.email == normalized_email).first()

    password_ok = (
        verify_password(rider.password, db_rider.password_hash)
        if db_rider
        else False
    )
    if not db_rider or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": db_rider.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}
