from __future__ import annotations

from typing import Any, Dict, List

from .csv_exporter import CSVExporter
from .event_parser import parse_event_payload
from .exceptions import MetaApiError, UnsupportedEventError
from .llm_classifier import LLMClassifier
from .meta_api_client import MetaApiClient
from .normalizer import normalize_interaction
from .schemas import InteractionContext


class SocialCollectionPipeline:
    def __init__(
        self,
        meta_client: MetaApiClient | None = None,
        classifier: LLMClassifier | None = None,
        csv_exporter: CSVExporter | None = None,
    ) -> None:
        self.meta_client = meta_client or MetaApiClient()
        self.classifier = classifier or LLMClassifier()
        self.csv_exporter = csv_exporter or CSVExporter()

    def process_event(self, event_payload: Dict[str, Any]) -> Dict[str, Any]:
        results = self.process_events(event_payload)
        if not results:
            raise UnsupportedEventError("No supported interactions were processed.")
        return results[0]

    def process_events(self, event_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        seen_ids: set[str] = set()
        results: List[Dict[str, Any]] = []
        for context, value in parse_event_payload(event_payload):
            if context.event_id in seen_ids:
                continue
            seen_ids.add(context.event_id)
            try:
                results.append(self._process_single_change(context, value))
            except UnsupportedEventError:
                continue
        if results:
            self.csv_exporter.append_rows(results)
        return results

    def _process_single_change(
        self, context: InteractionContext, value: Dict[str, Any]
    ) -> Dict[str, Any]:
        detail = self._fetch_details(context, value)
        canonical = normalize_interaction(context, detail)
        enrichment = self.classifier.classify(
            canonical.platform,
            canonical.source_type,
            canonical.content_text,
        )
        canonical.sentiment_label = enrichment["sentiment_label"]
        canonical.emotion_label = enrichment["emotion_label"]
        canonical.category_labels = enrichment["category_labels"]
        canonical.problem_labels = enrichment["problem_labels"]
        canonical.problem_summary = enrichment["problem_summary"]
        canonical.is_urgent = enrichment["is_urgent"]
        canonical.urgency_reason = enrichment["urgency_reason"]
        canonical.recommended_solution = enrichment["recommended_solution"]
        canonical.suggested_reply = enrichment["suggested_reply"]
        canonical.status = "non-treated"
        return canonical.to_dict()

    def _fetch_details(
        self, context: InteractionContext, value: Dict[str, Any]
    ) -> Dict[str, Any]:
        fallback_detail = value.get("mock_detail")
        try:
            if context.platform == "instagram" and context.source_type == "private_comment":
                return self.meta_client.fetch_instagram_comment_details(
                    context.comment_id or "",
                    account_name=context.account_name,
                    fallback_data=fallback_detail,
                )
            if context.platform == "instagram" and context.source_type == "private_dm":
                return self.meta_client.fetch_instagram_dm_details(
                    context.message_id or "",
                    account_name=context.account_name,
                    fallback_data=fallback_detail,
                )
            if (
                context.platform == "facebook"
                and context.source_type == "private_comment"
            ):
                return self.meta_client.fetch_facebook_comment_details(
                    context.comment_id or "",
                    account_name=context.account_name,
                    fallback_data=fallback_detail,
                )
            if (
                context.platform == "facebook"
                and context.source_type == "public_comment"
                and context.parent_group_id
            ):
                return self.meta_client.fetch_facebook_group_comment_details(
                    context.comment_id or "",
                    account_name=context.account_name,
                    fallback_data=fallback_detail,
                )
            if context.platform == "facebook" and context.source_type == "private_dm":
                return self.meta_client.fetch_facebook_dm_details(
                    context.message_id or "",
                    account_name=context.account_name,
                    fallback_data=fallback_detail,
                )
        except MetaApiError:
            if fallback_detail:
                return fallback_detail
            raise
        raise UnsupportedEventError("Unable to fetch details for unsupported interaction type.")
