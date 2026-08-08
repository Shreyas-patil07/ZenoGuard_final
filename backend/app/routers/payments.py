import datetime
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models import Payment, Policy, Rider
from ..database import get_db
from ..routers.auth import get_current_user
from ..services import web3_gateway
from ..services.razorpay_service import RazorpayConfigError, create_order, fetch_payment, verify_payment_signature
from ..services.risk_engine import COVERAGE_TIERS

router = APIRouter(prefix="/payments", tags=["payments"])

class PremiumOrderRequest(BaseModel):
    policy_id: int

class PremiumVerifyRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str


def _blockchain_coverage(policy: Policy) -> float:
    tier = COVERAGE_TIERS.get(policy.tier or "standard", COVERAGE_TIERS["standard"])
    return float(max(tier["accident"], tier["breakdown"], tier["weather"]))


def _activate_policy_after_blockchain(db: Session, payment: Payment) -> Policy:
    policy = payment.policy
    if not policy:
        raise HTTPException(status_code=404, detail="Policy linked to payment was not found")
    now = datetime.datetime.utcnow()
    policy.active = True
    policy.locked = True
    policy.start_date = now
    policy.end_date = now + datetime.timedelta(days=policy.duration_days)
    payment.status = "PAID"
    db.commit()
    db.refresh(policy)
    return policy


def _sync_policy_to_blockchain(db: Session, payment: Payment) -> dict:
    policy = payment.policy
    if not policy:
        raise RuntimeError("Payment has no linked policy")
    if policy.blockchain_policy_id:
        return {"policy_id": policy.blockchain_policy_id, "tx_hash": policy.purchase_tx_hash, "blockchain_status": policy.blockchain_status}
    result = web3_gateway.purchase_policy_for(
        rider_id=policy.rider_id,
        wallet_address=policy.rider.wallet_address if policy.rider else None,
        premium_inr=float(payment.amount_inr),
        coverage_inr=_blockchain_coverage(policy),
        duration_days=policy.duration_days,
    )
    policy.blockchain_policy_id = result["policy_id"]
    policy.purchase_tx_hash = result["tx_hash"]
    policy.blockchain_status = "CONFIRMED"
    db.commit()
    db.refresh(policy)
    return {"policy_id": result["policy_id"], "tx_hash": result["tx_hash"], "blockchain_status": "CONFIRMED", "driver": result["driver"]}


@router.post("/premium/order")
def create_premium_order(payload: PremiumOrderRequest, db: Session = Depends(get_db), current_user: Rider = Depends(get_current_user)):
    policy = db.query(Policy).filter(Policy.id == payload.policy_id, Policy.rider_id == current_user.id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    if policy.active and policy.locked:
        raise HTTPException(status_code=409, detail="Policy is already active")
    if policy.blockchain_status not in ("NOT_LINKED", "PENDING"):
        raise HTTPException(status_code=409, detail="Policy is not available for payment")
    existing = db.query(Payment).filter(
        Payment.policy_id == policy.id,
        Payment.payment_type == "PREMIUM",
        Payment.status.in_(["CREATED", "PENDING"]),
    ).order_by(Payment.id.desc()).first()
    if existing:
        return {"payment_id": existing.id, "order_id": existing.razorpay_order_id, "amount_inr": existing.amount_inr, "currency": "INR", "status": existing.status, "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID")}
    amount = round(policy.premium * policy.duration_days, 2)
    try:
        order = create_order(amount_inr=amount, receipt=f"ZG-POL-{policy.id}", notes={"rider_id": str(current_user.id), "policy_id": str(policy.id)})
    except RazorpayConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to create Razorpay order: {exc}")
    payment = Payment(rider_id=current_user.id, policy_id=policy.id, payment_type="PREMIUM", amount_inr=amount, status="CREATED", razorpay_order_id=order["id"], upi_id=current_user.upi_id)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"payment_id": payment.id, "order_id": order["id"], "amount_inr": amount, "amount_paise": order["amount"], "currency": "INR", "status": payment.status, "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID")}


@router.post("/premium/verify")
def verify_premium_payment(payload: PremiumVerifyRequest, db: Session = Depends(get_db), current_user: Rider = Depends(get_current_user)):
    payment = db.query(Payment).filter(Payment.razorpay_order_id == payload.order_id, Payment.payment_type == "PREMIUM", Payment.rider_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found")
    try:
        valid = verify_payment_signature(payload.order_id, payload.payment_id, payload.signature)
    except RazorpayConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")
    try:
        remote = fetch_payment(payload.payment_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to verify payment with Razorpay: {exc}")
    if remote.get("order_id") != payment.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment does not belong to this order")
    if remote.get("amount") != int(round(payment.amount_inr * 100)):
        raise HTTPException(status_code=400, detail="Payment amount mismatch")
    if remote.get("status") not in ("authorized", "captured"):
        payment.status = "FAILED"
        payment.failure_reason = f"Razorpay status: {remote.get('status')}"
        db.commit()
        raise HTTPException(status_code=400, detail="Payment is not successful")
    payment.razorpay_payment_id = payload.payment_id
    payment.status = "PAID"
    db.commit()
    try:
        blockchain = _sync_policy_to_blockchain(db, payment)
    except Exception as exc:
        payment.policy.blockchain_status = "PENDING"
        db.commit()
        raise HTTPException(status_code=503, detail=f"Razorpay payment verified, but blockchain policy registration failed: {exc}") from exc
    policy = _activate_policy_after_blockchain(db, payment)
    return {"message": "Premium payment verified, blockchain policy confirmed, and protection activated.", "payment_id": payment.id, "policy_id": policy.id, "status": payment.status, "policy_active": policy.active, "start_date": policy.start_date.isoformat(), "end_date": policy.end_date.isoformat(), "blockchain_policy_id": blockchain["policy_id"], "blockchain_status": blockchain["blockchain_status"], "purchase_tx_hash": blockchain["tx_hash"]}


def finalize_order_paid(db: Session, order_id: str, payment_id: str | None = None, event_id: str | None = None) -> dict:
    payment = db.query(Payment).filter(Payment.razorpay_order_id == order_id, Payment.payment_type == "PREMIUM").first()
    if not payment:
        return {"handled": False, "reason": "unknown_order"}
    if event_id and payment.webhook_event_id == event_id:
        return {"handled": True, "duplicate": True, "payment_id": payment.id}
    payment.status = "PAID"
    if payment_id:
        payment.razorpay_payment_id = payment_id
    if event_id:
        payment.webhook_event_id = event_id
    db.commit()
    try:
        blockchain = _sync_policy_to_blockchain(db, payment)
    except Exception as exc:
        payment.policy.blockchain_status = "PENDING"
        db.commit()
        return {"handled": True, "payment_id": payment.id, "blockchain_status": "PENDING", "error": str(exc)}
    policy = _activate_policy_after_blockchain(db, payment)
    return {"handled": True, "payment_id": payment.id, "policy_id": policy.id, "blockchain_policy_id": blockchain["policy_id"], "blockchain_status": "CONFIRMED"}
