import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..models import Payout
from ..routers.payments import finalize_order_paid
from ..services.razorpay_service import RazorpayConfigError, verify_webhook_signature

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(default=None),
    x_razorpay_event_id: str | None = Header(default=None),
):
    raw_body = await request.body()
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay webhook signature")

    try:
        valid = verify_webhook_signature(raw_body, x_razorpay_signature)
    except RazorpayConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON")

    event = payload.get("event")
    db: Session = SessionLocal()
    try:
        if event == "order.paid":
            order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})
            payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = order_entity.get("id")
            payment_id = payment_entity.get("id")
            if not order_id:
                raise HTTPException(status_code=400, detail="order.paid webhook missing order ID")
            result = finalize_order_paid(db, order_id, payment_id, x_razorpay_event_id)
            db.commit()
            return {"received": True, **result}

        if event.startswith("payout."):
            payout_entity = payload.get("payload", {}).get("payout", {}).get("entity", {})
            payout_id = payout_entity.get("id")
            if not payout_id:
                raise HTTPException(status_code=400, detail="Payout webhook missing payout ID")
            payout = db.query(Payout).filter(Payout.tx_hash == payout_id).first()
            if not payout:
                return {"received": True, "handled": False, "reason": "unknown_payout"}
            payout.status = str(payout_entity.get("status", "processing")).upper()
            db.commit()
            return {"received": True, "handled": True, "payout_id": payout.id, "status": payout.status}

        return {"received": True, "handled": False, "event": event}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
