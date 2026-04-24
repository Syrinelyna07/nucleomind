from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable

from .config import settings


CSV_COLUMNS = [
    "id",
    "platform",
    "source_type",
    "account_name",
    "comment_link",
    "post_link",
    "post_description",
    "nb_comments",
    "author_username",
    "content_text",
    "content_language",
    "created_at",
    "sentiment_label",
    "emotion_label",
    "category_main",
    "category_labels",
    "problem_detected",
    "problem_labels",
    "problem_summary",
    "is_urgent",
    "urgency_reason",
    "recommended_solution",
    "solution_labels",
    "suggested_reply",
    "suggested_reply_options",
    "status",
]


@dataclass
class CSVExporter:
    output_path: str = settings.csv_output_path

    def append_rows(self, rows: Iterable[Dict[str, Any]]) -> None:
        path = Path(self.output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        file_exists = path.exists()

        with path.open("a", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_COLUMNS)
            if not file_exists:
                writer.writeheader()
            for row in rows:
                writer.writerow(self._serialize_row(row))

    def _serialize_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        serialized: Dict[str, Any] = {}
        for column in CSV_COLUMNS:
            value = row.get(column, "")
            if isinstance(value, list):
                serialized[column] = " | ".join(str(item) for item in value)
            elif isinstance(value, bool):
                serialized[column] = "true" if value else "false"
            elif value is None:
                serialized[column] = ""
            else:
                serialized[column] = value
        return serialized
