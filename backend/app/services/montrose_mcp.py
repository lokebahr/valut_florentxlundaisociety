"""Montrose MCP JSON-RPC client (Bearer access_token per end-user session)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional, Tuple


class McpError(RuntimeError):
    """Raised when MCP or HTTP response returns an error."""


class McpToolError(McpError):
    """Tool completed but reported failure (e.g. ``isError`` / unknown instrument)."""


@dataclass
class MontroseMcpConfig:
    base_url: str = "https://mcp.montrose.io"
    timeout: int = 30


class MontroseMcpClient:
    def __init__(self, config: Optional[MontroseMcpConfig] = None):
        self.config = config or MontroseMcpConfig()
        self._session_id: Optional[str] = None

    def initialize_session(self, access_token: str) -> str:
        payload = {
            "jsonrpc": "2.0",
            "id": "init-1",
            "method": "initialize",
            "params": {
                "capabilities": {},
                "clientInfo": {"name": "valut-backend", "version": "0.1.0"},
                "protocolVersion": "2025-06-18",
            },
        }
        _, headers = self._mcp_request_with_headers(payload, access_token, session_id=None)
        session_id = (
            headers.get("Mcp-Session-Id")
            or headers.get("mcp-session-id")
            or headers.get("MCP-Session-Id")
        )
        if not session_id:
            raise McpError("Initialize succeeded but no Mcp-Session-Id header was returned.")
        self._session_id = session_id
        return session_id

    def ensure_session(self, access_token: str) -> str:
        if self._session_id:
            return self._session_id
        return self.initialize_session(access_token)

    @staticmethod
    def tool_result_is_error(response: dict[str, Any]) -> bool:
        """True when the tool ran but reported failure (e.g. unknown instrument)."""
        result = response.get("result") or {}
        return bool(result.get("isError") or result.get("is_error"))

    @staticmethod
    def tool_result_text(response: dict[str, Any]) -> Optional[str]:
        result = response.get("result") or {}
        content = result.get("content") or []
        if not content:
            return None
        text = content[0].get("text")
        return str(text) if text is not None else None

    def call_tool(
        self,
        tool_name: str,
        arguments: Optional[dict[str, Any]] = None,
        *,
        access_token: str,
    ) -> dict[str, Any]:
        session_id = self.ensure_session(access_token)
        payload = {
            "jsonrpc": "2.0",
            "id": "tool-call-1",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments or {}},
        }
        data, _ = self._mcp_request_with_headers(payload, access_token, session_id=session_id)
        if MontroseMcpClient.tool_result_is_error(data):
            msg = MontroseMcpClient.tool_result_text(data) or json.dumps(data.get("result"), ensure_ascii=False)
            raise McpToolError(msg)
        return data

    def create_trade_ticket(
        self,
        side: str,
        *,
        orderbook_id: Optional[int] = None,
        ticker: Optional[str] = None,
        name: Optional[str] = None,
        quantity: Optional[float] = None,
        amount: Optional[float] = None,
        price: Optional[float] = None,
        account_id: Optional[str] = None,
        access_token: str,
    ) -> dict[str, Any]:
        if side not in ("Buy", "Sell"):
            raise McpError("side must be Buy or Sell.")
        if (quantity is None) == (amount is None):
            raise McpError("Exactly one of quantity or amount must be provided.")
        if orderbook_id is None and not ticker and not name:
            raise McpError("Provide one of orderbook_id, ticker, or name.")

        args: dict[str, Any] = {
            "side": side,
            "orderbookId": orderbook_id,
            "ticker": ticker,
            "name": name,
            "quantity": quantity,
            "amount": amount,
            "price": price,
            "accountId": account_id,
        }
        return self.call_tool(
            "create_trade_ticket",
            {k: v for k, v in args.items() if v is not None},
            access_token=access_token,
        )

    @staticmethod
    def decode_tool_text_result(response: dict[str, Any]) -> Any:
        result = response.get("result") or {}
        content = result.get("content") or []
        if not content:
            return None
        text = content[0].get("text")
        if text is None:
            return None
        try:
            return json.loads(text)
        except (TypeError, json.JSONDecodeError):
            return text

    def _mcp_request_with_headers(
        self,
        payload: dict[str, Any],
        access_token: str,
        session_id: Optional[str],
    ) -> Tuple[dict[str, Any], dict[str, str]]:
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        headers["Authorization"] = f"Bearer {access_token}"
        if session_id:
            headers["Mcp-Session-Id"] = session_id
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url=self.config.base_url, data=body, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
                raw = resp.read().decode("utf-8")
                resp_headers = {k: v for k, v in resp.headers.items()}
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
            raise McpError(f"HTTP {exc.code}: {error_body or exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise McpError(f"Network error: {exc}") from exc

        data = _parse_json_or_sse(raw)
        if "error" in data:
            raise McpError(f"MCP error: {json.dumps(data['error'], ensure_ascii=False)}")
        return data, resp_headers


def _parse_json_or_sse(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        data_lines = []
        for line in raw.splitlines():
            if line.startswith("data:"):
                data_lines.append(line[len("data:") :].strip())
        if not data_lines:
            raise McpError(f"Invalid JSON response: {raw[:500]}")
        try:
            return json.loads(data_lines[-1])
        except json.JSONDecodeError as exc:
            raise McpError(f"Invalid SSE JSON response: {raw[:500]}") from exc
