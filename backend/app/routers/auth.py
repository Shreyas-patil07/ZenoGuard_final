from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Rider
from ..schemas import RiderCreate, RiderLogin, Token
import bcrypt
import os
from datetime import datetime, timedelta
from jose import JWTError, jwt

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

SECRET_KEY = os.getenv("SECRET_KEY", "my_super_secret_jwt_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days


def normalize_email(email: str) -> str:
    return str(email).strip().lower()


def get_password_hash(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")

    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
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
    print(f"Backend received signup request for email: {normalized_email}")
    db_rider = db.query(Rider).filter(Rider.email == normalized_email).first()
    if db_rider:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(rider.password)
    new_rider = Rider(
        name=rider.name,
        email=normalized_email,
        password_hash=hashed_password
    )
    db.add(new_rider)
    db.commit()
    db.refresh(new_rider)
    print(f"Backend success: Created new Rider with ID {new_rider.id}")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_rider.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(rider: RiderLogin, db: Session = Depends(get_db)):
    normalized_email = normalize_email(rider.email)
    print(f"Auth login debug: searching email={normalized_email}")

    db_rider = db.query(Rider).filter(Rider.email == normalized_email).first()
    print(f"Auth login debug: user_found={db_rider is not None}")

    password_ok = False
    if db_rider:
        password_ok = verify_password(rider.password, db_rider.password_hash)
        print(f"Auth login debug: password_ok={password_ok}")
    else:
        print("Auth login debug: password_ok=False")

    if not db_rider or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_rider.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
