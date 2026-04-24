from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional


VALID_PLATFORMS = {"instagram", "facebook"}
VALID_SOURCE_TYPES = {"public_comment", "private_comment", "private_dm"}
VALID_SENTIMENTS = {"positif", "neutre", "negatif"}
VALID_EMOTIONS = {
    "satisfaction",
    "frustration",
    "confiance",
    "colere",
    "deception",
    "neutre",
}
VALID_CATEGORIES = {
    "prix",
    "disponibilite",
    "qualite",
    "confort",
    "absorption",
    "service_client",
    "autre",
}
VALID_STATUS = {"non-treated", "analyzed", "resolved"}


@dataclass
class CanonicalInteraction:
    id: str
    platform: str
    source_type: str
    account_name: str
    comment_link: str
    post_link: str
    post_description: str
    nb_comments: Optional[int]
    author_username: str
    content_text: str
    content_language: str
    created_at: str
    sentiment_label: str
    emotion_label: str
    category_labels: str
    problem_labels: List[str]
    problem_summary: str
    is_urgent: bool
    urgency_reason: str
    recommended_solution: List[str]
    suggested_reply: str
    status: str = "non-treated"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class InteractionContext:
    platform: str
    source_type: str
    event_id: str
    account_id: str
    account_name: str
    comment_id: Optional[str] = None
    message_id: Optional[str] = None
    parent_media_id: Optional[str] = None
    parent_post_id: Optional[str] = None
    parent_group_id: Optional[str] = None
    access_mode: str = "full"
    raw_event: Optional[Dict[str, Any]] = None
