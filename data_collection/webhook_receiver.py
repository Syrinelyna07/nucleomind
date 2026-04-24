from __future__ import annotations

import hashlib
import hmac

from fastapi import FastAPI, Header, HTTPException, Query, Request

from .config import settings
from .exceptions import InvalidWebhookSignatureError, UnsupportedEventError
from .pipeline import SocialCollectionPipeline


app = FastAPI(title="CanBebe Social Collector")
pipeline = SocialCollectionPipeline()


@app.get("/meta/webhook")
async def verify_meta_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.meta_verify_token:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Invalid webhook verification token.")


@app.post("/meta/webhook")
async def receive_meta_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
):
    """Receive supported Meta events.

    Supported interaction types:
    - Instagram private comment
    - Instagram DM
    - Facebook Page private comment
    - Facebook Group comment
    - Facebook DM
    """
    raw_body = await request.body()
    try:
        _verify_meta_signature(raw_body, x_hub_signature_256)
        payload = await request.json()
        enriched = pipeline.process_events(payload)
    except InvalidWebhookSignatureError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except UnsupportedEventError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "received": True,
        "processed_count": len(enriched),
        "enriched_interactions": enriched,
    }


def _verify_meta_signature(raw_body: bytes, signature_header: str | None) -> None:
    if not settings.meta_app_secret:
        return
    if not signature_header:
        raise InvalidWebhookSignatureError("Missing X-Hub-Signature-256 header.")
    if not signature_header.startswith("sha256="):
        raise InvalidWebhookSignatureError("Invalid X-Hub-Signature-256 format.")

    expected = hmac.new(
        settings.meta_app_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    received = signature_header.split("=", 1)[1]
    if not hmac.compare_digest(expected, received):
        raise InvalidWebhookSignatureError("Invalid Meta webhook signature.")
