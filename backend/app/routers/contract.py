import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from web3 import Web3

from ..database import get_db
from ..models import Claim, Payout
from ..routers.auth import get_current_user

router = APIRouter(prefix="/contract", tags=["contract"])

RPC_URL = os.getenv("WEB3_RPC_URL", "https://ethereum-sepolia.publicnode.com")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
CONTRACT_ABI = [
    {
        "constant": False,
        "inputs": [{"name": "recipient", "type": "address"}],
        "name": "payout",
        "outputs": [],
        "payable": False,
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


def _build_transaction_hash(claim_id: int, recipient: str) -> str:
    if not PRIVATE_KEY or CONTRACT_ADDRESS == "0x0000000000000000000000000000000000000000":
        return f"mock_tx_claim_{claim_id}_{recipient[:8]}"

    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")

    account = w3.eth.account.from_key(PRIVATE_KEY)
    contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
    tx = contract.functions.payout(Web3.to_checksum_address(recipient)).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 200000,
        "gasPrice": w3.eth.gas_price,
    })
    signed_tx = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return Web3.to_hex(tx_hash)


def create_payout_for_claim(db: Session, claim: Claim, current_user) -> Payout:
    recipient = current_user.wallet_address or "0x0000000000000000000000000000000000000001"
    tx_hash = _build_transaction_hash(claim.id, recipient)

    # Payout amount: fixed coverage of ₹5000 for all verified claims
    COVERAGE_AMOUNT = 5000.0

    payout = Payout(
        claim_id=claim.id,
        amount=COVERAGE_AMOUNT,
        tx_hash=tx_hash,
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout


@router.post("/payout", status_code=status.HTTP_201_CREATED)
def trigger_payout(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.verification_status != "verified":
        raise HTTPException(status_code=400, detail="Claim is not verified")

    if claim.policy and claim.policy.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to payout this claim")

    try:
        payout = create_payout_for_claim(db, claim, current_user)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Payout failed: {str(exc)}") from exc

    return {
        "message": "Payout submitted",
        "claim_id": claim.id,
        "tx_hash": payout.tx_hash,
        "payout_id": payout.id,
    }
