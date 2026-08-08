import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from web3 import Web3

from ..database import get_db
from ..models import Claim, Policy, Payout
from ..routers.auth import get_current_user
from ..services import web3_gateway

router = APIRouter(prefix="/contract", tags=["contract"])


class DriverRegistrationRequest(BaseModel):
    driver_id: str = Field(min_length=1, max_length=128)


class PolicyPurchaseRequest(BaseModel):
    premium_wei: int = Field(gt=0)
    coverage_wei: int = Field(gt=0)
    duration_days: int


class PolicySyncRequest(BaseModel):
    policy_id: int = Field(gt=0)
    tx_hash: str = Field(min_length=10)


class ClaimSyncRequest(BaseModel):
    claim_id: int = Field(gt=0)
    tx_hash: str = Field(min_length=10)


def _require_wallet(current_user):
    if not current_user.wallet_address or not Web3.is_address(current_user.wallet_address):
        raise HTTPException(status_code=400, detail="Connect a valid wallet before using blockchain features")
    return Web3.to_checksum_address(current_user.wallet_address)


@router.get("/status")
def blockchain_status():
    try:
        return web3_gateway.status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/driver/prepare-registration")
def prepare_driver_registration(payload: DriverRegistrationRequest, current_user=Depends(get_current_user)):
    wallet = _require_wallet(current_user)
    try:
        return {"message": "Sign this transaction with the connected worker wallet", "wallet": wallet, "transaction": web3_gateway.build_driver_registration(wallet, payload.driver_id)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/policy/prepare-purchase")
def prepare_policy_purchase(payload: PolicyPurchaseRequest, current_user=Depends(get_current_user)):
    wallet = _require_wallet(current_user)
    try:
        transaction = web3_gateway.build_policy_purchase(wallet, payload.premium_wei, payload.coverage_wei, payload.duration_days)
        return {"message": "Sign this transaction with the connected worker wallet", "wallet": wallet, "transaction": transaction}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/policy/sync")
def sync_policy(payload: PolicySyncRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    policy = db.query(Policy).filter(Policy.id == payload.policy_id, Policy.rider_id == current_user.id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Database policy not found")
    if policy.purchase_tx_hash and policy.purchase_tx_hash != payload.tx_hash:
        raise HTTPException(status_code=409, detail="Policy already has a different purchase transaction")

    try:
        onchain_id = web3_gateway.get_policy_id_from_purchase(payload.tx_hash)
        onchain = web3_gateway.get_onchain_policy(onchain_id)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=f"Policy transaction could not be synchronized: {exc}") from exc

    wallet = _require_wallet(current_user)
    if onchain["driver"].lower() != wallet.lower():
        raise HTTPException(status_code=403, detail="On-chain policy belongs to a different wallet")
    expected_duration = policy.duration_days * 24 * 60 * 60
    actual_duration = onchain["expiry_time"] - onchain["start_time"]
    if actual_duration != expected_duration:
        raise HTTPException(status_code=409, detail="On-chain policy duration does not match database policy")

    policy.blockchain_policy_id = onchain_id
    policy.purchase_tx_hash = payload.tx_hash
    policy.blockchain_status = "CONFIRMED"
    policy.active = onchain["active"]
    policy.locked = onchain["active"]
    policy.start_date = datetime.fromtimestamp(onchain["start_time"], timezone.utc).replace(tzinfo=None)
    policy.end_date = datetime.fromtimestamp(onchain["expiry_time"], timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(policy)

    return {"message": "Database policy synchronized with blockchain", "policy_id": policy.id, "blockchain_policy_id": onchain_id, "blockchain_status": policy.blockchain_status, "active": policy.active, "tx_hash": payload.tx_hash}


@router.get("/policy/{policy_id}")
def get_onchain_policy(policy_id: int, current_user=Depends(get_current_user)):
    try:
        policy = web3_gateway.get_onchain_policy(policy_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if current_user.wallet_address and policy["driver"].lower() != current_user.wallet_address.lower():
        raise HTTPException(status_code=403, detail="This policy does not belong to the authenticated wallet")
    return policy


@router.post("/claim/sync")
def sync_claim(payload: ClaimSyncRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    claim = db.query(Claim).filter(Claim.id == payload.claim_id).first()
    if not claim or not claim.policy or claim.policy.rider_id != current_user.id:
        raise HTTPException(status_code=404, detail="Database claim not found")

    try:
        onchain_id = web3_gateway.get_claim_id_from_submission(payload.tx_hash)
        onchain = web3_gateway.get_onchain_claim(onchain_id)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=f"Claim transaction could not be synchronized: {exc}") from exc

    if claim.policy.blockchain_policy_id != onchain["policy_id"]:
        raise HTTPException(status_code=409, detail="On-chain claim references a different policy")

    claim.blockchain_claim_id = onchain_id
    claim.submit_tx_hash = payload.tx_hash
    claim.blockchain_status = "CONFIRMED"
    db.commit()
    db.refresh(claim)

    return {"message": "Database claim synchronized with blockchain", "claim_id": claim.id, "blockchain_claim_id": onchain_id, "blockchain_status": claim.blockchain_status, "tx_hash": payload.tx_hash}


@router.get("/claim/{claim_id}")
def get_onchain_claim(claim_id: int, current_user=Depends(get_current_user)):
    try:
        return web3_gateway.get_onchain_claim(claim_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/payout", status_code=status.HTTP_201_CREATED)
def trigger_payout(claim_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.verification_status != "VALID":
        raise HTTPException(status_code=400, detail="Claim must be VALID before blockchain payout")
    if not claim.policy or claim.policy.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to payout this claim")
    if not claim.blockchain_claim_id:
        raise HTTPException(status_code=409, detail="Claim must be synchronized with blockchain before payout")

    private_key = os.getenv("INSURANCE_COMPANY_PRIVATE_KEY", "")
    if not private_key:
        raise HTTPException(status_code=503, detail="INSURANCE_COMPANY_PRIVATE_KEY is not configured")

    try:
        w3 = Web3(Web3.HTTPProvider(web3_gateway.RPC_URL))
        if not w3.is_connected():
            raise RuntimeError("Unable to connect to Ethereum RPC")
        account = w3.eth.account.from_key(private_key)
        contract = w3.eth.contract(address=web3_gateway._address("claim_manager"), abi=web3_gateway.CLAIM_MANAGER_ABI)
        tx = contract.functions.approveClaim(int(claim.blockchain_claim_id)).build_transaction({"from": account.address, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(account.address, "pending")})
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt.status != 1:
            raise RuntimeError("Blockchain payout transaction reverted")

        tx_hex = Web3.to_hex(tx_hash)
        payout = Payout(claim_id=claim.id, amount=float(claim.policy.premium), tx_hash=tx_hex)
        claim.payout_tx_hash = tx_hex
        claim.blockchain_status = "PAID"
        claim.verification_status = "PAID"
        db.add(payout)
        db.commit()
        db.refresh(payout)
        return {"message": "Blockchain payout completed", "claim_id": claim.id, "onchain_claim_id": int(claim.blockchain_claim_id), "tx_hash": payout.tx_hash, "payout_id": payout.id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Blockchain payout failed: {exc}") from exc
