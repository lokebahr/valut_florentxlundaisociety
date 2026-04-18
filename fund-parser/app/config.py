import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


_ROOT = Path(__file__).resolve().parent.parent


class Settings:
    ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
    DATABASE_PATH: str = os.environ.get(
        "DATABASE_PATH",
        str(_ROOT / "funds.db"),
    )
    PORT: int = int(os.environ.get("PORT", "8000"))
    """Directory with factsheet PDFs (e.g. ``ISIN_LU123_sv_SE_last.pdf``)."""
    FUNDS_PDF_DIR: Path = Path(os.environ.get("FUNDS_PDF_DIR", str(_ROOT / "funds"))).expanduser().resolve()


settings = Settings()
