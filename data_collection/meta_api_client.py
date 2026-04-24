from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests

from .config import settings
from .exceptions import MetaApiError, MetaPermissionError, MetaRateLimitError


@dataclass
class MetaApiClient:
    access_token: str = settings.meta_access_token
    graph_version: str = settings.meta_graph_version
    base_url: str = settings.meta_graph_base_url

    def _get(self, object_id: str, fields: str) -> Dict[str, Any]:
        if not self.access_token:
            raise RuntimeError("META_ACCESS_TOKEN is missing.")

        try:
            response = requests.get(
                f"{self.base_url}/{self.graph_version}/{object_id}",
                params={"fields": fields, "access_token": self.access_token},
                timeout=20,
            )
        except requests.RequestException as exc:
            raise MetaApiError(f"Meta request failed for object {object_id}.") from exc

        if response.status_code == 429:
            raise MetaRateLimitError("Meta rate limit reached.")
        if response.status_code >= 400:
            self._raise_meta_error(response)

        try:
            return response.json()
        except ValueError as exc:
            raise MetaApiError("Meta returned an invalid JSON payload.") from exc

    def _raise_meta_error(self, response: requests.Response) -> None:
        try:
            payload = response.json()
        except ValueError:
            raise MetaApiError(
                f"Meta API error with status {response.status_code}."
            ) from None

        error = payload.get("error", {})
        message = error.get("message", "Unknown Meta API error.")
        code = error.get("code")
        subcode = error.get("error_subcode")

        if response.status_code in {401, 403} or code in {10, 200, 230}:
            raise MetaPermissionError(
                f"Meta permission error: {message} (code={code}, subcode={subcode})"
            )
        if response.status_code == 429 or code in {4, 17, 32, 613}:
            raise MetaRateLimitError(
                f"Meta rate limit error: {message} (code={code}, subcode={subcode})"
            )
        raise MetaApiError(
            f"Meta API error: {message} (code={code}, subcode={subcode})"
        )

    def fetch_instagram_comment_details(
        self,
        comment_id: str,
        account_name: str = "",
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if fallback_data:
            return fallback_data
        return self._get(
            comment_id,
            "id,text,timestamp,username,like_count,media{id,permalink,caption,comments_count,media_type}",
        )

    def fetch_instagram_dm_details(
        self,
        message_id: str,
        account_name: str = "",
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if fallback_data:
            return fallback_data
        return self._get(
            message_id,
            "id,message,created_time,from,to",
        )

    def fetch_facebook_comment_details(
        self,
        comment_id: str,
        account_name: str = "",
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if fallback_data:
            return fallback_data
        return self._get(
            comment_id,
            "id,message,created_time,from,permalink_url,attachment,parent{id,message,story,permalink_url,comments.limit(0).summary(true)}",
        )

    def fetch_facebook_group_comment_details(
        self,
        comment_id: str,
        account_name: str = "",
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if fallback_data:
            return fallback_data
        return self._get(
            comment_id,
            "id,message,created_time,from,permalink_url,parent{id,message,story,permalink_url,comments.limit(0).summary(true)}",
        )

    def fetch_facebook_dm_details(
        self,
        message_id: str,
        account_name: str = "",
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if fallback_data:
            return fallback_data
        return self._get(
            message_id,
            "id,message,created_time,from,to",
        )
