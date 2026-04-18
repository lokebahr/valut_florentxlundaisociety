import { OverviewReengageBanner } from './OverviewReengageBanner'
import { SavingsGoalPanel } from './SavingsGoalPanel'
import type { Overview } from '../types/dashboard'

const ILLUSTRATIVE_GROSS_RETURN = 0.045
const RECOMMENDED_BLEND_FEE_PCT = 0.19

function weightedAvgFeePct(holdings: Record<string, unknown>[]): number {
  let t = 0; let w = 0
  for (const h of holdings) {
    const v = Number(h.value_sek) || 0
    if (v <= 0) continue
    const f = Number(h.ongoing_fee_pct)
    if (!Number.isFinite(f)) continue
    t += v * f; w += v
  }
  return w > 0 ? t / w : RECOMMENDED_BLEND_FEE_PCT
}

function totalValueSek(holdings: Record<string, unknown>[]): number {
  return holdings.reduce((s, h) => s + (Number(h.value_sek) || 0), 0)
}

function formatFeePct(pct: number): string {
  return `${pct.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

function projectedSavingSek(totalStart: number, feeCurrent: number, feeTarget: number): number {
  let hi = totalStart, lo = totalStart
  const dc = feeCurrent / 100, dt = feeTarget / 100
  for (let y = 0; y < 10; y++) {
    hi *= 1 + ILLUSTRATIVE_GROSS_RETURN - dc
    lo *= 1 + ILLUSTRATIVE_GROSS_RETURN - dt
  }
  return Math.round(lo - hi)
}

function motivationForSwitch(holdingName: string, issues: { title?: string; body?: string }[]): string {
  const feeIssue = issues.find((i) => (i.title || '').toLowerCase().includes('avgift'))
  if (feeIssue) return feeIssue.title + ' — indexfonder med lägre avgift behåller mer av avkastningen.'
  return 'Byte mot målbilden sänker kostnader och anpassar risken till din profil.'
}

function HoldingRow({
  name, valueSek, totalSek, feePct, variant,
}: { name: string; valueSek: number; totalSek: number; feePct: number | null; variant: 'current' | 'target' }) {
  const share = totalSek > 0 ? (valueSek / totalSek) * 100 : 0
  return (
    <div className={`ov-holding ov-holding--${variant}`}>
      <div className="ov-holding__top">
        <span className="ov-holding__name" title={name}>{name}</span>
        <span className="ov-holding__value">
          {valueSek > 0 ? `${valueSek.toLocaleString('sv-SE')} kr` : 'Målfond'}
        </span>
      </div>
      <div className="ov-holding__bar-wrap">
        <div className="ov-holding__bar" style={{ width: `${Math.max(share, 2)}%` }} />
      </div>
      <p className="ov-holding__meta">
        {valueSek > 0 ? `${share.toFixed(0)} % av portfölj` : ''}
        {feePct !== null ? `${valueSek > 0 ? ' · ' : ''}Avgift ${formatFeePct(feePct)}` : ''}
      </p>
    </div>
  )
}

export type DashboardOverviewProps = {
  data: Overview
  showMontrosePrepare: boolean
  montroseBuyPlan: Overview['montrose_buy_plan']
  montroseConnected: boolean
  montroseBusy: boolean
  montroseConnectBusy: boolean
  montroseError: string | null
  montroseConnectError: string | null
  montroseHint: string | null
  canMontrose: boolean
  onMontroseConnect: () => void
  onMontrosePrepare: () => void
}

export function DashboardOverview({
  data,
  showMontrosePrepare,
  montroseBuyPlan,
  montroseConnected,
  montroseBusy,
  montroseConnectBusy,
  montroseError,
  montroseConnectError,
  montroseHint,
  canMontrose,
  onMontroseConnect,
  onMontrosePrepare,
}: DashboardOverviewProps) {
  const holdings = data.holdings || []
  const analysis = data.analysis as {
    issues?: { title?: string; body?: string }[]
    suggested_funds?: { name: string; rationale: string; target_weight?: number }[]
  }
  const issues = analysis.issues || []
  const suggested = analysis.suggested_funds || []
  const feeW = weightedAvgFeePct(holdings)
  const total = totalValueSek(holdings)
  const followsAdvice = !showMontrosePrepare

  const aiRecs = data.recommendations?.recommendations ?? null
  const recommendedPreview: { name: string; value_sek: number; ongoing_fee_pct: number }[] =
    aiRecs?.length
      ? aiRecs.map((r) => ({
          name: r.name,
          value_sek: Math.round((r.suggested_weight_pct / 100) * total),
          ongoing_fee_pct: r.ongoing_fee_pct ?? 0,
        }))
      : montroseBuyPlan?.buy_lines?.map((line) => ({
          name: line.target_fund_name,
          value_sek: line.amount_sek,
          ongoing_fee_pct: 0.19,
        })) ??
        suggested.map((s) => ({
          name: s.name,
          value_sek: Math.round((s.target_weight ?? 0) * total),
          ongoing_fee_pct: 0.19,
        }))

  const recAvgFee = aiRecs?.length
    ? aiRecs.reduce((s, r) => s + (r.ongoing_fee_pct ?? 0) * (r.suggested_weight_pct / 100), 0)
    : RECOMMENDED_BLEND_FEE_PCT

  const saving10yr = projectedSavingSek(total, feeW, recAvgFee)

  return (
    <div className="ov step-animate">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <header className="ov-hero">
        <div className="ov-hero__inner">
          <div className="ov-hero__left">
            <p className="ov-hero__eyebrow">Portföljvärde</p>
            <p className="ov-hero__value">
              {total.toLocaleString('sv-SE')}<span className="ov-hero__currency"> kr</span>
            </p>
          </div>
          <div className="ov-hero__right">
            <div className="ov-hero__stats">
              <div className="ov-stat">
                <span className="ov-stat__label">Snittavgift</span>
                <span className="ov-stat__value">{formatFeePct(feeW)}</span>
              </div>
              <div className="ov-stat">
                <span className="ov-stat__label">Fonder</span>
                <span className="ov-stat__value">{holdings.length}</span>
              </div>
              {data.profile.time_horizon_years && (
                <div className="ov-stat">
                  <span className="ov-stat__label">Horisont</span>
                  <span className="ov-stat__value">{data.profile.time_horizon_years} år</span>
                </div>
              )}
            </div>
            <div className="ov-hero__divider" aria-hidden />
            <span className={`ov-badge ov-badge--${followsAdvice ? 'ok' : 'warn'}`}>
              {followsAdvice ? '✓ Portföljmål uppnått' : `${issues.length} förbättring${issues.length !== 1 ? 'ar' : ''} tillgänglig`}
            </span>
          </div>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <div className="ov-body">

        {/* ── NOT ALIGNED — action needed ─────────────────────── */}
        {showMontrosePrepare && (
          <>
            {/* Action CTA */}
            <div className="ov-card ov-card--action">
              <div className="ov-card__action-inner">
                <div>
                  <h2 className="ov-card__title">Genomför bytet</h2>
                  <p className="ov-card__sub">
                    Vi förbereder köp utifrån din profil — du slutför i din banks fondhandel.
                  </p>
                </div>
                <div className="ov-card__action-btns">
                  {!montroseConnected && (
                    <button
                      type="button"
                      className="ov-btn-white"
                      disabled={montroseConnectBusy}
                      onClick={onMontroseConnect}
                    >
                      {montroseConnectBusy ? 'Ansluter…' : 'Anslut din bank'}
                    </button>
                  )}
                  {montroseConnected && montroseBuyPlan && (
                    <button
                      type="button"
                      className="ov-btn-white"
                      disabled={!canMontrose || montroseBusy}
                      onClick={onMontrosePrepare}
                    >
                      {montroseBusy ? 'Öppnar din bank…' : `Byt — ${montroseBuyPlan.amount_sek.toLocaleString('sv-SE')} kr`}
                    </button>
                  )}
                  {montroseConnected && !montroseBuyPlan && (
                    <p className="ov-card__sub" style={{ margin: 0 }}>Inga köp att förbereda.</p>
                  )}
                </div>
              </div>
              {(montroseConnectError || montroseError) && (
                <p className="ov-error">{montroseConnectError || montroseError}</p>
              )}
              {montroseHint && <p className="ov-hint">{montroseHint}</p>}
            </div>

            {/* Fee savings highlight */}
            {saving10yr > 0 && (
              <div className="ov-fee-banner">
                <div className="ov-fee-banner__col">
                  <p className="ov-fee-banner__label">Din snittavgift</p>
                  <p className="ov-fee-banner__num ov-fee-banner__num--warn">{formatFeePct(feeW)}</p>
                </div>
                <div className="ov-fee-banner__arrow">→</div>
                <div className="ov-fee-banner__col">
                  <p className="ov-fee-banner__label">Rekommenderad</p>
                  <p className="ov-fee-banner__num ov-fee-banner__num--ok">{formatFeePct(recAvgFee)}</p>
                </div>
                <div className="ov-fee-banner__divider" />
                <div className="ov-fee-banner__col ov-fee-banner__col--saving">
                  <p className="ov-fee-banner__label">Potentiell besparing över 10 år</p>
                  <p className="ov-fee-banner__saving">≈ {saving10yr.toLocaleString('sv-SE')} kr</p>
                  <p className="ov-fee-banner__note">Illustration — samma förväntad avkastning, skillnaden är avgiften.</p>
                </div>
              </div>
            )}

            {/* Fund comparison */}
            <div className="ov-split">
              <div className="ov-card">
                <p className="ov-section-label">Idag</p>
                {holdings.map((h, i) => (
                  <HoldingRow
                    key={String(h.id ?? i)}
                    name={String(h.name)}
                    valueSek={Number(h.value_sek) || 0}
                    totalSek={total}
                    feePct={h.ongoing_fee_pct !== null && h.ongoing_fee_pct !== undefined ? Number(h.ongoing_fee_pct) : null}
                    variant="current"
                  />
                ))}
              </div>
              <div className="ov-card">
                <p className="ov-section-label">Rekommenderat</p>
                {recommendedPreview.map((h, i) => (
                  <HoldingRow
                    key={`t-${i}`}
                    name={h.name}
                    valueSek={h.value_sek}
                    totalSek={total}
                    feePct={h.ongoing_fee_pct}
                    variant="target"
                  />
                ))}
              </div>
            </div>

            {/* Why switch */}
            {(montroseBuyPlan?.source_holdings?.length || holdings.length > 0) && (
              <div className="ov-card">
                <p className="ov-section-label">Varför byta?</p>
                <ul className="ov-switch-list">
                  {(montroseBuyPlan?.source_holdings?.length
                    ? montroseBuyPlan.source_holdings
                    : holdings.map((h) => ({ name: String(h.name), value_sek: Number(h.value_sek) || 0 }))
                  ).map((row, i) => (
                    <li key={`${row.name}-${i}`} className="ov-switch-item">
                      <span className="ov-switch-item__name">{row.name}</span>
                      <span className="ov-switch-item__value">{row.value_sek.toLocaleString('sv-SE')} kr</span>
                      <p className="ov-switch-item__why">{motivationForSwitch(row.name, issues)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* ── ALIGNED — great job ──────────────────────────────── */}
        {followsAdvice && (
          <>
            <div className="ov-card ov-card--celebration">
              <p className="ov-celebration__emoji" aria-hidden>🎉</p>
              <h2 className="ov-celebration__title">Bra beslut</h2>
              <p className="ov-celebration__text">
                Din portfölj följer din valda risknivå med bred riskjustering, tydlig aktie- och
                räntedel och fokus på låga avgifter — i linje med beprövad portföljteori.
              </p>
            </div>

            <div className="ov-split">
              <div className="ov-card">
                <p className="ov-section-label">Dina fonder</p>
                {holdings.map((h, i) => (
                  <HoldingRow
                    key={String(h.id ?? i)}
                    name={String(h.name)}
                    valueSek={Number(h.value_sek) || 0}
                    totalSek={total}
                    feePct={h.ongoing_fee_pct !== null && h.ongoing_fee_pct !== undefined ? Number(h.ongoing_fee_pct) : null}
                    variant="current"
                  />
                ))}
              </div>
              <div className="ov-card">
                <SavingsGoalPanel
                  holdings={holdings}
                  monthlySek={data.profile.monthly_contribution_sek ?? null}
                  layout="bento"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <OverviewReengageBanner />
    </div>
  )
}
