"""Minimal mock API for portfolio accounts (replace with real data source later)."""

from __future__ import annotations

import os

from flask import Flask, jsonify, request

from sample_accounts import tink_shaped_accounts


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "holdings_mock_service"})

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
