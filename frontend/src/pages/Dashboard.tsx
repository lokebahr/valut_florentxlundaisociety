import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Shell } from '../components/Shell'
import { imageAlt, images } from '../content/images'
import { savingsPurposeSv, severitySv } from '../lib/sv'

type Overview = {
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

type MontroseBuyTicket = {
  name: string
  amount_sek: number
  montrose_orderbook_id?: number
  raw: unknown
  decoded: unknown
}

type MontrosePrepareResponse = {
  plan: {
    amount_sek: number
    target_equity_share: number
    buy_lines: {
      target_fund_name: string
      amount_sek: number
      target_weight: number
      montrose_orderbook_id?: number
    }[]
    source_holdings: { name: string; value_sek: number }[]
  }
  buys: MontroseBuyTicket[]
  message: string
}

type Tab = 'overview' | 'profile' | 'tracker'

// ── Gamification helpers ─────────────────────────────────────────
function computeHealthScore(data: Overview, hasGoal: boolean): number {
  let score = 0
  if (data.holdings.length > 0) score += 20
  const highAlerts = data.alerts.filter(a => a.severity === 'high').length
  const medAlerts = data.alerts.filter(a => a.severity === 'medium').length
  score += Math.max(0, 25 - highAlerts * 13)
  score += Math.max(0, 15 - medAlerts * 8)
  const avgFee = data.holdings.length > 0
    ? data.holdings.reduce((s, h) => s + Number(h.ongoing_fee_pct || 0), 0) / data.holdings.length
    : 1
  if (avgFee < 0.3) score += 15
  else if (avgFee < 0.6) score += 10
  if (hasGoal) score += 10
  if (data.profile.monthly_contribution_sek && data.profile.monthly_contribution_sek > 0) score += 15
  return Math.min(100, score)
}

function getLevel(score: number) {
  if (score >= 80) return { name: 'Mästare',     color: '#c99a2e', nextAt: null }
  if (score >= 60) return { name: 'Strateg',      color: '#2a4d42', nextAt: 80 }
  if (score >= 40) return { name: 'Investerare',  color: '#4a7c6c', nextAt: 60 }
  if (score >= 20) return { name: 'Sparare',      color: '#6b9e90', nextAt: 40 }
  return              { name: 'Nybörjare',       color: '#9fb8b2', nextAt: 20 }
}

function HealthRing({ score }: { score: number }) {
  const [live, setLive] = useState(0)
  useEffect(() => { const t = setTimeout(() => setLive(score), 120); return () => clearTimeout(t) }, [score])
  const r = 46
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - live / 100)
  const stroke = live >= 75 ? 'var(--accent)' : live >= 45 ? '#e8a838' : '#c0392b'
  return (
    <div className="health-ring">
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={stroke} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={String(circ)} strokeDashoffset={String(offset)}
          transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.34,1.2,0.64,1), stroke 0.5s' }}
        />
      </svg>
      <div className="health-ring__center">
        <span className="health-ring__score">{score}</span>
        <span className="health-ring__denom">/ 100</span>
      </div>
    </div>
  )
}

function montroseTradeUrl(decoded: unknown): string | null {
  if (decoded && typeof decoded === 'object' && 'url' in decoded) {
    const u = (decoded as { url: unknown }).url
    return typeof u === 'string' && u.startsWith('http') ? u : null
  }
  return null
}

function MontroseTicketsModal({
  result,
  onClose,
}: {
  result: MontrosePrepareResponse
  onClose: () => void
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="montrose-modal" role="dialog" aria-modal="true" aria-labelledby="montrose-modal-title">
      <button type="button" className="montrose-modal__backdrop" aria-label="Stäng" onClick={onClose} />
      <div className="montrose-modal__panel">
        <button type="button" className="montrose-modal__close btn-ghost" onClick={onClose} aria-label="Stäng">×</button>
        <div className="montrose-modal__header">
          <p className="montrose-modal__eyebrow">Klart i Montrose</p>
          <h2 id="montrose-modal-title" className="montrose-modal__title">Slutför dina köp</h2>
          <p className="montrose-modal__lede muted small">{result.message}</p>
          <p className="montrose-modal__hint small">
            Öppna <strong>båda</strong> länkarna i tur och ordning — ett köp per fond.
          </p>
        </div>
        <div className="montrose-ticket-grid">
          {result.buys.map((b, i) => {
            const href = montroseTradeUrl(b.decoded)
            return (
              <article key={`${b.name}-${i}`} className="montrose-ticket">
                <div className="montrose-ticket__meta">
                  <span className="montrose-ticket__step">Köp {i + 1}</span>
                  <h3 className="montrose-ticket__name">{b.name}</h3>
                  <p className="montrose-ticket__amount">{b.amount_sek.toLocaleString('sv-SE')} kr</p>
                </div>
                {href ? (
                  <a className="btn-primary montrose-ticket__cta" href={href} target="_blank" rel="noopener noreferrer">
                    Fortsätt i Montrose
                  </a>
                ) : (
                  <p className="muted small montrose-ticket__cta-fallback">Kunde inte läsa handelslänk.</p>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [montroseBusy, setMontroseBusy] = useState(false)
  const [montroseConnectBusy, setMontroseConnectBusy] = useState(false)
  const [montroseConnectError, setMontroseConnectError] = useState<string | null>(null)
  const [montroseError, setMontroseError] = useState<string | null>(null)
  const [montroseResult, setMontroseResult] = useState<MontrosePrepareResponse | null>(null)

  useEffect(() => {
    api<Overview>('/api/dashboard/overview')
      .then((o) => setData(o))
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunde inte ladda översikten.'))
  }, [])

  const canMontrose = useMemo(() => data?.montrose_enabled === true, [data])
  const montroseConnected = useMemo(() => data?.montrose_connected === true, [data])
  const showMontrosePrepare = useMemo(() => (data?.montrose_show_prepare_switch ?? true) === true, [data])
  const montroseBuyPlan = data?.montrose_buy_plan ?? null
  const closeMontroseModal = useCallback(() => setMontroseResult(null), [])

  async function startMontroseOAuth() {
    setMontroseConnectError(null)
    setMontroseConnectBusy(true)
    try {
      const res = await api<{ authorization_url: string }>('/api/montrose/start', { method: 'POST', body: {} })
      window.location.assign(res.authorization_url)
    } catch (e) {
      setMontroseConnectBusy(false)
      setMontroseConnectError(e instanceof Error ? e.message : 'Kunde inte starta Montrose OAuth.')
    }
  }

  async function prepareMontrose() {
    setMontroseError(null)
    setMontroseResult(null)
    setMontroseBusy(true)
    try {
      const res = await api<MontrosePrepareResponse>('/api/dashboard/montrose/prepare-switch', { method: 'POST', body: {} })
      setMontroseResult(res)
    } catch (e) {
      setMontroseError(e instanceof Error ? e.message : 'Montrose-anrop misslyckades.')
    } finally {
      setMontroseBusy(false)
    }
  }

  if (error) {
    return (
      <Shell>
        <div className="page narrow">
          <div className="surface step-animate">
            <p className="error">{error}</p>
            <p className="muted"><Link to="/onboarding">Gå till introduktionen</Link></p>
          </div>
        </div>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell>
        <div className="page narrow">
          <p className="muted" aria-live="polite">
            Laddar
            <span className="loading-dots" aria-hidden><span /><span /><span /></span>
          </p>
        </div>
      </Shell>
    )
  }

  const hasGoal = !!localStorage.getItem('valut_goal')
  const healthScore = computeHealthScore(data, hasGoal)
  const level = getLevel(healthScore)
  const totalValue = data.holdings.reduce((sum, h) => sum + Number(h.value_sek || 0), 0)

  const avgFee = data.holdings.length > 0
    ? data.holdings.reduce((s, h) => s + Number(h.ongoing_fee_pct || 0), 0) / data.holdings.length
    : 1
  const targets = (data.analysis as { profile_targets?: Record<string, number> }).profile_targets
  const equityDrift = targets
    ? Math.abs((targets.actual_equity_share - targets.target_equity_share) * 100)
    : 99

  const achievements = [
    { id: 'first',   unlocked: data.holdings.length > 0,                                       title: 'Första steget',  desc: 'Kopplad portfölj',         svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
    { id: 'monthly', unlocked: (data.profile.monthly_contribution_sek ?? 0) > 0,               title: 'Aktiv sparare',  desc: 'Månadsspar aktivt',        svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
    { id: 'lowfee',  unlocked: avgFee < 0.5 && data.holdings.length > 0,                       title: 'Kostnadssmart',  desc: 'Avgifter under 0,5 %',     svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { id: 'balanced',unlocked: equityDrift < 10 && data.holdings.length > 0,                   title: 'Välbalanserad',  desc: 'Aktieandel nära målet',    svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> },
    { id: 'goal',    unlocked: hasGoal,                                                          title: 'Målmedveten',    desc: 'Sparmål inställt',         svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
    { id: 'clean',   unlocked: data.alerts.filter(a => a.severity === 'high').length === 0,     title: 'Ren portfölj',   desc: 'Inga kritiska larm',       svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg> },
  ]

  const analysis = data.analysis as {
    profile_targets?: Record<string, number>
    issues?: { title: string; body: string; severity?: string }[]
    suggested_funds?: { name: string; rationale: string; target_weight?: number; montrose_orderbook_id?: number; role?: string }[]
  }

  const TAB_LABELS: Record<Tab, string> = { overview: 'Översikt', profile: 'Profil', tracker: 'Tracker' }

  return (
    <>
      <Shell>
        {/* ── Hero ────────────────────────────────────────────── */}
        <div className="dash-hero">
          <img src={images.seaCalm} alt={imageAlt.seaCalm} />
          <div className="dash-hero__veil" />
          <div className="dash-hero__content">
            <div>
              <p className="dash-hero__eyebrow">Total portfölj</p>
              <p className="dash-hero__value">{totalValue.toLocaleString('sv-SE')} kr</p>
              <p className="dash-hero__sub">Uppdaterad {new Date(data.snapshot_at).toLocaleDateString('sv-SE')}</p>
            </div>
            <div className="dash-hero__level-pill" style={{ '--level-color': level.color } as React.CSSProperties}>
              <span className="dash-hero__level-name">{level.name}</span>
              <span className="dash-hero__level-score">{healthScore} / 100</span>
            </div>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────── */}
        <div className="dash-tab-bar">
          <nav className="dash-tabs" aria-label="Dashboard-flikar">
            {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
              <button key={t} className={`dash-tab${tab === t ? ' dash-tab--active' : ''}`} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="dash-body">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <>
              {/* Metrics */}
              <div className="dash-metrics">
                {[
                  { label: 'Risknivå',   value: data.profile.risk_tolerance != null ? `${data.profile.risk_tolerance} / 5` : '—' },
                  { label: 'Horisont',   value: data.profile.time_horizon_years != null ? `${data.profile.time_horizon_years} år` : '—' },
                  { label: 'Syfte',      value: savingsPurposeSv(data.profile.savings_purpose) },
                  { label: 'Månadsspar', value: data.profile.monthly_contribution_sek != null ? `${data.profile.monthly_contribution_sek.toLocaleString('sv-SE')} kr` : '—' },
                ].map(m => (
                  <div key={m.label} className="dash-metric-card">
                    <span className="dash-metric-card__label">{m.label}</span>
                    <span className="dash-metric-card__value">{m.value}</span>
                  </div>
                ))}
              </div>

              {/* Health */}
              <div className="surface dash-health-card">
                <HealthRing score={healthScore} />
                <div className="dash-health-card__body">
                  <div className="level-badge" style={{ '--level-color': level.color } as React.CSSProperties}>
                    {level.name}
                  </div>
                  <p className="dash-health-card__desc muted small">
                    {healthScore >= 80 ? 'Exceptionellt! Din portfölj är i toppskick.'
                      : healthScore >= 60 ? 'Bra jobbat — ett par justeringar tar dig till toppen.'
                      : healthScore >= 40 ? 'Bra start. Förbättra avgifter och balans för att klättra.'
                      : 'Koppla bank, sätt ett månadsspar och välj mål för att lyfta.'}
                  </p>
                  {level.nextAt !== null && (
                    <div className="level-progress">
                      <div className="level-progress__track">
                        <div className="level-progress__fill" style={{ width: `${((healthScore - (level.nextAt - 20)) / 20) * 100}%` }} />
                      </div>
                      <span className="level-progress__label muted small">{level.nextAt - healthScore} poäng till nästa nivå</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Achievements */}
              <section className="dash-section">
                <h2 className="dash-section__title">Prestationer</h2>
                <div className="achievement-grid">
                  {achievements.map(a => (
                    <div key={a.id} className={`achievement${a.unlocked ? ' achievement--unlocked' : ''}`}>
                      <div className="achievement__icon">{a.svg}</div>
                      <div className="achievement__name">{a.title}</div>
                      <div className="achievement__desc">{a.desc}</div>
                      {a.unlocked && <div className="achievement__check" aria-label="Upplåst" />}
                    </div>
                  ))}
                </div>
              </section>

              {/* Alerts */}
              <section className="dash-section">
                <h2 className="dash-section__title">
                  Larm
                  {data.alerts.length > 0 && (
                    <span className="dash-section__badge">{data.alerts.length}</span>
                  )}
                </h2>
                {data.alerts.length === 0
                  ? <p className="muted">Inga aktiva larm — bra jobbat!</p>
                  : <div className="dash-alerts">
                      {data.alerts.map((a) => (
                        <div key={a.message} className="dash-alert" data-severity={a.severity}>
                          <span className="dash-alert__pill">{severitySv(a.severity)}</span>
                          <span className="dash-alert__msg">{a.message}</span>
                        </div>
                      ))}
                    </div>
                }
                {analysis.profile_targets && (
                  <p className="muted small" style={{ marginTop: '0.75rem' }}>
                    Aktieandel {Math.round((analysis.profile_targets.actual_equity_share || 0) * 100)} % · Mål {Math.round((analysis.profile_targets.target_equity_share || 0) * 100)} % · Hemma-bias {Math.round((analysis.profile_targets.home_bias_equity_weighted || 0) * 100)} %
                  </p>
                )}
              </section>

              {/* Holdings */}
              <section className="dash-section">
                <h2 className="dash-section__title">Innehav</h2>
                {data.holdings.length === 0
                  ? <p className="muted">Inga innehav registrerade.</p>
                  : <div className="dash-holdings">
                      {data.holdings.map((h) => {
                        const val = Number(h.value_sek || 0)
                        const share = totalValue > 0 ? (val / totalValue) * 100 : 0
                        return (
                          <article key={String(h.id)} className="dash-holding">
                            <div className="dash-holding__top">
                              <span className="dash-holding__name">{String(h.name)}</span>
                              <span className="dash-holding__val">{val.toLocaleString('sv-SE')} kr</span>
                            </div>
                            <div className="dash-holding__bar-wrap">
                              <div className="dash-holding__bar" style={{ width: `${share}%` }} />
                            </div>
                            <p className="muted small">
                              {share.toFixed(1)} % av portföljen · Avgift {String(h.ongoing_fee_pct)} % · {String(h.domicile)} · {String(h.vehicle)}
                            </p>
                          </article>
                        )
                      })}
                    </div>
                }
              </section>

              {/* Suggested funds */}
              {(analysis.suggested_funds || []).length > 0 && (
                <section className="dash-section">
                  <h2 className="dash-section__title">Rekommenderade fonder</h2>
                  <div className="dash-funds">
                    {(analysis.suggested_funds || []).map((s) => (
                      <div key={s.name} className="dash-fund">
                        <div className="dash-fund__header">
                          <strong className="dash-fund__name">{s.name}</strong>
                          {s.target_weight != null && (
                            <span className="dash-fund__weight">{Math.round(s.target_weight * 100)} %</span>
                          )}
                        </div>
                        <p className="muted small">{s.rationale}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Montrose */}
              {showMontrosePrepare && (
                <section className="surface dash-section montrose-dash">
                  <div className="montrose-dash__intro">
                    <h2 className="montrose-dash__heading">Köp via Montrose</h2>
                    <p className="montrose-dash__text muted small">
                      Vi utgår från dina <strong>innehav</strong> och våra <strong>två rekommenderade fonder</strong> och skapar köpbiljetter i Montrose
                      för det som inte redan följer rekommendationen — fördelat enligt din målprofil. Sälj hanterar du själv hos banken om det behövs.
                    </p>
                  </div>
                  {!montroseConnected && (
                    <div className="montrose-dash__connect">
                      <p className="muted small">Anslut Montrose först så kan vi förbereda ordrar åt dig.</p>
                      <button type="button" className="btn-primary" disabled={montroseConnectBusy} onClick={() => void startMontroseOAuth()}>
                        {montroseConnectBusy ? 'Öppnar Montrose…' : 'Anslut Montrose'}
                      </button>
                      {montroseConnectError && <p className="error small" role="alert">{montroseConnectError}</p>}
                    </div>
                  )}
                  {montroseConnected && !montroseBuyPlan && (
                    <p className="muted small montrose-dash__empty">
                      Inga investeringsinnehav behöver flyttas till rekommenderad fond utifrån aktuell data.
                    </p>
                  )}
                  {montroseConnected && montroseBuyPlan && (
                    <div className="montrose-dash__plan">
                      <div className="montrose-dash__stats">
                        <div className="montrose-dash__stat">
                          <span className="montrose-dash__stat-label">Totalt köpbelopp</span>
                          <span className="montrose-dash__stat-value">{montroseBuyPlan.amount_sek.toLocaleString('sv-SE')} kr</span>
                        </div>
                        <div className="montrose-dash__stat">
                          <span className="montrose-dash__stat-label">Målprofil</span>
                          <span className="montrose-dash__stat-value">
                            {Math.round(montroseBuyPlan.target_equity_share * 100)} % aktier · {Math.round((1 - montroseBuyPlan.target_equity_share) * 100)} % ränta
                          </span>
                        </div>
                      </div>
                      <div className="montrose-dash__split">
                        <p className="montrose-dash__split-title small">Så här fördelas köpet</p>
                        <ul className="montrose-dash__split-list">
                          {montroseBuyPlan.buy_lines.map((line, i) => (
                            <li key={`${line.target_fund_name}-${i}`} className="montrose-dash__split-item">
                              <span className="montrose-dash__split-name">{line.target_fund_name}</span>
                              <span className="montrose-dash__split-detail muted small">
                                {line.amount_sek.toLocaleString('sv-SE')} kr · ca {Math.round(line.target_weight * 100)} %
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="montrose-dash__sources">
                        <p className="montrose-dash__sources-title small muted">Bytet avser idag dessa innehav</p>
                        <ul className="montrose-dash__sources-list">
                          {montroseBuyPlan.source_holdings.map((h, i) => (
                            <li key={`${h.name}-${i}`}>
                              <span>{h.name}</span>
                              <span className="muted"> {h.value_sek.toLocaleString('sv-SE')} kr</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button type="button" className="btn-primary montrose-dash__cta" disabled={!canMontrose || montroseBusy} onClick={() => void prepareMontrose()}>
                        {montroseBusy ? 'Förbereder biljetter…' : 'Förbered köp i Montrose'}
                      </button>
                    </div>
                  )}
                  {montroseError && <p className="error small montrose-dash__error" role="alert">{montroseError}</p>}
                </section>
              )}

              {/* Buffer */}
              <section className="dash-section">
                <h2 className="dash-section__title">Buffert</h2>
                {data.buffer ? (
                  <div className="dash-buffer">
                    <div className="dash-metric-card">
                      <span className="dash-metric-card__label">Buffertmål</span>
                      <span className="dash-metric-card__value">{(data.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kr</span>
                    </div>
                    <div className="dash-metric-card">
                      <span className="dash-metric-card__label">Uppfyllt</span>
                      <span className="dash-metric-card__value">{(data.buffer as { meets_target?: boolean }).meets_target ? '✓ Ja' : '✗ Nej'}</span>
                    </div>
                  </div>
                ) : <p className="muted">Ingen buffertdata ännu.</p>}
              </section>
            </>
          )}

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div className="dash-section">
              <div className="dash-section__header">
                <h1 className="dash-section__h1">Profil</h1>
                <Link className="btn-ghost" to="/onboarding">Uppdatera profil</Link>
              </div>
              <p className="muted small" style={{ marginBottom: '1.5rem' }}>
                Din spararprofil används för att anpassa analysen till dina mål.
              </p>
              <dl className="profile-rows">
                {[
                  { label: 'Risknivå',        value: data.profile.risk_tolerance != null ? `${data.profile.risk_tolerance} / 5` : '—' },
                  { label: 'Tidshorisont',     value: data.profile.time_horizon_years != null ? `${data.profile.time_horizon_years} år` : '—' },
                  { label: 'Sparsyfte',        value: savingsPurposeSv(data.profile.savings_purpose) },
                  { label: 'Månadssparande',   value: data.profile.monthly_contribution_sek != null ? `${data.profile.monthly_contribution_sek.toLocaleString('sv-SE')} kr` : '—' },
                  { label: 'Buffert uppfylld', value: data.buffer ? ((data.buffer as { meets_target?: boolean }).meets_target ? 'Ja' : 'Nej') : '—' },
                  { label: 'Buffertmål',       value: data.buffer ? `${(data.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kr` : '—' },
                ].map((r) => (
                  <div className="profile-row" key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* ── TRACKER ── */}
          {tab === 'tracker' && <TrackerTab holdings={data.holdings} monthlySek={data.profile.monthly_contribution_sek} />}
        </div>
      </Shell>
      {montroseResult ? <MontroseTicketsModal result={montroseResult} onClose={closeMontroseModal} /> : null}
    </>
  )
}

// ── Goal Tracker ────────────────────────────────────────────────

type GoalType = 'house' | 'car' | 'travel' | 'education' | 'retirement'
type SavedGoal = { type: GoalType; targetSek: number }

const GOALS: Record<GoalType, { label: string; svg: React.ReactNode }> = {
  house: { label: 'Bostad', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5V21H15v-6H9v6H3V10.5z" /></svg> },
  car: { label: 'Bil', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l2-5h10l2 5" /><rect x="2" y="12" width="20" height="6" rx="2" /><circle cx="7" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg> },
  travel: { label: 'Resa', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.5L14 12V5a2 2 0 00-4 0v7L2 16.5l.5 1.5 7.5-2V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l7.5 2 1.5-1.5z" /></svg> },
  education: { label: 'Utbildning', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L2 8l10 5 10-5-10-5z" /><path d="M2 8v7" /><path d="M6 10.5v5.5a6 6 0 0012 0v-5.5" /></svg> },
  retirement: { label: 'Pension', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg> },
}

function TrackerTab({ holdings, monthlySek }: { holdings: Record<string, unknown>[]; monthlySek: number | null }) {
  const [goal, setGoal] = useState<SavedGoal | null>(() => {
    try { return JSON.parse(localStorage.getItem('valut_goal') || 'null') }
    catch { return null }
  })
  const [picking, setPicking] = useState(!goal)
  const [selectedType, setSelectedType] = useState<GoalType>(goal?.type ?? 'house')
  const [targetInput, setTargetInput] = useState(goal ? String(goal.targetSek) : '')
  const fillRef = useRef<HTMLDivElement>(null)

  const totalValue = holdings.reduce((sum, h) => sum + Number(h.value_sek || 0), 0)
  const pct = goal && goal.targetSek > 0 ? Math.min((totalValue / goal.targetSek) * 100, 100) : 0
  const reached = pct >= 100

  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    requestAnimationFrame(() => { el.style.width = `${pct}%` })
  }, [pct])

  function saveGoal() {
    const t = Number(targetInput.replace(/\s/g, '').replace(',', '.'))
    if (!t || t <= 0) return
    const saved: SavedGoal = { type: selectedType, targetSek: t }
    localStorage.setItem('valut_goal', JSON.stringify(saved))
    setGoal(saved)
    setPicking(false)
  }

  const def = GOALS[goal?.type ?? selectedType]

  if (picking) {
    return (
      <div className="dash-section surface step-animate">
        <h1 className="dash-section__h1" style={{ marginBottom: '0.35rem' }}>Välj ditt mål</h1>
        <p className="muted small">Vad sparar du mot? Vi visar hur nära du är.</p>
        <div className="goal-picker">
          {(Object.keys(GOALS) as GoalType[]).map((k) => (
            <button key={k} type="button" className={`goal-option${selectedType === k ? ' goal-option--selected' : ''}`} onClick={() => setSelectedType(k)}>
              {GOALS[k].svg}
              {GOALS[k].label}
            </button>
          ))}
        </div>
        <div className="goal-setup-row">
          <label className="goal-setup-label">
            Målbelopp (kr)
            <input type="number" min="1000" step="10000" placeholder="t.ex. 3 000 000" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} className="goal-setup-input" />
          </label>
          <button type="button" className="btn btn-primary" disabled={!targetInput || Number(targetInput) <= 0} onClick={saveGoal}>
            Spara mål
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="surface dash-section step-animate">
        <div className="dash-section__header">
          <div>
            <h1 className="dash-section__h1" style={{ marginBottom: '0.2rem' }}>Tracker</h1>
            <p className="muted small">Mål: <strong>{def.label}</strong> · {goal!.targetSek.toLocaleString('sv-SE')} kr</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>Byt mål</button>
        </div>

        <div className="goal-progress">
          <div className="goal-progress__pct-row">
            <span className="goal-progress__pct">{Math.floor(pct)} %</span>
            {reached && <span className="goal-progress__reached">Målet nått!</span>}
          </div>
          <div className="goal-progress__track-wrap">
            <div className="goal-progress__track">
              <div ref={fillRef} className={`goal-progress__fill${reached ? ' goal-progress__fill--done' : ''}`} style={{ width: '0%' }} />
              {[25, 50, 75].map(m => (
                <div key={m} className={`goal-progress__milestone${pct >= m ? ' goal-progress__milestone--passed' : ''}`} style={{ left: `${m}%` }} title={`${m} %`} />
              ))}
            </div>
            <div className={`goal-progress__icon${reached ? ' goal-progress__icon--reached' : ''}`}>{def.svg}</div>
          </div>
          <div className="goal-progress__labels">
            <div>
              <div className="goal-progress__label-val">{totalValue.toLocaleString('sv-SE')} kr</div>
              <div className="goal-progress__label-sub muted small">Nuvarande portfölj</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="goal-progress__label-val">{goal!.targetSek.toLocaleString('sv-SE')} kr</div>
              <div className="goal-progress__label-sub muted small">{def.label}</div>
            </div>
          </div>
          {!reached && (() => {
            const remaining = goal!.targetSek - totalValue
            if (monthlySek && monthlySek > 0 && remaining > 0) {
              const months = Math.ceil(remaining / monthlySek)
              const years = Math.floor(months / 12)
              const mo = months % 12
              const timeStr = years > 0 ? `${years} år${mo > 0 ? ` ${mo} mån` : ''}` : `${months} mån`
              return (
                <div className="goal-eta">
                  <span className="goal-eta__val">{timeStr}</span>
                  <span className="goal-eta__label muted small">kvar vid {monthlySek.toLocaleString('sv-SE')} kr/mån</span>
                  <span className="goal-eta__remaining muted small">{remaining.toLocaleString('sv-SE')} kr kvar</span>
                </div>
              )
            }
            return <p className="muted small" style={{ marginTop: '0.75rem' }}>Sätt ett månadsspar i Profil för att se tid till målet.</p>
          })()}
        </div>
      </div>

      <section className="surface dash-section step-animate">
        <h2 className="dash-section__title">Innehav</h2>
        {holdings.length === 0 && <p className="muted">Inga innehav registrerade.</p>}
        <div className="dash-holdings">
          {holdings.map((h) => {
            const value = Number(h.value_sek || 0)
            const share = totalValue > 0 ? (value / totalValue) * 100 : 0
            return (
              <article key={String(h.id)} className="dash-holding">
                <div className="dash-holding__top">
                  <span className="dash-holding__name">{String(h.name)}</span>
                  <span className="dash-holding__val">{value.toLocaleString('sv-SE')} kr</span>
                </div>
                <div className="dash-holding__bar-wrap">
                  <div className="dash-holding__bar" style={{ width: `${share}%` }} />
                </div>
                <p className="muted small">{share.toFixed(1)} % av portföljen · Avgift {String(h.ongoing_fee_pct)} % · {String(h.domicile)} · {String(h.vehicle)}</p>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}
