from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
import hashlib

from .schemas import CanonicalInteraction, InteractionContext


def _generate_internal_id(source_key: str) -> str:
    digest = hashlib.sha1(source_key.encode("utf-8")).hexdigest()[:6]
    return f"msg_{digest}"


def _normalize_timestamp(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
            "+00:00", "Z"
        )

    cleaned = value.replace("Z", "+00:00")
    return datetime.fromisoformat(cleaned).astimezone(timezone.utc).replace(
        microsecond=0
    ).isoformat().replace("+00:00", "Z")


def _detect_language(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ["merci", "cher", "produit", "pharmacie"]):
        return "fr"
    if any(token in lowered for token in ["ghali", "ma l9itch", "mli7", "salam"]):
        return "ar-dz"
    if any(token in lowered for token in ["thank you", "price", "stock", "quality"]):
        return "en"
    return "unknown"


def _build_link(context: InteractionContext, detail: Dict[str, Any]) -> str:
    if context.platform == "instagram":
        media = detail.get("media", {})
        permalink = media.get("permalink", "")
        if permalink and context.comment_id:
            return f"{permalink}c/{context.comment_id}"
        return permalink or ""

    if context.platform == "facebook":
        permalink = detail.get("permalink_url", "")
        if permalink:
            return permalink
        if context.parent_group_id and context.comment_id:
            return (
                f"https://www.facebook.com/groups/{context.parent_group_id}/"
                f"posts/{context.parent_post_id or ''}?comment_id={context.comment_id}"
            )
        return ""

    return ""


def _extract_post_link(context: InteractionContext, detail: Dict[str, Any]) -> str:
    if context.platform == "instagram":
        return detail.get("media", {}).get("permalink", "")

    if context.platform == "facebook":
        parent = detail.get("parent", {})
        if isinstance(parent, dict):
            return parent.get("permalink_url", "") or detail.get("post_permalink", "")
        return detail.get("post_permalink", "")

    return ""


def _extract_post_description(context: InteractionContext, detail: Dict[str, Any]) -> str:
    if context.platform == "instagram":
        return detail.get("media", {}).get("caption", "") or ""

    if context.platform == "facebook":
        parent = detail.get("parent", {})
        if isinstance(parent, dict):
            return parent.get("message", "") or parent.get("story", "") or ""
        return detail.get("post_description", "") or ""

    return ""


def _extract_nb_comments(context: InteractionContext, detail: Dict[str, Any]) -> int | None:
    if context.platform == "instagram":
        media = detail.get("media", {})
        count = media.get("comments_count")
        return count if isinstance(count, int) else None

    if context.platform == "facebook":
        parent = detail.get("parent", {})
        if isinstance(parent, dict):
            if isinstance(parent.get("comments_count"), int):
                return parent["comments_count"]
            comments = parent.get("comments", {})
            if isinstance(comments, dict):
                summary = comments.get("summary", {})
                total = summary.get("total_count")
                if isinstance(total, int):
                    return total
        total = detail.get("nb_comments") or detail.get("post_total_comments")
        return total if isinstance(total, int) else None

    return None


def normalize_interaction(
    context: InteractionContext, detail: Dict[str, Any]
) -> CanonicalInteraction:
    text = detail.get("text") or detail.get("message") or ""
    author = ""
    if isinstance(detail.get("username"), str):
        author = detail["username"]
    elif isinstance(detail.get("from"), dict):
        author = detail["from"].get("name", "")
    elif isinstance(detail.get("from"), str):
        author = detail["from"]

    source_key = context.comment_id or context.message_id or context.event_id
    return CanonicalInteraction(
        id=_generate_internal_id(source_key),
        platform=context.platform,
        source_type=context.source_type,
        account_name=context.account_name,
        comment_link=_build_link(context, detail),
        post_link=_extract_post_link(context, detail),
        post_description=_extract_post_description(context, detail),
        nb_comments=_extract_nb_comments(context, detail),
        author_username=author or "unknown",
        content_text=text.strip(),
        content_language=_detect_language(text),
        created_at=_normalize_timestamp(
            detail.get("timestamp") or detail.get("created_time")
        ),
        sentiment_label="neutre",
        emotion_label="neutre",
        category_labels=["autre"],
        problem_labels=["autre"],
        problem_summary="En attente de classification.",
        is_urgent=False,
        urgency_reason="",
        recommended_solution=["Analyser le message pour determiner la prochaine action."],
        suggested_reply="Merci pour votre message. Nous revenons vers vous rapidement.",
        status="non-treated",
    )
