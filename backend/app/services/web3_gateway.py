import os
from typing import Any

from web3 import Web3

RPC_URL = os.getenv("WEB3_RPC_URL", "http://127.0.0.1:8545")
CHAIN_ID = int(os.getenv("WEB3_CHAIN_ID", "31337"))
RPC_TIMEOUT = int(os.getenv("WEB3_RPC_TIMEOUT", "10"))
INR_TO_WEI = int(os.getenv("BLOCKCHAIN_INR_TO_WEI", "1000000000000"))
INSURANCE_COMPANY_PRIVATE_KEY = os.getenv("INSURANCE_COMPANY_PRIVATE_KEY", "")

ADDRESSES = {
    "driver_registry": os.getenv("DRIVER_REGISTRY_ADDRESS", ""),
    "safety_score_oracle": os.getenv("SAFETY_SCORE_ORACLE_ADDRESS", ""),
    "insurance_pool": os.getenv("INSURANCE_POOL_ADDRESS", ""),
    "insurance_policy": os.getenv("INSURANCE_POLICY_ADDRESS", ""),
    "claim_manager": os.getenv("CLAIM_MANAGER_ADDRESS", ""),
}

DRIVER_REGISTRY_ABI = [
    {"inputs":[{"internalType":"bytes32","name":"driverId","type":"bytes32"}],"name":"registerDriver","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"wallet","type":"address"},{"internalType":"bytes32","name":"driverId","type":"bytes32"}],"name":"registerDriverFor","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"wallet","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"registered","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"wallet","type":"address"}],"name":"getDriver","outputs":[{"components":[{"internalType":"address","name":"wallet","type":"address"},{"internalType":"bytes32","name":"driverId","type":"bytes32"},{"internalType":"uint256","name":"policyId","type":"uint256"},{"internalType":"bool","name":"registered","type":"bool"}],"internalType":"struct InsuranceTypes.Driver","name":"driver","type":"tuple"}],"stateMutability":"view","type":"function"},
]

INSURANCE_POLICY_ABI = [
    {"anonymous":True,"inputs":[{"indexed":True,"internalType":"uint256","name":"policyId","type":"uint256"},{"indexed":True,"internalType":"address","name":"driver","type":"address"},{"indexed":False,"internalType":"uint256","name":"premium","type":"uint256"},{"indexed":False,"internalType":"uint256","name":"coverage","type":"uint256"},{"indexed":False,"internalType":"uint64","name":"expiryTime","type":"uint64"}],"name":"PolicyPurchased","type":"event"},
    {"inputs":[{"internalType":"uint256","name":"basePremium","type":"uint256"},{"internalType":"uint256","name":"coverageAmount","type":"uint256"},{"internalType":"uint64","name":"durationSeconds","type":"uint64"}],"name":"purchasePolicy","outputs":[{"internalType":"uint256","name":"policyId","type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"address","name":"driver","type":"address"},{"internalType":"uint256","name":"premium","type":"uint256"},{"internalType":"uint256","name":"coverageAmount","type":"uint256"},{"internalType":"uint64","name":"durationSeconds","type":"uint64"}],"name":"purchasePolicyFor","outputs":[{"internalType":"uint256","name":"policyId","type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"policyId","type":"uint256"}],"name":"getPolicy","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"driver","type":"address"},{"internalType":"uint256","name":"premium","type":"uint256"},{"internalType":"uint256","name":"coverage","type":"uint256"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"expiryTime","type":"uint64"},{"internalType":"bool","name":"active","type":"bool"},{"internalType":"bool","name":"underReview","type":"bool"}],"internalType":"struct InsuranceTypes.Policy","name":"policy","type":"tuple"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"policyId","type":"uint256"}],"name":"isPolicyActive","outputs":[{"internalType":"bool","name":"active","type":"bool"}],"stateMutability":"view","type":"function"},
]

CLAIM_MANAGER_ABI = [
    {"anonymous":True,"inputs":[{"indexed":True,"internalType":"uint256","name":"claimId","type":"uint256"},{"indexed":True,"internalType":"uint256","name":"policyId","type":"uint256"},{"indexed":False,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ClaimSubmitted","type":"event"},
    {"anonymous":True,"inputs":[{"indexed":True,"internalType":"uint256","name":"claimId","type":"uint256"},{"indexed":False,"internalType":"address","name":"approvedBy","type":"address"}],"name":"ClaimApproved","type":"event"},
    {"anonymous":True,"inputs":[{"indexed":True,"internalType":"uint256","name":"claimId","type":"uint256"},{"indexed":False,"internalType":"address","name":"authorizedBy","type":"address"}],"name":"ClaimAuthorized","type":"event"},
    {"anonymous":True,"inputs":[{"indexed":True,"internalType":"uint256","name":"claimId","type":"uint256"},{"indexed":False,"internalType":"address","name":"driver","type":"address"},{"indexed":False,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PayoutCompleted","type":"event"},
    {"inputs":[{"internalType":"uint256","name":"policyId","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"submitClaim","outputs":[{"internalType":"uint256","name":"claimId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"driver","type":"address"},{"internalType":"uint256","name":"policyId","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"submitClaimFor","outputs":[{"internalType":"uint256","name":"claimId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"claimId","type":"uint256"},{"internalType":"bool","name":"isLegitimate","type":"bool"}],"name":"verifyAccident","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"claimId","type":"uint256"}],"name":"authorizeClaim","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"claimId","type":"uint256"}],"name":"approveClaim","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"claimId","type":"uint256"}],"name":"getClaim","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"policyId","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bool","name":"submitted","type":"bool"},{"internalType":"bool","name":"accidentVerified","type":"bool"},{"internalType":"bool","name":"approved","type":"bool"},{"internalType":"bool","name":"paid","type":"bool"}],"internalType":"struct InsuranceTypes.Claim","name":"claim","type":"tuple"}],"stateMutability":"view","type":"function"}],



def _w3() -> Web3:
    return Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": RPC_TIMEOUT}))


def _address(name: str) -> str:
    address = ADDRESSES.get(name, "")
    if not address:
        raise RuntimeError(f"{name.upper()}_ADDRESS is not configured")
    if not Web3.is_address(address):
        raise RuntimeError(f"Invalid {name} contract address")
    return Web3.to_checksum_address(address)


def _contract(w3: Web3, name: str, abi: list[dict[str, Any]]):
    return w3.eth.contract(address=_address(name), abi=abi)


def _require_signer(w3: Web3):
    if not INSURANCE_COMPANY_PRIVATE_KEY:
        raise RuntimeError("INSURANCE_COMPANY_PRIVATE_KEY is not configured")
    account = w3.eth.account.from_key(INSURANCE_COMPANY_PRIVATE_KEY)
    return account


def _send_signed(w3: Web3, tx: dict[str, Any]) -> str:
    account = _require_signer(w3)
    tx.setdefault("chainId", w3.eth.chain_id)
    tx.setdefault("nonce", w3.eth.get_transaction_count(account.address, "pending"))
    if "gas" not in tx:
        tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise RuntimeError("Blockchain transaction reverted")
    return Web3.to_hex(tx_hash)


def driver_identity(rider_id: int, wallet_address: str | None = None) -> str:
    if wallet_address and Web3.is_address(wallet_address):
        return Web3.to_checksum_address(wallet_address)
    digest = Web3.keccak(text=f"zenoguard:rider:{rider_id}")
    return Web3.to_checksum_address("0x" + Web3.to_hex(digest)[-40:])


def inr_to_wei(amount_inr: float) -> int:
    if amount_inr <= 0:
        raise ValueError("INR amount must be positive")
    return max(1, int(round(amount_inr * INR_TO_WEI)))


def status() -> dict[str, Any]:
    configured = {key: bool(value) for key, value in ADDRESSES.items()}
    w3 = _w3()
    connected = w3.is_connected()
    result: dict[str, Any] = {"configured": configured, "rpc_connected": connected, "rpc_url": RPC_URL, "chain_id": CHAIN_ID, "backend_signer_configured": bool(INSURANCE_COMPANY_PRIVATE_KEY)}
    if connected:
        result["network_chain_id"] = w3.eth.chain_id
        if INSURANCE_COMPANY_PRIVATE_KEY:
            result["backend_signer_address"] = _require_signer(w3).address
    return result


def build_driver_registration(wallet: str, driver_id: str) -> dict[str, Any]:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    wallet = Web3.to_checksum_address(wallet)
    driver_hash = Web3.keccak(text=driver_id)
    contract = _contract(w3, "driver_registry", DRIVER_REGISTRY_ABI)
    tx = contract.functions.registerDriverFor(wallet, driver_hash).build_transaction({"from": _require_signer(w3).address, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(_require_signer(w3).address, "pending")})
    return _serialise_tx(tx)


def build_policy_purchase(wallet: str, premium_wei: int, coverage_wei: int, duration_days: int) -> dict[str, Any]:
    if duration_days not in (7, 30, 90):
        raise ValueError("duration_days must be 7, 30, or 90")
    if premium_wei <= 0 or coverage_wei <= 0:
        raise ValueError("premium_wei and coverage_wei must be positive")
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    wallet = Web3.to_checksum_address(wallet)
    contract = _contract(w3, "insurance_policy", INSURANCE_POLICY_ABI)
    tx = contract.functions.purchasePolicyFor(wallet, premium_wei, coverage_wei, duration_days * 24 * 60 * 60).build_transaction({"from": _require_signer(w3).address, "value": premium_wei, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(_require_signer(w3).address, "pending")})
    return _serialise_tx(tx)


def purchase_policy_for(rider_id: int, wallet_address: str | None, premium_inr: float, coverage_inr: float, duration_days: int) -> dict[str, Any]:
    if duration_days not in (7, 30, 90):
        raise ValueError("duration_days must be 7, 30, or 90")
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    signer = _require_signer(w3)
    driver = driver_identity(rider_id, wallet_address)
    premium_wei = inr_to_wei(premium_inr)
    coverage_wei = inr_to_wei(coverage_inr)

    contract = _contract(w3, "insurance_policy", INSURANCE_POLICY_ABI)
    tx = contract.functions.purchasePolicyFor(driver, premium_wei, coverage_wei, duration_days * 24 * 60 * 60).build_transaction({"from": signer.address, "value": premium_wei, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(signer.address, "pending")})
    tx_hash = _send_signed(w3, tx)
    policy_id = get_policy_id_from_purchase(tx_hash)
    return {"policy_id": policy_id, "tx_hash": tx_hash, "driver": driver, "premium_wei": premium_wei, "coverage_wei": coverage_wei}


def submit_claim_for(rider_id: int, wallet_address: str | None, policy_id: int, amount_inr: float) -> dict[str, Any]:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    signer = _require_signer(w3)
    driver = driver_identity(rider_id, wallet_address)
    amount_wei = inr_to_wei(amount_inr)
    contract = _contract(w3, "claim_manager", CLAIM_MANAGER_ABI)
    tx = contract.functions.submitClaimFor(driver, policy_id, amount_wei).build_transaction({"from": signer.address, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(signer.address, "pending")})
    tx_hash = _send_signed(w3, tx)
    claim_id = get_claim_id_from_submission(tx_hash)
    return {"claim_id": claim_id, "tx_hash": tx_hash, "driver": driver, "amount_wei": amount_wei}


def verify_and_authorize_claim(claim_id: int, legitimate: bool = True) -> dict[str, Any]:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    signer = _require_signer(w3)
    contract = _contract(w3, "claim_manager", CLAIM_MANAGER_ABI)
    verify_tx = contract.functions.verifyAccident(claim_id, legitimate).build_transaction({"from": signer.address, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(signer.address, "pending")})
    verify_hash = _send_signed(w3, verify_tx)
    if not legitimate:
        return {"verify_tx_hash": verify_hash, "authorized": False}
    authorize_tx = contract.functions.authorizeClaim(claim_id).build_transaction({"from": signer.address, "chainId": w3.eth.chain_id, "nonce": w3.eth.get_transaction_count(signer.address, "pending")})
    authorize_hash = _send_signed(w3, authorize_tx)
    return {"verify_tx_hash": verify_hash, "authorize_tx_hash": authorize_hash, "authorized": True}


def get_transaction_receipt(tx_hash: str) -> dict[str, Any]:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    if not Web3.is_hexstr(tx_hash):
        raise ValueError("Invalid transaction hash")
    receipt = w3.eth.get_transaction_receipt(tx_hash)
    return {"tx_hash": Web3.to_hex(receipt.transactionHash), "status": int(receipt.status), "block_number": int(receipt.blockNumber), "gas_used": int(receipt.gasUsed), "contract_address": receipt.contractAddress}


def get_policy_id_from_purchase(tx_hash: str) -> int:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    contract = _contract(w3, "insurance_policy", INSURANCE_POLICY_ABI)
    receipt = w3.eth.get_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise RuntimeError("Policy purchase transaction reverted")
    events = contract.events.PolicyPurchased().process_receipt(receipt)
    if not events:
        raise RuntimeError("PolicyPurchased event not found in transaction")
    return int(events[-1]["args"]["policyId"])


def get_claim_id_from_submission(tx_hash: str) -> int:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    contract = _contract(w3, "claim_manager", CLAIM_MANAGER_ABI)
    receipt = w3.eth.get_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise RuntimeError("Claim submission transaction reverted")
    events = contract.events.ClaimSubmitted().process_receipt(receipt)
    if not events:
        raise RuntimeError("ClaimSubmitted event not found in transaction")
    return int(events[-1]["args"]["claimId"])


def get_onchain_policy(policy_id: int) -> dict[str, Any]:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    contract = _contract(w3, "insurance_policy", INSURANCE_POLICY_ABI)
    policy = contract.functions.getPolicy(policy_id).call()
    return {"id": int(policy[0]), "driver": policy[1], "premium_wei": int(policy[2]), "coverage_wei": int(policy[3]), "start_time": int(policy[4]), "expiry_time": int(policy[5]), "active": bool(policy[6]), "under_review": bool(policy[7])}


def get_onchain_claim(claim_id: int) -> dict[str, Any]:
    w3 = _w3()
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Ethereum RPC")
    contract = _contract(w3, "claim_manager", CLAIM_MANAGER_ABI)
    claim = contract.functions.getClaim(claim_id).call()
    return {"id": int(claim[0]), "policy_id": int(claim[1]), "amount_wei": int(claim[2]), "submitted": bool(claim[3]), "accident_verified": bool(claim[4]), "approved": bool(claim[5]), "paid": bool(claim[6])}


def _serialise_tx(tx: dict[str, Any]) -> dict[str, Any]:
    return {key: (Web3.to_hex(value) if isinstance(value, (bytes, bytearray)) else int(value) if isinstance(value, int) else value) for key, value in tx.items() if key in {"to", "from", "data", "value", "gas", "maxFeePerGas", "maxPriorityFeePerGas", "gasPrice", "nonce", "chainId"}}
