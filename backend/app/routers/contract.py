from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from web3 import Web3

from ..database import get_db
from ..models import Claim, Payment, Policy
from ..routers.auth import get_current_user
from ..services import web3_gateway
from ..services.risk_engine import COVERAGE_TIERS, get_payout_amount

router = APIRouter(prefix="/contract", tags=["contract"])


class DriverRegistrationRequest(BaseModel):
    driver_id: str | None = Field(default=None, max_length=128)


class PolicyPurchaseRequest(BaseModel):
    policy_id: int = Field(gt=0)


class ClaimSubmitRequest(BaseModel):
    claim_id: int = Field(gt=0)


class ClaimAuthorizeRequest(BaseModel):
    claim_id: int = Field(gt=0)
    legitimate: bool = True


def _current_driver(current_user) -> str:
    return web3_gateway.driver_identity(current_user.id, current_user.wallet_address)


def _coverage_for_policy(policy: Policy) -> float:
    tier = COVERAGE_TIERS.get(policy.tier or "standard", COVERAGE_TIERS["standard"])
    return float(max(tier["accident"], tier["breakdown"], tier["weather"]))


@router.get("/status")
def blockchain_status():
    try:
        return web3_gateway.status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/driver/register")
def register_driver(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Register the rider on-chain using the backend signer. No wallet signing is required."""
    w3 = web3_gateway._w3()
    if not w3.is_connected():
        raise HTTPException(status_code=503, detail="Unable to connect to Ethereum RPC")

    driver = _current_driver(current_user)
    registry = web3_gateway._contract(w3, "driver_registry", web3_gateway.DRIVER_REGISTRY_ABI)
    try:
        if registry.functions.isRegistered(driver).call():
            return {"message": "Driver is already registered on blockchain", "driver": driver, "registered": True}

        signer = web3_gateway._require_signer(w3)
        driver_id = Web3.keccak(text=(f"zenoguard:rider:{current_user.id}" if not current_user.wallet_address else (current_user.wallet_address or str(current_user.id))))
        tx = registry.functions.registerDriverFor(driver, driver_id).build_transaction({
            "from": signer.address,
            "chainId": w3.eth.chain_id,
            "nonce": w3.eth.get_transaction_count(signer.address, "pending"),
        })
        tx_hash = web3_gateway._send_signed(w3, tx)
        return {"message": "Driver registered on blockchain", "driver": driver, "registered": True, "tx_hash": tx_hash}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Driver registration failed: {exc}") from exc


@router.post("/policy/purchase")
def purchase_policy_onchain(payload: PolicyPurchaseRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Create the on-chain policy after the corresponding Razorpay premium is paid."""
    policy = db.query(Policy).filter(Policy.id == payload.policy_id, Policy.rider_id == current_user.id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    if policy.blockchain_policy_id:
        return {"message": "Policy is already synchronized with blockchain", "policy_id": policy.id, "blockchain_policy_id": policy.blockchain_policy_id, "tx_hash": policy.purchase_tx_hash, "blockchain_status": policy.blockchain_status}

    payment = db.query(Payment).filter(
        Payment.policy_id == policy.id,
        Payment.rider_id == current_user.id,
        Payment.payment_type == "PREMIUM",
        Payment.status == "PAID",
    ).order_by(Payment.id.desc()).first()
    if not payment:
        raise HTTPException(status_code=409, detail="Razorpay premium payment must be PAID before blockchain policy creation")

    try:
        result = web3_gateway.purchase_policy_for(
            rider_id=policy.rider_id,
            wallet_address=current_user.wallet_address,
            premium_inr=float(payment.amount_inr),
            coverage_inr=_coverage_for_policy(policy),
            duration_days=policy.duration_days,
        )
        onchain = web3_gateway.get_onchain_policy(result["policy_id"])
        policy.blockchain_policy_id = result["policy_id"]
        policy.purchase_tx_hash = result["tx_hash"]
        policy.blockchain_status = "CONFIRMED"
        policy.active = bool(onchain["active"])
        policy.locked = bool(onchain["active"])
        policy.start_date = datetime.fromtimestamp(onchain["start_time"], timezone.utc).replace(tzinfo=None)
        policy.end_date = datetime.fromtimestamp(onchain["expiry_time"], timezone.utc).replace(tzinfo=None)
        db.commit()
        db.refresh(policy)
        return {"message": "Policy created and confirmed on blockchain", "policy_id": policy.id, "blockchain_policy_id": result["policy_id"], "blockchain_status": policy.blockchain_status, "active": policy.active, "tx_hash": result["tx_hash"]}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Blockchain policy creation failed: {exc}") from exc


@router.get("/policy/{policy_id}")
def get_onchain_policy(policy_id: int, current_user=Depends(get_current_user)):
    try:
        policy = web3_gateway.get_onchain_policy(policy_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    expected_driver = _current_driver(current_user)
    if policy["driver"].lower() != expected_driver.lower():
        raise HTTPException(status_code=403, detail="This policy does not belong to the authenticated rider")
    return policy


@router.post("/claim/submit")
def submit_claim_onchain(payload: ClaimSubmitRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Submit an existing verified database claim to ClaimManager using the backend signer."""
    claim = db.query(Claim).filter(Claim.id == payload.claim_id).first()
    if not claim or not claim.policy or claim.policy.rider_id != current_user.id:
        raise HTTPException(status_code=404, detail="Claim not found")
    if not claim.policy.blockchain_policy_id:
        raise HTTPException(status_code=409, detail="Policy is not synchronized with blockchain")
    if claim.blockchain_claim_id:
        return {"message": "Claim is already synchronized", "claim_id": claim.id, "blockchain_claim_id": claim.blockchain_claim_id, "tx_hash": claim.submit_tx_hash, "blockchain_status": claim.blockchain_status}

    amount = float(get_payout_amount(claim.event_type, claim.policy.tier))
    try:
        result = web3_gateway.submit_claim_for(
            rider_id=current_user.id,
            wallet_address=current_user.wallet_address,
            policy_id=int(claim.policy.blockchain_policy_id),
            amount_inr=amount,
        )
        claim.blockchain_claim_id = result["claim_id"]
        claim.submit_tx_hash = result["tx_hash"]
        claim.blockchain_status = "SUBMITTED"
        db.commit()
        db.refresh(claim)
        return {"message": "Claim submitted to blockchain", "claim_id": claim.id, "blockchain_claim_id": result["claim_id"], "tx_hash": result["tx_hash"], "blockchain_status": claim.blockchain_status}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Blockchain claim submission failed: {exc}") from exc


@router.post("/claim/authorize")
def authorize_claim_onchain(payload: ClaimAuthorizeRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Verify and authorize a claim on-chain. RazorpayX remains the INR payout rail."""
    claim = db.query(Claim).filter(Claim.id == payload.claim_id).first()
    if not claim or not claim.policy or claim.policy.rider_id != current_user.id:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.verification_status != "VALID":
        raise HTTPException(status_code=409, detail="Claim must be ML-verified as VALID before blockchain authorization")
    if not claim.blockchain_claim_id:
        raise HTTPException(status_code=409, detail="Claim must be submitted to blockchain before authorization")

    try:
        result = web3_gateway.verify_and_authorize_claim(int(claim.blockchain_claim_id), legitimate=payload.legitimate)
        claim.blockchain_status = "AUTHORIZED" if payload.legitimate else "REJECTED"
        db.commit()
        return {"message": "Claim authorized on blockchain; RazorpayX handles INR payout" if payload.legitimate else "Claim rejected on blockchain", "claim_id": claim.id, "blockchain_claim_id": claim.blockchain_claim_id, "verify_tx_hash": result.get("verify_tx_hash"), "authorize_tx_hash": result.get("authorize_tx_hash"), "blockchain_status": claim.blockchain_status}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Blockchain claim authorization failed: {exc}") from exc


@router.get("/claim/{claim_id}")
def get_onchain_claim(claim_id: int, current_user=Depends(get_current_user)):
    try:
        claim = web3_gateway.get_onchain_claim(claim_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return claim
