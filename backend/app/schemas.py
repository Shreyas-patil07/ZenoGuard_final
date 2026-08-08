from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Rider
class RiderBase(BaseModel):
    name: str
    email: EmailStr

class RiderCreate(RiderBase):
    password: str

class RiderLogin(BaseModel):
    email: EmailStr
    password: str

class Rider(RiderBase):
    id: int
    wallet_address: Optional[str] = None
    kyc_status: str

    class Config:
        from_attributes = True

# Policy
class PolicyBase(BaseModel):
    premium: float
    risk_score: float

class PolicyCreate(PolicyBase):
    pass

class Policy(PolicyBase):
    id: int
    rider_id: int
    active: bool

    class Config:
        from_attributes = True

# EarningsLog
class EarningsLogBase(BaseModel):
    income: float
    hours_worked: float

class EarningsLogCreate(EarningsLogBase):
    pass

class EarningsLog(EarningsLogBase):
    id: int
    rider_id: int
    date: datetime

    class Config:
        from_attributes = True

# Claim
class ClaimBase(BaseModel):
    event_type: str
    location: str
    screenshot_url: str

class ClaimCreate(ClaimBase):
    pass

class Claim(ClaimBase):
    id: int
    policy_id: int
    timestamp: datetime
    verification_status: str

    class Config:
        from_attributes = True

# Payout
class PayoutBase(BaseModel):
    amount: float
    tx_hash: Optional[str] = None

class Payout(PayoutBase):
    id: int
    claim_id: int
    timestamp: datetime

    class Config:
        from_attributes = True
