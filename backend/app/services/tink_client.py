from __future__ import annotations

import datetime as dt
from typing import Any
from urllib.parse import urlencode

import requests

from app.config import Config


class TinkClient:
    def __init__(self):
        self._base = Config.TINK_API_BASE.rstrip("/")
        self._client_id = Config.TINK_CLIENT_ID
        self._client_secret = Config.TINK_CLIENT_SECRET

    def client_credentials_token(self, scope: str) -> dict[str, Any]:
        return self._post_form(
            "/api/v1/oauth/token",
            {
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "grant_type": "client_credentials",
                "scope": scope,
            },
        )

    def _post_form(self, path: str, data: dict[str, str]) -> dict[str, Any]:
        url = f"{self._base}{path}"
        response = requests.post(url, data=data, timeout=30)
        response.raise_for_status()
        return response.json()

    def exchange_link_code_for_user_token(self, code: str) -> dict[str, Any]:
        return self._post_form(
            "/api/v1/oauth/token",
            {
                "code": code,
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "grant_type": "authorization_code",
            },
        )

    def fetch_accounts(self, user_access_token: str) -> dict[str, Any]:
        url = f"{self._base}/data/v2/accounts"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {user_access_token}"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def fetch_transactions(self, user_access_token: str, page_size: int = 100) -> dict[str, Any]:
        url = f"{self._base}/data/v2/transactions"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {user_access_token}"},
            params={"pageSize": page_size},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def build_transactions_link_url(self) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": Config.TINK_REDIRECT_URI,
            "market": "SE",
            "locale": "sv_SE",
        }
        return f"{Config.TINK_LINK_BASE}?{urlencode(params)}"


def parse_token_expiry(payload: dict[str, Any]) -> dt.datetime | None:
    expires_in = payload.get("expires_in")
    if not expires_in:
        return None
    try:
        return dt.datetime.utcnow() + dt.timedelta(seconds=int(expires_in))
    except (TypeError, ValueError):
        return None
