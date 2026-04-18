import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { DashboardOverview } from '../components/DashboardOverview'
import { SavingsGoalPanel } from '../components/SavingsGoalPanel'
import { Shell } from '../components/Shell'
import { savingsPurposeSv } from '../lib/sv'
import type { Overview } from '../types/dashboard'

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
  holdings_mock_updated?: boolean
  snapshot_refreshed?: boolean
}

type Tab = 'overview' | 'profile' | 'tracker'

function montroseTradeUrl(decoded: unknown): string | null {
  if (decoded && typeof decoded === 'object' && 'url' in decoded) {
    const u = (decoded as { url: unknown }).url
    return typeof u === 'string' && u.startsWith('http') ? u : null
  }
  return null
}

/** Open Montrose checkout in new tab(s); avoids losing the user gesture where possible. */
function openMontroseTradeUrls(res: MontrosePrepareResponse): boolean {
  const urls = res.buys
    .map((b) => montroseTradeUrl(b.decoded))
    .filter((u): u is string => u != null)
  urls.forEach((href, i) => {
    window.setTimeout(() => {
      const a = document.createElement('a')
      a.href = href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.click()
    }, i * 500)
  })
  return urls.length > 0
}

function Bone({ w, h, radius }: { w?: string; h?: string; radius?: string }) {
  return (
    <div
      className="skel-bone"
      style={{ width: w ?? '100%', height: h ?? '1rem', borderRadius: radius ?? '6px' }}
    />
  )
}

function DashboardSkeleton() {
  return (
    <div className="skel" aria-label="Laddar dashboard…" aria-busy="true">
      {/* Hero */}
      <div className="skel-hero" />

      {/* Tab bar */}
      <div className="skel-tabbar">
        <Bone w="5rem" h="0.85rem" radius="4px" />
        <Bone w="4rem" h="0.85rem" radius="4px" />
        <Bone w="4.5rem" h="0.85rem" radius="4px" />
      </div>

      <div className="skel-body">
        {/* Metric cards */}
        <div className="skel-metrics">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skel-card">
              <Bone w="50%" h="0.65rem" />
              <Bone w="70%" h="1.35rem" />
            </div>
          ))}
        </div>

        {/* Health card */}
        <div className="skel-card skel-health">
          <div className="skel-ring" />
          <div className="skel-health__body">
            <Bone w="5rem" h="1.5rem" radius="99px" />
            <Bone w="90%" h="0.75rem" />
            <Bone w="75%" h="0.75rem" />
            <Bone w="100%" h="0.55rem" radius="99px" />
          </div>
        </div>

        {/* Sections */}
        {[180, 140, 200].map((h, i) => (
          <div key={i} className="skel-card" style={{ height: h }} />
        ))}
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
  const [montroseHint, setMontroseHint] = useState<string | null>(null)

  useEffect(() => {
    api<Overview>('/api/dashboard/overview')
      .then((o) => setData(o))
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunde inte ladda översikten.'))
  }, [])

  const canMontrose = useMemo(() => data?.montrose_enabled === true, [data])
  const montroseConnected = useMemo(() => data?.montrose_connected === true, [data])
  const showMontrosePrepare = useMemo(
    () => (data?.montrose_show_prepare_switch ?? true) === true,
    [data],
  )
  const montroseBuyPlan = data?.montrose_buy_plan ?? null

  async function startMontroseOAuth() {
    setMontroseConnectError(null)
    setMontroseConnectBusy(true)
    try {
      const res = await api<{ authorization_url: string }>('/api/montrose/start', { method: 'POST', body: {} })
      window.location.assign(res.authorization_url)
    } catch (e) {
      setMontroseConnectBusy(false)
      setMontroseConnectError(e instanceof Error ? e.message : 'Kunde inte ansluta till din bank.')
    }
  }

  async function prepareMontrose() {
    setMontroseError(null)
    setMontroseHint(null)
    setMontroseBusy(true)
    try {
      const res = await api<MontrosePrepareResponse>('/api/dashboard/montrose/prepare-switch', {
        method: 'POST',
        body: {},
      })
      if (!openMontroseTradeUrls(res)) {
        setMontroseError('Kunde inte öppna handelslänken. Försök igen eller genomför bytet i din banks fondhandel.')
        return
      }
      try {
        const overview = await api<Overview>('/api/dashboard/overview')
        setData(overview)
      } catch {
        /* overview stale until reload */
      }
      if (res.holdings_mock_updated) {
        if (res.snapshot_refreshed) {
          setMontroseHint('Demonstrationsbanken och innehaven på översikten är uppdaterade.')
        } else {
          setMontroseHint(
            'Demonstrationsdata uppdaterades men översikten kunde inte laddas om automatiskt. Ladda om sidan.',
          )
        }
      }
    } catch (e) {
      setMontroseError(e instanceof Error ? e.message : 'Bytet kunde inte förberedas. Försök via din bank.')
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
        <DashboardSkeleton />
      </Shell>
    )
  }

  return (
    <Shell>
      <div
        className={`page page--wide dashboard-root stack${tab === 'overview' ? ' dashboard-root--overview' : ''}`}
        style={{ gap: tab === 'overview' ? 0 : '1.5rem' }}
      >
        {tab !== 'overview' && (
          <nav className="dash-tabs" aria-label="Dashboard-flikar">
            <button type="button" className="dash-tab" onClick={() => setTab('overview')}>
              Översikt
            </button>
            <button type="button" className={`dash-tab${tab === 'profile' ? ' dash-tab--active' : ''}`} onClick={() => setTab('profile')}>
              Profil
            </button>
            <button type="button" className={`dash-tab${tab === 'tracker' ? ' dash-tab--active' : ''}`} onClick={() => setTab('tracker')}>
              Tracker
            </button>
          </nav>
        )}

        {tab === 'overview' && (
          <DashboardOverview
            data={data}
            showMontrosePrepare={showMontrosePrepare}
            montroseBuyPlan={montroseBuyPlan}
            montroseConnected={montroseConnected}
            montroseBusy={montroseBusy}
            montroseConnectBusy={montroseConnectBusy}
            montroseError={montroseError}
            montroseConnectError={montroseConnectError}
            montroseHint={montroseHint}
            canMontrose={canMontrose}
            onMontroseConnect={() => void startMontroseOAuth()}
            onMontrosePrepare={() => void prepareMontrose()}
          />
        )}

        {tab === 'profile' && (
          <div className="surface step-animate">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <h1 style={{ margin: '0 0 0.35rem' }}>Profil</h1>
              <Link className="btn-ghost" to="/onboarding">
                Uppdatera profil
              </Link>
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
                  value:
                    data.profile.monthly_contribution_sek != null
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

        {tab === 'tracker' && <TrackerTab holdings={data.holdings} monthlySek={data.profile.monthly_contribution_sek} />}
      </div>
    </Shell>
  )
}

function TrackerTab({ holdings, monthlySek }: { holdings: Record<string, unknown>[]; monthlySek: number | null }) {
  const totalValue = holdings.reduce((sum, h) => sum + Number(h.value_sek || 0), 0)
  return (
    <>
      <div className="surface step-animate">
        <SavingsGoalPanel holdings={holdings} monthlySek={monthlySek} layout="page" />
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
