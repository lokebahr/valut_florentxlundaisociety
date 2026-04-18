"""Replace this module later with real aggregation logic; shape must stay Tink-compatible for Valut."""

from __future__ import annotations

from typing import Any

# After ``apply_recommended_allocation``, GET /v1/accounts?user_id= returns LF split for that user.
_user_target_equity: dict[int, float] = {}

# Combined default ISK notional (SEK) — recommended view keeps same total, different funds.
_DEFAULT_ISK_TOTAL_SEK = 1_850_000.0 + 720_000.0


def _money(scale: str, unscaled: int) -> dict[str, Any]:
    return {
        "currencyCode": "SEK",
        "value": {"scale": scale, "unscaledValue": str(int(unscaled))},
    }


def _default_accounts_payload() -> dict[str, Any]:
    return {
        "accounts": [
            {
                "id": "mock-checking-1",
                "name": "Privatkonto",
                "type": "CHECKING",
                "balances": {"booked": {"amount": _money("2", 4_250_000)}},
            },
            {
                "id": "mock-savings-buffer",
                "name": "Buffertsparkonto",
                "type": "SAVINGS",
                "balances": {"booked": {"amount": _money("2", 9_000_000)}},
            },
            {
                "id": "mock-isk-1",
                "name": "ISK – Europe Small Cap Class A-sek",
                "type": "INVESTMENT",
                "balances": {"booked": {"amount": _money("2", 185_000_000)}},
            },
            {
                "id": "mock-isk-2",
                "name": "ISK – Franklin Sustainable Global Growth Fund",
                "type": "INVESTMENT",
                "balances": {"booked": {"amount": _money("2", 72_000_000)}},
            },
        ],
        "nextPageToken": None,
        "source": "holdings_mock_service",
    }


def _recommended_accounts_payload(target_equity_share: float) -> dict[str, Any]:
    teq = max(0.0, min(1.0, float(target_equity_share)))
    eq_sek = round(_DEFAULT_ISK_TOTAL_SEK * teq, 2)
    bond_sek = round(_DEFAULT_ISK_TOTAL_SEK - eq_sek, 2)
    eq_unscaled = int(round(eq_sek * 100))
    bond_unscaled = int(round(bond_sek * 100))
    return {
        "accounts": [
            {
                "id": "mock-checking-1",
                "name": "Privatkonto",
                "type": "CHECKING",
                "balances": {"booked": {"amount": _money("2", 4_250_000)}},
            },
            {
                "id": "mock-savings-buffer",
                "name": "Buffertsparkonto",
                "type": "SAVINGS",
                "balances": {"booked": {"amount": _money("2", 9_000_000)}},
            },
            {
                "id": "mock-isk-lf-global",
                "name": "ISK – Länsförsäkringar Global Index",
                "type": "INVESTMENT",
                "balances": {"booked": {"amount": _money("2", eq_unscaled)}},
            },
            {
                "id": "mock-isk-lf-bond",
                "name": "ISK – Länsförsäkringar Kort Räntefond",
                "type": "INVESTMENT",
                "balances": {"booked": {"amount": _money("2", bond_unscaled)}},
            },
        ],
        "nextPageToken": None,
        "source": "holdings_mock_service",
        "allocation_applied": "recommended",
    }


def apply_recommended_allocation(*, user_id: int, target_equity_share: float) -> None:
    """Persist mock state so GET /v1/accounts?user_id= reflects the user's target split (LF funds)."""
    _user_target_equity[int(user_id)] = max(0.0, min(1.0, float(target_equity_share)))


def tink_shaped_accounts(*, user_id: int | None = None) -> dict[str, Any]:
    """
    Return a payload compatible with ``normalize_holdings`` / liquid-buffer helpers
    in the main Valut backend (``accounts`` list with CHECKING, SAVINGS, INVESTMENT).
    """
    if user_id is not None and int(user_id) in _user_target_equity:
        return _recommended_accounts_payload(_user_target_equity[int(user_id)])
    return _default_accounts_payload()
