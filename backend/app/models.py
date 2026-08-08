from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Rider(Base):
    __tablename__ = "riders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    wallet_address = Column(String, unique=True, index=True, nullable=True)
    kyc_status = Column(String, default="pending")  # pending, verified, rejected

    # Internal wallet balance (Option 3 — no crypto required)
    wallet_balance = Column(Float, default=0.0)
    upi_id = Column(String, nullable=True)
    bank_account = Column(String, nullable=True)
    bank_ifsc = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)

    policies = relationship("Policy", back_populates="rider")
    earnings = relationship("EarningsLog", back_populates="rider")
    wallet_transactions = relationship("WalletTransaction", back_populates="rider")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    amount = Column(Float)                        # positive = credit, negative = debit
    transaction_type = Column(String)             # "claim_payout" | "withdrawal" | "refund"
    description = Column(String, nullable=True)
    status = Column(String, default="completed")  # completed | pending | failed
    reference_id = Column(String, nullable=True)  # claim_id or withdrawal ref
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    rider = relationship("Rider", back_populates="wallet_transactions")

class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    premium = Column(Float)
    risk_score = Column(Float)
    active = Column(Boolean, default=False)     # only True after payment
    locked = Column(Boolean, default=False)     # True = plan is locked, cannot change
    tier = Column(String, default="standard")   # basic | standard | plus
    duration_days = Column(Integer, default=30) # 7 | 30 | 90
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    rider = relationship("Rider", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")

class EarningsLog(Base):
    __tablename__ = "earnings_logs"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    income = Column(Float)
    hours_worked = Column(Float)

    rider = relationship("Rider", back_populates="earnings")

class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"))
    event_type = Column(String)  # accident, weather
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    location = Column(String)
    verification_status = Column(String, default="pending")  # pending, verified, rejected
    screenshot_url = Column(String)

    policy = relationship("Policy", back_populates="claims")
    payout = relationship("Payout", back_populates="claim", uselist=False)

class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"))
    amount = Column(Float)
    tx_hash = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    claim = relationship("Claim", back_populates="payout")
