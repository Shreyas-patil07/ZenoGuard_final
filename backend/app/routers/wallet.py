from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
import datetime

from ..database import get_db
from ..models import Rider, WalletTransaction
from ..routers.auth import get_current_user

router = APIRouter(prefix="/wallet", tags=["wallet"])

class PayoutMethodUpdate(BaseModel):
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None

class WithdrawRequest(BaseModel):
    amount: float

def credit_wallet(db: Session, rider: Rider, amount: float, description: str, reference_id: str = None):
    if amount <= 0:
        raise ValueError("Credit amount must be positive")
    rider.wallet_balance = (rider.wallet_balance or 0.0) + amount
    txn = WalletTransaction(
        rider_id=rider.id,
        amount=amount,
        transaction_type="claim_payout",
        description=description,
        status="completed",
        reference_id=reference_id,
    )
    db.add(txn)
    db.commit()
    db.refresh(rider)
    return txn

@router.get("/balance")
def get_balance(
    db: Session = Depends(get_db),
    current_user: Rider = Depends(get_current_user),
):
    transactions = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.rider_id == current_user.id)
        .order_by(WalletTransaction.timestamp.desc())
        .limit(20)
        .all()
    )
    return {
        "balance": current_user.wallet_balance or 0.0,
        "payout_method": _payout_method(current_user),
        "transactions": [_txn_dict(t) for t in transactions],
    }

@router.put("/payout-method")
def update_payout_method(
    payload: PayoutMethodUpdate,
    db: Session = Depends(get_db),
    current_user: Rider = Depends(get_current_user),
):
    if payload.upi_id:
        current_user.upi_id = payload.upi_id.strip()
    if payload.bank_account:
        current_user.bank_account = payload.bank_account.strip()
    if payload.bank_ifsc:
        current_user.bank_ifsc = payload.bank_ifsc.strip().upper()
    if payload.bank_name:
        current_user.bank_name = payload.bank_name.strip()
    db.commit()
    db.refresh(current_user)
    return {"message": "Payout method updated successfully.", "payout_method": _payout_method(current_user)}

@router.post("/withdraw")
def withdraw(
    payload: WithdrawRequest,
    db: Session = Depends(get_db),
    current_user: Rider = Depends(get_current_user),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be greater than zero.")
    balance = current_user.wallet_balance or 0.0
    if payload.amount > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ₹{balance:.2f}")
    method = _payout_method(current_user)
    if not method:
        raise HTTPException(status_code=400, detail="No payout method saved. Please add a UPI ID or bank account first.")
    current_user.wallet_balance = balance - payload.amount
    ref = f"WD-{uuid.uuid4().hex[:10].upper()}"
    txn = WalletTransaction(
        rider_id=current_user.id,
        amount=-payload.amount,
        transaction_type="withdrawal",
        description=f"Withdrawal to {method}",
        status="pending",
        reference_id=ref,
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(txn)
    db.commit()
    return {
        "message": f"Withdrawal of ₹{payload.amount:.2f} initiated to {method}.",
        "reference_id": ref,
        "new_balance": current_user.wallet_balance,
        "status": "pending",
        "note": "Prototype withdrawal: external bank transfer is not yet connected.",
    }

def _payout_method(rider: Rider) -> Optional[str]:
    if rider.upi_id:
        return f"UPI: {rider.upi_id}"
    if rider.bank_account and rider.bank_ifsc:
        return f"Bank: {rider.bank_name or 'Account'} ••••{rider.bank_account[-4:]}"
    return None

def _txn_dict(t: WalletTransaction) -> dict:
    return {
        "id": t.id,
        "amount": t.amount,
        "transaction_type": t.transaction_type,
        "description": t.description,
        "status": t.status,
        "reference_id": t.reference_id,
        "timestamp": t.timestamp.isoformat() if t.timestamp else None,
    }
