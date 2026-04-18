import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class Settings:
    ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
    DATABASE_PATH: str = os.environ.get(
        "DATABASE_PATH",
        str(Path(__file__).resolve().parent.parent / "funds.db"),
    )
    PORT: int = int(os.environ.get("PORT", "8001"))


settings = Settings()
