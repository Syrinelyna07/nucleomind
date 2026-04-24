import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    meta_verify_token: str = os.getenv("META_VERIFY_TOKEN", "change-me")
    meta_app_secret: str = os.getenv("META_APP_SECRET", "")
    meta_access_token: str = os.getenv("META_ACCESS_TOKEN", "")
    meta_graph_version: str = os.getenv("META_GRAPH_VERSION", "v20.0")
    meta_graph_base_url: str = os.getenv(
        "META_GRAPH_BASE_URL", "https://graph.facebook.com"
    )
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    csv_output_path: str = os.getenv(
        "CSV_OUTPUT_PATH",
        str(Path(__file__).resolve().parent / "outputs" / "collected_interactions.csv"),
    )


settings = Settings()
