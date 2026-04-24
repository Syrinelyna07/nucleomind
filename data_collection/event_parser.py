from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .exceptions import UnsupportedEventError
from .schemas import InteractionContext


ParsedChange = Tuple[InteractionContext, Dict[str, Any]]


def parse_event_payload(event_payload: Dict[str, Any]) -> List[ParsedChange]:
    entries = event_payload.get("entry")
    if not isinstance(entries, list) or not entries:
        raise UnsupportedEventError("Invalid Meta payload: missing entry list.")

    parsed: List[ParsedChange] = []
    for entry in entries:
        for change in entry.get("changes", []):
            context = _build_context(entry, change, event_payload)
            parsed.append((context, change.get("value", {})))

    if not parsed:
        raise UnsupportedEventError("No supported Meta changes found in payload.")
    return parsed


def _build_context(
    entry: Dict[str, Any], change: Dict[str, Any], raw_event: Dict[str, Any]
) -> InteractionContext:
    value = change.get("value", {})
    platform = entry.get("platform")
    event_type = value.get("event_type")

    if platform == "instagram" and event_type == "comment":
        return InteractionContext(
            platform="instagram",
            source_type="public_comment",
            event_id=value["comment_id"],
            account_id=entry["id"],
            account_name=value["account_name"],
            comment_id=value["comment_id"],
            parent_media_id=value.get("media_id"),
            raw_event=raw_event,
        )
    if platform == "instagram" and event_type == "dm":
        return InteractionContext(
            platform="instagram",
            source_type="private_dm",
            event_id=value["message_id"],
            account_id=entry["id"],
            account_name=value["account_name"],
            message_id=value["message_id"],
            raw_event=raw_event,
        )
    if platform == "facebook" and event_type == "comment":
        return InteractionContext(
            platform="facebook",
            source_type="public_comment",
            event_id=value["comment_id"],
            account_id=entry["id"],
            account_name=value["page_name"],
            comment_id=value["comment_id"],
            parent_post_id=value.get("post_id"),
            raw_event=raw_event,
        )
    if platform == "facebook" and event_type == "group_comment":
        return InteractionContext(
            platform="facebook",
            source_type="public_comment",
            event_id=value["comment_id"],
            account_id=entry["id"],
            account_name=value.get("group_name") or value.get("page_name") or "facebook_group",
            comment_id=value["comment_id"],
            parent_post_id=value.get("post_id"),
            parent_group_id=value.get("group_id"),
            access_mode=value.get("access_mode", "partial"),
            raw_event=raw_event,
        )
    if platform == "facebook" and event_type == "dm":
        return InteractionContext(
            platform="facebook",
            source_type="private_dm",
            event_id=value["message_id"],
            account_id=entry["id"],
            account_name=value["page_name"],
            message_id=value["message_id"],
            raw_event=raw_event,
        )
    raise UnsupportedEventError(
        f"Unsupported Meta event: platform={platform}, event_type={event_type}"
    )
