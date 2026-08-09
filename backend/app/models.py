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
    kyc_status = Column(String, default="unverified")
    wallet_balance = Column(Float, default=0.0)
    upi_id = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    bank_account = Column(String, nullable=True)
    bank_ifsc = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    razorpay_contact_id = Column(String, nullable=True, unique=True)
    razorpay_fund_account_id = Column(String, nullable=True, unique=True)

    profile = relationship("RiderProfile", back_populates="rider", uselist=False, cascade="all, delete-orphan")
    policies = relationship("Policy", back_populates="rider")
    earnings = relationship("EarningsLog", back_populates="rider")
    wallet_transactions = relationship("WalletTransaction", back_populates="rider")
    work_sessions = relationship("WorkSession", back_populates="rider")
    payments = relationship("Payment", back_populates="rider")


class RiderProfile(Base):
    __tablename__ = "rider_profiles"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    id_type = Column(String, nullable=True)
    id_number = Column(String, nullable=True)
    id_document_url = Column(String, nullable=True)
    selfie_url = Column(String, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String, nullable=True)

    rider = relationship("Rider", back_populates="profile")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    amount = Column(Float)
    transaction_type = Column(String)
    description = Column(String, nullable=True)
    status = Column(String, default="completed")
    reference_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    rider = relationship("Rider", back_populates="wallet_transactions")


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    premium = Column(Float)
    risk_score = Column(Float)
    active = Column(Boolean, default=False)
    locked = Column(Boolean, default=False)
    tier = Column(String, default="standard")
    duration_days = Column(Integer, default=30)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    blockchain_policy_id = Column(Integer, nullable=True, index=True)
    purchase_tx_hash = Column(String, nullable=True, unique=True)
    blockchain_status = Column(String, default="NOT_LINKED")

    rider = relationship("Rider", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")
    payments = relationship("Payment", back_populates="policy")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=True)
    payment_type = Column(String, nullable=False)
    amount_inr = Column(Float, nullable=False)
    status = Column(String, default="CREATED", nullable=False)
    razorpay_order_id = Column(String, nullable=True, unique=True)
    razorpay_payment_id = Column(String, nullable=True, unique=True)
    razorpay_payout_id = Column(String, nullable=True, unique=True)
    upi_id = Column(String, nullable=True)
    webhook_event_id = Column(String, nullable=True, unique=True)
    failure_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    rider = relationship("Rider", back_populates="payments")
    policy = relationship("Policy", back_populates="payments")


class EarningsLog(Base):
    __tablename__ = "earnings_logs"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    income = Column(Float)
    hours_worked = Column(Float)
    rider = relationship("Rider", back_populates="earnings")


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    consent = Column(Boolean, default=False, nullable=False)
    rider = relationship("Rider", back_populates="work_sessions")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"))
    event_type = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    location = Column(String)
    verification_status = Column(String, default="pending")
    screenshot_url = Column(String)

    blockchain_claim_id = Column(Integer, nullable=True, index=True)
    submit_tx_hash = Column(String, nullable=True, unique=True)
    payout_tx_hash = Column(String, nullable=True)
    blockchain_status = Column(String, default="NOT_LINKED")

    policy = relationship("Policy", back_populates="claims")
    payout = relationship("Payout", back_populates="claim", uselist=False)


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"))
    amount = Column(Float)
    tx_hash = Column(String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    claim = relationship("Claim", back_populates="payout")
