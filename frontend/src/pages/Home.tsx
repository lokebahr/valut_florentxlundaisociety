import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'
import { images } from '../content/images'

type Mission = {
  title: string
  mission: string
  sources: { label: string; url: string }[]
  quote: string
}

export function Home() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!token)
  const [mission, setMission] = useState<Mission | null>(null)
  const [missionError, setMissionError] = useState<string | null>(null)
  const [tinkUrl, setTinkUrl] = useState<string | null>(null)
  const [tinkError, setTinkError] = useState<string | null>(null)

  useEffect(() => {
    api<Mission>('/api/onboarding/mission')
      .then(setMission)
      .catch(() => setMissionError('Kunde inte ladda uppdragstexten.'))
    api<{ url: string }>('/api/tink/link')
      .then((r) => setTinkUrl(r.url))
      .catch((e) => setTinkError(e instanceof Error ? e.message : 'Kunde inte hämta Tink-länk.'))
  }, [])

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const me = await api<{ onboarding_completed: boolean }>('/api/auth/me')
        navigate(me.onboarding_completed ? '/dashboard' : '/onboarding')
      } catch {
        navigate('/')
      } finally {
        setLoading(false)
      }
    })()
  }, [token, navigate])

  if (token && loading) {
    return (
      <Shell variant="minimal">
        <div className="page">
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

  return (
    <Shell variant="minimal">
      <section className="hero-home">
        <div className="hero-home__bg" aria-hidden>
          <img src={images.heroLandscape} alt="" />
        </div>
        <div className="hero-home__veil" aria-hidden />
        <div className="hero-home__content">
          <h1>{mission?.title ?? 'Valut'}</h1>
          <p className="hero-home__lead">
            {mission?.mission ??
              'Vi hjälper dig se om dina placeringar passar dina mål — med tydlighet och utan onödig brus.'}
          </p>
          {mission && (
            <blockquote className="muted" style={{ margin: '1rem 0', fontSize: '0.95rem' }}>
              {mission.quote}
            </blockquote>
          )}
          {missionError && <p className="error">{missionError}</p>}
          {tinkError && <p className="error">{tinkError}</p>}
          <div className="hero-home__actions">
            {tinkUrl ? (
              <a className="btn-link" href={tinkUrl}>
                Fortsätt med Tink
              </a>
            ) : (
              !tinkError && (
                <span className="muted small">
                  Laddar Tink
                  <span className="loading-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
              )
            )}
          </div>
          {mission && mission.sources.length > 0 && (
            <ul className="sources muted small" style={{ marginTop: '1.5rem', textAlign: 'left', maxWidth: '32rem' }}>
              {mission.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  )
}
