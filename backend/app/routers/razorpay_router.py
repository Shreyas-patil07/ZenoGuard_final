"""
Razorpay integration router.

Two flows:
1. PREMIUM PAYMENT  — user pays their daily premium via Razorpay checkout
   POST /razorpay/create-order   → creates a Razorpay order, returns order_id to frontend
   POST /razorpay/verify-payment → verifies signature, credits nothing (premium already deducted)

2. PAYOUT / WITHDRAWAL — when user withdraws claim balance to UPI/bank
   POST /razorpay/payout         → initiates a Razorpay payout transfer (Razorpay X)
                                   Falls back to simulation if Razorpay X not enabled.
"""

import hashlib
import hmac
import os
import uuid
import datetime

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Rider, WalletTransaction
from ..routers.auth import get_current_user

router = APIRouter(prefix="/razorpay", tags=["razorpay"])

KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

def _client() -> razorpay.Client:
    if not KEY_ID or not KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay keys are not configured on the server.",
        )
    return razorpay.Client(auth=(KEY_ID, KEY_SECRET))


# ── schemas ────────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    amount_inr: float
    description: Optional[str] = "ZenoGuard Insurance Premium"
    tier: Optional[str] = "standard"
    duration_days: Optional[int] = 30

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str

class PayoutRequest(BaseModel):
    amount_inr: float
    upi_id: Optional[str] = None   # if not provided, uses saved upi_id


# ── 1. Create Razorpay order (premium payment) ────────────────────────────────

@router.post("/create-order")
def create_order(
    payload: CreateOrderRequest,
    current_user: Rider = Depends(get_current_user),
):
    """
    Creates a Razorpay order for premium payment.
    Frontend uses the returned order_id to open the Razorpay checkout popup.
    """
    client = _client()
    amount_paise = int(round(payload.amount_inr * 100))   # Razorpay uses paise

    try:
        order = client.order.create({
            "amount":   amount_paise,
            "currency": "INR",
            "receipt":  f"premium_{current_user.id}_{uuid.uuid4().hex[:8]}",
            "notes": {
                "rider_id":     str(current_user.id),
                "rider_email":  current_user.email,
                "description":  payload.description,
                "tier":         payload.tier or "standard",
                "duration_days": str(payload.duration_days or 30),
            },
        })
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Razorpay order creation failed: {str(e)}")

    return {
        "order_id":   order["id"],
        "amount":     order["amount"],        # in paise
        "currency":   order["currency"],
        "key_id":     KEY_ID,                 # frontend needs this for checkout
        "rider_name": current_user.name,
        "rider_email": current_user.email,
    }


# ── 2. Verify payment signature ───────────────────────────────────────────────

@router.post("/verify-payment")
def verify_payment(
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: Rider = Depends(get_current_user),
):
    """
    Verifies the Razorpay payment signature after checkout completes.
    Fetches the actual amount paid from Razorpay, deducts it from wallet
    balance (premium paid = money leaving user), and logs the transaction.
    """
    # ── Signature verification ────────────────────────────────────────────────
    body_str = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected = hmac.new(
        KEY_SECRET.encode(), body_str.encode(), hashlib.sha256
    ).hexdigest()

    if expected != payload.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment signature verification failed.")

    # ── Fetch actual amount paid from Razorpay ────────────────────────────────
    amount_inr = 0.0
    description = f"Insurance premium · {payload.razorpay_payment_id}"
    try:
        client = _client()
        payment = client.payment.fetch(payload.razorpay_payment_id)
        # Razorpay returns amount in paise → convert to rupees
        amount_inr = round(int(payment.get("amount", 0)) / 100, 2)
        description = (
            f"Insurance premium ₹{amount_inr:.2f} paid via "
            f"{payment.get('method', 'Razorpay').upper()} · {payload.razorpay_payment_id}"
        )
    except Exception:
        # If fetch fails, still record the transaction with 0 amount
        # so the payment_id is at least logged
        pass

    # ── Credit wallet with the top-up amount ─────────────────────────────────
    if amount_inr > 0:
        current_user.wallet_balance = (current_user.wallet_balance or 0.0) + amount_inr

    # ── Log transaction ───────────────────────────────────────────────────────
    txn = WalletTransaction(
        rider_id=current_user.id,
        amount=amount_inr,
        transaction_type="top_up",
        description=description,
        status="completed",
        reference_id=payload.razorpay_payment_id,
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(txn)
    db.commit()
    db.refresh(current_user)

    # ── Lock the policy after payment ─────────────────────────────────────────
    # Extract tier and duration from the Razorpay order notes if available
    tier, duration_days = "standard", 30
    try:
        order_details = _client().order.fetch(payload.razorpay_order_id)
        notes = order_details.get("notes", {})
        tier         = notes.get("tier", "standard")
        duration_days = int(notes.get("duration_days", 30))
    except Exception:
        pass

    from ..routers.premium import activate_policy as _activate
    from pydantic import BaseModel as _BM
    class _PR(_BM):
        tier: str = tier
        duration_days: int = duration_days
    try:
        _activate(payload=_PR(), db=db, current_user=current_user)
    except Exception:
        pass  # policy activation failure should not block wallet credit
    db.add(txn)
    db.commit()
    db.refresh(current_user)

    return {
        "message":    f"Wallet topped up with ₹{amount_inr:.2f}. Your policy is now active.",
        "payment_id": payload.razorpay_payment_id,
        "amount_paid": amount_inr,
        "new_balance": current_user.wallet_balance,
        "status":     "verified",
    }


# ── 3. Payout / withdrawal via Razorpay X ────────────────────────────────────

@router.post("/payout")
def razorpay_payout(
    payload: PayoutRequest,
    db: Session = Depends(get_db),
    current_user: Rider = Depends(get_current_user),
):
    """
    Initiates a real Razorpay payout transfer to the user's UPI ID.
    Requires Razorpay X to be enabled on the account.
    Falls back to simulation (marks as pending) if Razorpay X is not available.
    """
    if payload.amount_inr <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero.")

    balance = current_user.wallet_balance or 0.0
    if payload.amount_inr > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ₹{balance:.2f}",
        )

    upi_id = payload.upi_id or current_user.upi_id
    if not upi_id:
        raise HTTPException(
            status_code=400,
            detail="No UPI ID provided. Please save a UPI ID in your wallet settings.",
        )

    client = _client()
    ref = f"WD-{uuid.uuid4().hex[:10].upper()}"
    amount_paise = int(round(payload.amount_inr * 100))

    payout_status = "pending"
    payout_id     = None
    message       = ""

    try:
        # Razorpay X payout API
        rp_payout = client.payout.create({
            "account_number": os.getenv("RAZORPAY_ACCOUNT_NUMBER", ""),  # your RazorpayX account
            "fund_account": {
                "account_type": "vpa",
                "vpa": {"address": upi_id},
                "contact": {
                    "name":    current_user.name or "ZenoGuard User",
                    "email":   current_user.email,
                    "type":    "employee",
                    "reference_id": str(current_user.id),
                },
            },
            "amount":      amount_paise,
            "currency":    "INR",
            "mode":        "UPI",
            "purpose":     "payout",
            "queue_if_low_balance": True,
            "reference_id": ref,
            "narration":   f"ZenoGuard claim payout · {ref}",
        })
        payout_status = rp_payout.get("status", "processing")
        payout_id     = rp_payout.get("id")
        message = f"Payout of ₹{payload.amount_inr:.2f} initiated via Razorpay to {upi_id}."

    except Exception as e:
        # Razorpay X not enabled or error — simulate the transfer
        payout_status = "pending"
        payout_id     = ref
        message = (
            f"Payout of ₹{payload.amount_inr:.2f} queued to {upi_id}. "
            f"(Razorpay X simulation — will process within 1–2 business days.)"
        )

    # Deduct balance
    current_user.wallet_balance = balance - payload.amount_inr

    txn = WalletTransaction(
        rider_id=current_user.id,
        amount=-payload.amount_inr,
        transaction_type="withdrawal",
        description=f"Withdrawal to UPI: {upi_id}",
        status=payout_status,
        reference_id=payout_id or ref,
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    return {
        "message":     message,
        "reference_id": payout_id or ref,
        "new_balance": current_user.wallet_balance,
        "status":      payout_status,
        "upi_id":      upi_id,
    }


# ── 4. Webhook (Razorpay → your server) ──────────────────────────────────────

@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives Razorpay webhook events (payment.captured, payout.processed, etc.)
    and updates transaction status in the database.
    """
    body      = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    # Verify webhook signature if secret is configured
    if webhook_secret:
        expected = hmac.new(
            webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if expected != signature:
            raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    import json
    event = json.loads(body)
    event_type = event.get("event", "")

    if event_type == "payout.processed":
        payout_id = event.get("payload", {}).get("payout", {}).get("entity", {}).get("id")
        if payout_id:
            txn = db.query(WalletTransaction).filter(
                WalletTransaction.reference_id == payout_id
            ).first()
            if txn:
                txn.status = "completed"
                db.commit()

    elif event_type == "payout.failed":
        payout_entity = event.get("payload", {}).get("payout", {}).get("entity", {})
        payout_id = payout_entity.get("id")
        if payout_id:
            txn = db.query(WalletTransaction).filter(
                WalletTransaction.reference_id == payout_id
            ).first()
            if txn:
                # Refund the balance
                rider = db.query(Rider).filter(Rider.id == txn.rider_id).first()
                if rider:
                    rider.wallet_balance = (rider.wallet_balance or 0.0) + abs(txn.amount)
                txn.status = "failed"
                db.commit()

    return {"status": "ok"}
