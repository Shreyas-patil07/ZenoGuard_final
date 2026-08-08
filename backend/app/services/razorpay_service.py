import hashlib
import hmac
import os
import uuid
from typing import Optional

import requests
import razorpay


class RazorpayConfigError(RuntimeError):
    pass


def _credentials():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RazorpayConfigError("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")
    return key_id, key_secret


def client():
    key_id, key_secret = _credentials()
    return razorpay.Client(auth=(key_id, key_secret))


def create_order(*, amount_inr: float, receipt: str, notes: Optional[dict] = None) -> dict:
    if amount_inr <= 0:
        raise ValueError("Payment amount must be positive")
    amount_paise = int(round(amount_inr * 100))
    return client().order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": notes or {},
    })


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    _, key_secret = _credentials()
    message = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(key_secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not secret:
        raise RazorpayConfigError("RAZORPAY_WEBHOOK_SECRET is not configured.")
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _x_request(method: str, path: str, *, json_body: Optional[dict] = None, headers: Optional[dict] = None) -> dict:
    key_id, key_secret = _credentials()
    response = requests.request(
        method,
        f"https://api.razorpay.com/v1{path}",
        auth=(key_id, key_secret),
        json=json_body,
        headers=headers or {},
        timeout=20,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Razorpay API error {response.status_code}: {response.text[:500]}")
    return response.json()


def create_contact(*, name: str, email: str, phone: str, reference_id: str) -> dict:
    return _x_request("POST", "/contacts", json_body={
        "name": name[:50],
        "email": email,
        "contact": phone,
        "type": "customer",
        "reference_id": reference_id[:40],
    })


def create_vpa_fund_account(*, contact_id: str, upi_id: str) -> dict:
    return _x_request("POST", "/fund_accounts", json_body={
        "contact_id": contact_id,
        "account_type": "vpa",
        "vpa": {"address": upi_id},
    })


def create_vpa_payout(*, fund_account_id: str, amount_inr: float, reference_id: str) -> dict:
    amount_paise = int(round(amount_inr * 100))
    if amount_paise <= 0:
        raise ValueError("Payout amount must be positive")
    account_number = os.getenv("RAZORPAYX_ACCOUNT_NUMBER")
    if not account_number:
        raise RazorpayConfigError("RAZORPAYX_ACCOUNT_NUMBER is not configured.")
    return _x_request(
        "POST",
        "/payouts",
        json_body={
            "account_number": account_number,
            "fund_account_id": fund_account_id,
            "amount": amount_paise,
            "currency": "INR",
            "mode": "UPI",
            "purpose": "payout",
            "queue_if_low_balance": True,
            "reference_id": reference_id[:40],
        },
        headers={"X-Payout-Idempotency": str(uuid.uuid4())},
    )
