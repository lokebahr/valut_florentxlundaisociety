import { useEffect, useState } from 'react'
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
  tink_mock: boolean
}

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Overview>('/api/dashboard/overview')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunde inte ladda översikten.'))
  }, [])

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

        <div className="surface step-animate">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.35rem' }}>Översikt</h1>
              <p className="muted small">
                Uppdaterad {new Date(data.snapshot_at).toLocaleString('sv-SE')} ·{' '}
                {data.tink_mock ? 'Demonstrationsdata' : 'Tink testmiljö'}
              </p>
            </div>
            <Link className="btn-ghost" to="/onboarding">
              Introduktion
            </Link>
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
                <span className="pill" data-severity={a.severity}>
                  {severitySv(a.severity)}
                </span>{' '}
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
          <h2>Innehav</h2>
          <div className="holdings">
            {data.holdings.map((h) => (
              <article key={String(h.id)} className="holding">
                <h3>{String(h.name)}</h3>
                <p className="muted small">
                  {Number(h.value_sek).toLocaleString('sv-SE')} kr · Avgift {String(h.ongoing_fee_pct)} % · Domicil {String(h.domicile)} · Konto{' '}
                  {String(h.vehicle)}
                </p>
              </article>
            ))}
          </div>
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
      </div>
    </Shell>
  )
}
