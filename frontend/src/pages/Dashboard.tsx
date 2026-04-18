import { useEffect, useMemo, useState } from 'react'
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

        {tab === 'tracker' && (() => {
          const totalValue = data.holdings.reduce((sum, h) => sum + Number(h.value_sek || 0), 0)
          return (
            <>
              <div className="surface step-animate">
                <h1 style={{ margin: '0 0 0.35rem' }}>Tracker</h1>
                <p className="muted small" style={{ marginBottom: '1.25rem' }}>
                  Dina nuvarande innehav och portföljsammansättning.
                </p>
                <div className="grid-metrics">
                  <dl className="metric">
                    <dt>Totalt värde</dt>
                    <dd>{totalValue.toLocaleString('sv-SE')} kr</dd>
                  </dl>
                  <dl className="metric">
                    <dt>Antal innehav</dt>
                    <dd>{data.holdings.length}</dd>
                  </dl>
                </div>
              </div>
              <section className="surface step-animate">
                <h2>Innehav</h2>
                {data.holdings.length === 0 && <p className="muted">Inga innehav registrerade.</p>}
                <div className="holdings">
                  {data.holdings.map((h) => {
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
        })()}
      </div>
    </Shell>
  )
}
