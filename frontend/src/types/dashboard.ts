export type Overview = {
  profile: {
    risk_tolerance: number | null
    time_horizon_years: number | null
    savings_purpose: string | null
    monthly_contribution_sek: number | null
  }
  buffer: Record<string, unknown> | null
  holdings: Record<string, unknown>[]
  analysis: Record<string, unknown>
  alerts: { kind: string; severity: string; message: string }[]
  snapshot_at: string
  montrose_client_configured: boolean
  montrose_connected: boolean
  montrose_enabled: boolean
  montrose_show_prepare_switch?: boolean
  montrose_buy_plan?: {
    amount_sek: number
    target_equity_share: number
    buy_lines: {
      target_fund_name: string
      amount_sek: number
      target_weight: number
      montrose_orderbook_id?: number
    }[]
    source_holdings: { name: string; value_sek: number }[]
  } | null
}
