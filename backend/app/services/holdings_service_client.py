"""HTTP client for the optional holdings microservice (mock or future real provider)."""

from __future__ import annotations

from typing import Any

import requests

from app.config import Config


class HoldingsServiceError(RuntimeError):
    """Holdings service unreachable or returned an invalid payload."""


def fetch_tink_shaped_accounts(*, user_id: int | None = None) -> dict[str, Any]:
    """
    GET ``{HOLDINGS_SERVICE_URL}/v1/accounts`` — response must be a dict with an ``accounts`` list
    in the same shape as Tink's account list (see ``normalize_holdings``).
    """
    base = (Config.HOLDINGS_SERVICE_URL or "").strip().rstrip("/")
    if not base:
        raise HoldingsServiceError("HOLDINGS_SERVICE_URL is not set")

    params: dict[str, str] = {}
    if user_id is not None:
        params["user_id"] = str(user_id)

    url = f"{base}/v1/accounts"
    try:
        r = requests.get(url, params=params or None, timeout=Config.HOLDINGS_SERVICE_TIMEOUT)
    except requests.RequestException as exc:
        raise HoldingsServiceError(str(exc)) from exc

    if not r.ok:
        raise HoldingsServiceError(f"HTTP {r.status_code}: {(r.text or '')[:800]}")

    try:
        data = r.json()
    except ValueError as exc:
        raise HoldingsServiceError("Response is not JSON") from exc

    if not isinstance(data, dict) or "accounts" not in data:
        raise HoldingsServiceError("Holdings service must return a JSON object with an 'accounts' array")

    return data


def notify_recommended_allocation_applied(*, user_id: int, target_equity_share: float) -> None:
    """
    POST ``{HOLDINGS_SERVICE_URL}/v1/apply-recommended-allocation`` so the mock (or future provider)
    can reflect that the user switched to the recommended LF split.
    """
    base = (Config.HOLDINGS_SERVICE_URL or "").strip().rstrip("/")
    if not base:
        return

    url = f"{base}/v1/apply-recommended-allocation"
    try:
        r = requests.post(
            url,
            json={"user_id": user_id, "target_equity_share": float(target_equity_share)},
            timeout=Config.HOLDINGS_SERVICE_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HoldingsServiceError(str(exc)) from exc

    if not r.ok:
        raise HoldingsServiceError(f"HTTP {r.status_code}: {(r.text or '')[:800]}")
