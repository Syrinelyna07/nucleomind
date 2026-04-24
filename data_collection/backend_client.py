from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import requests

from .config import settings
from .exceptions import DataCollectionError


class BackendSyncError(DataCollectionError):
    """Raised when syncing enriched interactions to the backend fails."""


@dataclass
class BackendClient:
    ingest_url: str = settings.backend_ingest_url
    timeout_seconds: int = settings.backend_timeout_seconds

    def is_enabled(self) -> bool:
        return bool(self.ingest_url)

    def send_batch(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not self.is_enabled():
            return {"success": False, "reason": "backend_ingest_url_not_configured"}

        try:
            response = requests.post(
                self.ingest_url,
                json={"items": items},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise BackendSyncError(
                f"Failed to sync interactions to backend: {exc}"
            ) from exc

        try:
            return response.json()
        except ValueError as exc:
            raise BackendSyncError(
                "Backend returned a non-JSON response during sync."
            ) from exc
