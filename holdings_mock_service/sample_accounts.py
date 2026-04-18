"""Replace this module later with real aggregation logic; shape must stay Tink-compatible for Valut."""

from __future__ import annotations

from typing import Any


def tink_shaped_accounts(*, user_id: int | None = None) -> dict[str, Any]:
    """
    Return a payload compatible with ``normalize_holdings`` / liquid-buffer helpers
    in the main Valut backend (``accounts`` list with CHECKING, SAVINGS, INVESTMENT).
    """
    _ = user_id  # reserved for per-user mocks later
    return {
        "accounts": [
            {
                "id": "mock-checking-1",
                "name": "Privatkonto",
                "type": "CHECKING",
                "balances": {
                    "booked": {
                        "amount": {
                            "currencyCode": "SEK",
                            "value": {"scale": "2", "unscaledValue": "4250000"},
                        }
                    }
                },
            },
            {
                "id": "mock-savings-buffer",
                "name": "Buffertsparkonto",
                "type": "SAVINGS",
                "balances": {
                    "booked": {
                        "amount": {
                            "currencyCode": "SEK",
                            "value": {"scale": "2", "unscaledValue": "9000000"},
                        }
                    }
                },
            },
            {
                "id": "mock-isk-1",
                "name": "ISK – Nordea Global Climate",
                "type": "INVESTMENT",
                "balances": {
                    "booked": {
                        "amount": {
                            "currencyCode": "SEK",
                            "value": {"scale": "2", "unscaledValue": "185000000"},
                        }
                    }
                },
            },
            {
                "id": "mock-isk-2",
                "name": "ISK – SEB Sverige Index",
                "type": "INVESTMENT",
                "balances": {
                    "booked": {
                        "amount": {
                            "currencyCode": "SEK",
                            "value": {"scale": "2", "unscaledValue": "72000000"},
                        }
                    }
                },
            },
        ],
        "nextPageToken": None,
        "source": "holdings_mock_service",
    }
