"""Sandbox-style holdings when TINK_USE_MOCK=true or for demos."""

from __future__ import annotations

from typing import Any


def mock_tink_accounts_payload() -> dict[str, Any]:
    return {
        "accounts": [
            {
                "id": "acc-checking-1",
                "name": "Privatkonto",
                "type": "CHECKING",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "4250000"}}}
                },
            },
            {
                "id": "acc-savings-buffer",
                "name": "Buffertsparkonto",
                "type": "SAVINGS",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "9000000"}}}
                },
            },
            {
                "id": "acc-isk-1",
                "name": "ISK – Nordea Global Climate",
                "type": "INVESTMENT",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "185000000"}}}
                },
            },
            {
                "id": "acc-isk-2",
                "name": "ISK – SEB Sverige Index",
                "type": "INVESTMENT",
                "balances": {
                    "booked": {"amount": {"currencyCode": "SEK", "value": {"scale": "2", "unscaledValue": "72000000"}}}
                },
            },
        ],
        "nextPageToken": None,
    }


def mock_normalized_holdings() -> list[dict[str, Any]]:
    return [
        {
            "id": "h1",
            "account_id": "acc-isk-1",
            "name": "Nordea Global Climate Impact",
            "vehicle": "ISK",
            "domicile": "LU",
            "equity_share": 0.92,
            "bond_share": 0.08,
            "global_diversification_score": 0.78,
            "home_bias_equity": 0.05,
            "ongoing_fee_pct": 1.45,
            "benchmark": "MSCI World",
            "three_year_excess_vs_benchmark_pct": -0.8,
            "value_sek": 185_000,
            "notes": "Luxemburg-domicilerad fond i ISK: kan ge effekter via källskatt och skatteavtal jämfört med tillgångar i USA.",
        },
        {
            "id": "h2",
            "account_id": "acc-isk-2",
            "name": "SEB Sverige Indexfond",
            "vehicle": "ISK",
            "domicile": "SE",
            "equity_share": 0.98,
            "bond_share": 0.02,
            "global_diversification_score": 0.35,
            "home_bias_equity": 0.96,
            "ongoing_fee_pct": 0.20,
            "benchmark": "OMX Stockholm Benchmark",
            "three_year_excess_vs_benchmark_pct": 0.1,
            "value_sek": 72_000,
            "notes": "Mycket hög svensk hemma-bias; låg avgift men koncentrerad till Sverige.",
        },
    ]


def mock_buffer_accounts() -> list[dict[str, Any]]:
    return [
        {"id": "acc-checking-1", "name": "Privatkonto", "liquid_sek": 42_500},
        {"id": "acc-savings-buffer", "name": "Buffertsparkonto", "liquid_sek": 90_000},
    ]
