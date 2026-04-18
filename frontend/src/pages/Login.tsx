import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'

type TinkLinkInfo = { mode: 'mock' | 'tink'; url?: string }

export function Login() {
  const { token, setToken } = useAuth()
  const navigate = useNavigate()
  const [tinkInfo, setTinkInfo] = useState<TinkLinkInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true })
      return
    }
    api<TinkLinkInfo>('/api/tink/link')
      .then(setTinkInfo)
      .catch(() => setTinkInfo({ mode: 'mock' }))
  }, [token, navigate])

  async function handleMockLogin() {
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ token: string }>('/api/auth/mock', { method: 'POST' })
      setToken(res.token)
      navigate('/onboarding', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inloggningen misslyckades.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell variant="minimal">
      <div className="page narrow">
        <div className="surface step-animate stack">
          <div>
            <h2 style={{ marginBottom: '0.35rem' }}>Logga in</h2>
            <p className="muted">Välkommen tillbaka till Valut.</p>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {tinkInfo?.mode === 'mock' && (
            <div className="stack stack--tight">
              <button
                type="button"
                className="btn-primary"
                onClick={handleMockLogin}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Loggar in…' : 'Logga in med demokonto'}
              </button>
              <p className="muted small" style={{ textAlign: 'center' }}>
                Appen körs i demoläge — inget riktigt bankkonto behövs.
              </p>
            </div>
          )}

          {tinkInfo?.mode === 'tink' && tinkInfo.url && (
            <div className="stack stack--tight">
              <a className="btn-link" href={tinkInfo.url} style={{ textAlign: 'center' }}>
                Logga in med Tink
              </a>
              <p className="muted small" style={{ textAlign: 'center' }}>
                Säker inloggning via din bank med öppen bankkoppling.
              </p>
            </div>
          )}

          <p className="muted small" style={{ textAlign: 'center' }}>
            Inget konto?{' '}
            <Link to="/register">Kom igång gratis</Link>
          </p>
        </div>
      </div>
    </Shell>
  )
}
