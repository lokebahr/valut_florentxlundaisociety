import os
from pathlib import Path


class Config:
    SECRET_KEY = os.environ.get(
        "SECRET_KEY",
        "dev-only-change-me-please-use-32bytes-min",
    )
    DATABASE_PATH = os.environ.get(
        "DATABASE_PATH",
        str(Path(__file__).resolve().parent.parent / "valut.db"),
    )
    JWT_EXPIRATION_SECONDS = int(os.environ.get("JWT_EXPIRATION_SECONDS", "86400"))

    TINK_CLIENT_ID = os.environ.get("TINK_CLIENT_ID", "")
    TINK_CLIENT_SECRET = os.environ.get("TINK_CLIENT_SECRET", "")
    TINK_LINK_BASE = os.environ.get(
        "TINK_LINK_BASE",
        "https://link.tink.com/1.0/transactions/connect-accounts",
    )
    TINK_API_BASE = os.environ.get("TINK_API_BASE", "https://api.tink.com")
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    TINK_REDIRECT_URI = os.environ.get(
        "TINK_REDIRECT_URI",
        f"{os.environ.get('FRONTEND_ORIGIN', 'http://localhost:5173')}/auth/tink-callback",
    )

    BUFFER_MONTHS_EXPENSES = int(os.environ.get("BUFFER_MONTHS_EXPENSES", "3"))

    # Montrose MCP: OAuth client_id is obtained via POST {issuer}/register per connect flow; tokens per user in DB.
    MONTROSE_MCP_BASE_URL = os.environ.get("MONTROSE_MCP_BASE_URL", "https://mcp.montrose.io")
    MONTROSE_ISSUER = os.environ.get(
        "MONTROSE_ISSUER",
        os.environ.get("MONTROSE_MCP_ISSUER", "https://mcp.montrose.io"),
    )
    MONTROSE_MCP_TIMEOUT = int(os.environ.get("MONTROSE_MCP_TIMEOUT", "30"))
    MONTROSE_REDIRECT_URI = os.environ.get(
        "MONTROSE_REDIRECT_URI",
        f"{os.environ.get('FRONTEND_ORIGIN', 'http://localhost:5173')}/auth/montrose-callback",
    )
    MONTROSE_SCOPE = os.environ.get("MONTROSE_SCOPE", "mcp")
    MONTROSE_CLIENT_NAME = os.environ.get("MONTROSE_CLIENT_NAME", "Valut")


def load_config(app):
    app.config.from_object(Config)
