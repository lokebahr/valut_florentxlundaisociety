import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'

type TinkLinkInfo = { mode: 'mock' | 'tink'; url?: string }

export function Register() {
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

  async function handleMockRegister() {
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ token: string }>('/api/auth/mock', { method: 'POST' })
      setToken(res.token)
      navigate('/onboarding', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registreringen misslyckades.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell variant="minimal">
      <div className="page page--auth">
        <div className="auth-grid">
          <div className="auth-visual"></div>
          <div className="auth-panel">
            <div className="stack--tight">
              <h1>Kom igång gratis</h1>
              <p className="lead">Skapa ditt konto och få din första portföljanalys på under två minuter.</p>
            </div>

            {error && <p className="error" role="alert">{error}</p>}

            {tinkInfo?.mode === 'mock' && (
              <div className="stack stack--tight">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleMockRegister}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Skapar konto…' : 'Skapa demokonto'}
                </button>
                <p className="muted small" style={{ textAlign: 'center' }}>
                  Appen körs i demoläge — inget riktigt bankkonto behövs.
                </p>
              </div>
            )}

            {tinkInfo?.mode === 'tink' && tinkInfo.url && (
              <div className="stack stack--tight">
                <a className="btn-link" href={tinkInfo.url} style={{ textAlign: 'center' }}>
                  Kom igång med Tink
                </a>
                <p className="muted small" style={{ textAlign: 'center' }}>
                  Vi kopplar till din bank via säker öppen bankkoppling för att läsa in dina innehav.
                </p>
              </div>
            )}

            <p className="muted small">
              Har du redan ett konto?{' '}
              <Link to="/login">Logga in</Link>
            </p>
          </div>
        </div>
      </div>
    </Shell>
  )
}
