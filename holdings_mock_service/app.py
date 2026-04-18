"""Minimal mock API for portfolio accounts (replace with real data source later)."""

from __future__ import annotations

import os

from flask import Flask, jsonify, request

from sample_accounts import apply_recommended_allocation, tink_shaped_accounts


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "holdings_mock_service"})

    @app.post("/v1/apply-recommended-allocation")
    def v1_apply_recommended_allocation():
        """
        Called by Valut after the user commits to switching allocation (Montrose flow).
        Subsequent GET /v1/accounts?user_id= returns ISK holdings as LF Global Index + Kort Räntefond.
        """
        body = request.get_json(silent=True) or {}
        raw_uid = body.get("user_id")
        raw_teq = body.get("target_equity_share")
        try:
            user_id = int(raw_uid)
        except (TypeError, ValueError):
            return jsonify({"error": "user_id must be an integer"}), 400
        try:
            target_equity_share = float(raw_teq)
        except (TypeError, ValueError):
            return jsonify({"error": "target_equity_share must be a number"}), 400
        apply_recommended_allocation(user_id=user_id, target_equity_share=target_equity_share)
        return jsonify(
            {
                "ok": True,
                "user_id": user_id,
                "target_equity_share": max(0.0, min(1.0, target_equity_share)),
            }
        )

    @app.get("/v1/accounts")
    def v1_accounts():
        """
        Tink-shaped account list for Valut ``normalize_holdings`` / buffer analysis.
        Optional: ``?user_id=`` for future per-user fixtures.
        """
        raw = request.args.get("user_id")
        user_id: int | None = None
        if raw is not None and raw != "":
            try:
                user_id = int(raw)
            except ValueError:
                return jsonify({"error": "user_id must be an integer"}), 400
        return jsonify(tink_shaped_accounts(user_id=user_id))

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5280"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "1") == "1")
