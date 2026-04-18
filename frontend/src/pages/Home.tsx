import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'
import { images } from '../content/images'

export function Home() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!token)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const me = await api<{ onboarding_completed: boolean }>('/api/auth/me')
        navigate(me.onboarding_completed ? '/dashboard' : '/onboarding')
      } catch {
        navigate('/login')
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
          <h1>Sparande som håller måttet</h1>
          <p className="hero-home__lead">
            Vi hjälper dig se om dina placeringar passar dina mål — med tydlighet och utan onödig brus.
          </p>
          <div className="hero-home__actions">
            <Link className="btn-link" to="/register">
              Kom igång
            </Link>
            <Link className="btn-link btn-link--muted" to="/login">
              Logga in
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  )
}
