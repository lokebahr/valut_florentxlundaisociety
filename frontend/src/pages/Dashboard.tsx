import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { HeroImage } from '../components/HeroImage'
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
}

type MontrosePrepareResponse = {
  sell: { raw: unknown; decoded: unknown }
  buy: { raw: unknown; decoded: unknown }
  message: string
}

type Tab = 'overview' | 'profile' | 'tracker'

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [sellName, setSellName] = useState('')
  const [buyName, setBuyName] = useState('')
  const [amountSek, setAmountSek] = useState<number>(50_000)
  const [accountId, setAccountId] = useState('')
  const [montroseBusy, setMontroseBusy] = useState(false)
  const [montroseConnectBusy, setMontroseConnectBusy] = useState(false)
  const [montroseConnectError, setMontroseConnectError] = useState<string | null>(null)
  const [montroseError, setMontroseError] = useState<string | null>(null)
  const [montroseResult, setMontroseResult] = useState<MontrosePrepareResponse | null>(null)

  useEffect(() => {
    api<Overview>('/api/dashboard/overview')
      .then((o) => {
        setData(o)
        const analysis = o.analysis as {
          suggested_funds?: { name: string; rationale: string }[]
        }
        const holdings = o.holdings || []
        const firstH = holdings[0] as { name?: string; value_sek?: number } | undefined
        const suggested = analysis.suggested_funds?.[0]
        if (firstH?.name) setSellName(String(firstH.name))
        if (suggested?.name) setBuyName(String(suggested.name))
        if (firstH?.value_sek != null && Number(firstH.value_sek) > 0) {
          setAmountSek(Math.min(Math.floor(Number(firstH.value_sek)), 500_000))
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunde inte ladda översikten.'))
  }, [])

  const canMontrose = useMemo(() => data?.montrose_enabled === true, [data])
  const montroseConnected = useMemo(() => data?.montrose_connected === true, [data])

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
      const res = await api<MontrosePrepareResponse>('/api/dashboard/montrose/prepare-switch', {
        method: 'POST',
        body: {
          sell_name: sellName,
          buy_name: buyName,
          amount_sek: amountSek,
          account_id: accountId.trim() || undefined,
        },
      })
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
            <p className="muted">
              <Link to="/onboarding">Gå till introduktionen</Link>
            </p>
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
            <span className="loading-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </p>
        </div>
      </Shell>
    )
  }

  const analysis = data.analysis as {
    profile_targets?: Record<string, number>
    issues?: { title: string; body: string; severity?: string }[]
    suggested_funds?: { name: string; rationale: string }[]
  }

  return (
    <Shell>
      <div className="page page--wide stack" style={{ gap: '1.5rem' }}>
        <HeroImage className="hero-image--compact" src={images.seaCalm} alt={imageAlt.seaCalm} />

        <nav className="dash-tabs" aria-label="Dashboard-flikar">
          <button className={`dash-tab${tab === 'overview' ? ' dash-tab--active' : ''}`} onClick={() => setTab('overview')}>
            Översikt
          </button>
          <button className={`dash-tab${tab === 'profile' ? ' dash-tab--active' : ''}`} onClick={() => setTab('profile')}>
            Profil
          </button>
          <button className={`dash-tab${tab === 'tracker' ? ' dash-tab--active' : ''}`} onClick={() => setTab('tracker')}>
            Tracker
          </button>
        </nav>

        {tab === 'overview' && (
          <>
            <div className="surface step-animate">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 style={{ margin: '0 0 0.35rem' }}>Översikt</h1>
                  <p className="muted small">Uppdaterad {new Date(data.snapshot_at).toLocaleString('sv-SE')}</p>
                </div>
                <Link className="btn-ghost" to="/onboarding">Introduktion</Link>
              </div>
              <div className="grid-metrics" style={{ marginTop: '1.25rem' }}>
                <dl className="metric">
                  <dt>Risknivå</dt>
                  <dd>{data.profile.risk_tolerance ?? '—'}</dd>
                </dl>
                <dl className="metric">
                  <dt>Horisont</dt>
                  <dd>{data.profile.time_horizon_years != null ? `${data.profile.time_horizon_years} år` : '—'}</dd>
                </dl>
                <dl className="metric">
                  <dt>Syfte</dt>
                  <dd>{savingsPurposeSv(data.profile.savings_purpose)}</dd>
                </dl>
                <dl className="metric">
                  <dt>Månadsspar</dt>
                  <dd>
                    {data.profile.monthly_contribution_sek != null
                      ? `${data.profile.monthly_contribution_sek.toLocaleString('sv-SE')} kr`
                      : '—'}
                  </dd>
                </dl>
              </div>
            </div>

            <section className="surface step-animate">
              <h2>Förbered byte via Montrose</h2>
              <p className="muted small">
                Skapar två biljetter i Montrose MCP: <strong>Sälj</strong> befintlig fond och <strong>Köp</strong> målfond med samma belopp (SEK).
                Du slutför sedan i Montrose / din bank. Klienten registreras dynamiskt mot Montrose (<code>/register</code>) när du ansluter; token sparas per användare.
              </p>
              {!montroseConnected && (
                <div className="stack stack--tight" style={{ marginTop: '0.75rem' }}>
                  <p className="muted small">Anslut ditt Montrose-konto för att kunna förbereda ordrar.</p>
                  <button type="button" className="btn-primary" disabled={montroseConnectBusy} onClick={() => void startMontroseOAuth()}>
                    {montroseConnectBusy ? 'Öppnar Montrose…' : 'Anslut Montrose'}
                  </button>
                  {montroseConnectError && <p className="error small" role="alert">{montroseConnectError}</p>}
                </div>
              )}
              {montroseConnected && (
                <div className="stack stack--tight" style={{ marginTop: '0.75rem', maxWidth: '32rem' }}>
                  <label>Sälj (fondnamn)<input value={sellName} onChange={(e) => setSellName(e.target.value)} /></label>
                  <label>Köp (fondnamn)<input value={buyName} onChange={(e) => setBuyName(e.target.value)} /></label>
                  <label>Belopp (SEK)<input type="number" min={1000} step={1000} value={amountSek} onChange={(e) => setAmountSek(Number(e.target.value))} /></label>
                  <label>
                    Konto-id i Montrose (valfritt)
                    <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Om ditt Montrose-konto kräver accountId" />
                  </label>
                  <button type="button" className="btn-primary" disabled={!canMontrose || montroseBusy} onClick={() => void prepareMontrose()}>
                    {montroseBusy ? 'Förbereder…' : 'Förbered order i Montrose'}
                  </button>
                </div>
              )}
              {montroseError && <p className="error small" role="alert" style={{ marginTop: '0.75rem' }}>{montroseError}</p>}
              {montroseResult && (
                <details className="callout stack stack--tight" style={{ marginTop: '1rem' }}>
                  <summary className="small" style={{ cursor: 'pointer' }}>Montrose-svar (rått + tolkat)</summary>
                  <p className="muted small">{montroseResult.message}</p>
                  <pre className="small" style={{ overflow: 'auto', maxHeight: 'min(60vh, 24rem)', padding: '0.75rem', background: 'var(--color-surface-elevated, #f4f4f5)', borderRadius: '8px' }}>
                    {JSON.stringify(montroseResult, null, 2)}
                  </pre>
                </details>
              )}
            </section>

            <section className="surface step-animate">
              <h2>Buffert</h2>
              {data.buffer ? (
                <p className="muted">
                  Mål: {(data.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kr · Uppfyllt:{' '}
                  {(data.buffer as { meets_target?: boolean }).meets_target ? 'ja' : 'nej'}
                </p>
              ) : (
                <p className="muted">Ingen buffertdata ännu.</p>
              )}
            </section>

            <section className="surface step-animate">
              <h2>Larm och avvägning</h2>
              {data.alerts.length === 0 && <p className="muted">Inga aktiva larm just nu.</p>}
              <ul className="issues">
                {data.alerts.map((a) => (
                  <li key={a.message}>
                    <span className="pill" data-severity={a.severity}>{severitySv(a.severity)}</span>{' '}
                    <span className="small">{a.message}</span>
                  </li>
                ))}
              </ul>
              {analysis.profile_targets && (
                <p className="muted small" style={{ marginTop: '0.75rem' }}>
                  Aktieandel i portföljen: {Math.round((analysis.profile_targets.actual_equity_share || 0) * 100)} % · Mål:{' '}
                  {Math.round((analysis.profile_targets.target_equity_share || 0) * 100)} % · Hemma-bias i aktiedel:{' '}
                  {Math.round((analysis.profile_targets.home_bias_equity_weighted || 0) * 100)} %
                </p>
              )}
            </section>

            <section className="surface step-animate">
              <h2>Förslag</h2>
              <ul className="plain">
                {(analysis.suggested_funds || []).map((s) => (
                  <li key={s.name} style={{ marginBottom: '0.65rem' }}>
                    <strong>{s.name}</strong>
                    <div className="muted small">{s.rationale}</div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {tab === 'profile' && (
          <div className="surface step-animate">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <h1 style={{ margin: '0 0 0.35rem' }}>Profil</h1>
              <Link className="btn-ghost" to="/onboarding">Uppdatera profil</Link>
            </div>
            <p className="muted small" style={{ marginBottom: '1.25rem' }}>
              Din spararprofil används för att anpassa analysen till dina mål.
            </p>
            <dl className="profile-rows">
              {[
                { label: 'Risknivå', value: data.profile.risk_tolerance != null ? String(data.profile.risk_tolerance) : '—' },
                { label: 'Tidshorisont', value: data.profile.time_horizon_years != null ? `${data.profile.time_horizon_years} år` : '—' },
                { label: 'Sparsyfte', value: savingsPurposeSv(data.profile.savings_purpose) },
                {
                  label: 'Månadssparande',
                  value: data.profile.monthly_contribution_sek != null
                    ? `${data.profile.monthly_contribution_sek.toLocaleString('sv-SE')} kr`
                    : '—',
                },
                {
                  label: 'Buffert uppfylld',
                  value: data.buffer ? ((data.buffer as { meets_target?: boolean }).meets_target ? 'Ja' : 'Nej') : '—',
                },
                {
                  label: 'Buffertmål',
                  value: data.buffer
                    ? `${(data.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kr`
                    : '—',
                },
              ].map((r) => (
                <div className="profile-row" key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {tab === 'tracker' && <TrackerTab holdings={data.holdings} />}
      </div>
    </Shell>
  )
}

// ── Goal Tracker ────────────────────────────────────────────────

type GoalType = 'house' | 'car' | 'travel' | 'education' | 'retirement'

type SavedGoal = { type: GoalType; targetSek: number }

const GOALS: Record<GoalType, { label: string; svg: React.ReactNode }> = {
  house: {
    label: 'Bostad',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5V21H15v-6H9v6H3V10.5z" />
      </svg>
    ),
  },
  car: {
    label: 'Bil',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l2-5h10l2 5" />
        <rect x="2" y="12" width="20" height="6" rx="2" />
        <circle cx="7" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    ),
  },
  travel: {
    label: 'Resa',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.5L14 12V5a2 2 0 00-4 0v7L2 16.5l.5 1.5 7.5-2V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3l7.5 2 1.5-1.5z" />
      </svg>
    ),
  },
  education: {
    label: 'Utbildning',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3L2 8l10 5 10-5-10-5z" />
        <path d="M2 8v7" />
        <path d="M6 10.5v5.5a6 6 0 0012 0v-5.5" />
      </svg>
    ),
  },
  retirement: {
    label: 'Pension',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
}

function TrackerTab({ holdings }: { holdings: Record<string, unknown>[] }) {
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
    requestAnimationFrame(() => {
      el.style.width = `${pct}%`
    })
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
      <div className="surface step-animate">
        <h1 style={{ margin: '0 0 0.35rem' }}>Välj ditt mål</h1>
        <p className="muted small">Vad sparar du mot? Vi visar hur nära du är.</p>
        <div className="goal-picker">
          {(Object.keys(GOALS) as GoalType[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`goal-option${selectedType === k ? ' goal-option--selected' : ''}`}
              onClick={() => setSelectedType(k)}
            >
              {GOALS[k].svg}
              {GOALS[k].label}
            </button>
          ))}
        </div>
        <div className="goal-setup-row">
          <label className="goal-setup-label">
            Målbelopp (kr)
            <input
              type="number"
              min="1000"
              step="10000"
              placeholder="t.ex. 3 000 000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="goal-setup-input"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!targetInput || Number(targetInput) <= 0}
            onClick={saveGoal}
          >
            Spara mål
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="surface step-animate">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.2rem' }}>Tracker</h1>
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
              <div
                ref={fillRef}
                className={`goal-progress__fill${reached ? ' goal-progress__fill--done' : ''}`}
                style={{ width: '0%' }}
              />
            </div>
            <div className={`goal-progress__icon${reached ? ' goal-progress__icon--reached' : ''}`}>
              {def.svg}
            </div>
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
        </div>
      </div>

      <section className="surface step-animate">
        <h2>Innehav</h2>
        {holdings.length === 0 && <p className="muted">Inga innehav registrerade.</p>}
        <div className="holdings">
          {holdings.map((h) => {
            const value = Number(h.value_sek || 0)
            const share = totalValue > 0 ? (value / totalValue) * 100 : 0
            return (
              <article key={String(h.id)} className="holding">
                <div className="holding__header">
                  <h3>{String(h.name)}</h3>
                  <span className="holding__value">{value.toLocaleString('sv-SE')} kr</span>
                </div>
                <div className="holding__bar-wrap">
                  <div className="holding__bar" style={{ width: `${share}%` }} />
                </div>
                <p className="muted small">
                  {share.toFixed(1)} % av portföljen · Avgift {String(h.ongoing_fee_pct)} % · {String(h.domicile)} · {String(h.vehicle)}
                </p>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}
