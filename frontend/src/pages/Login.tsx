import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'
import { imageAlt, images } from '../content/images'

export function Login() {
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await api<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      setToken(res.token)
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggningen misslyckades. Försök igen.')
    }
  }

  return (
    <Shell>
      <div className="page page--auth">
        <div className="auth-grid step-animate">
          <div className="auth-visual">
            <img src={images.deskMinimal} alt={imageAlt.deskMinimal} />
          </div>
          <div className="auth-panel">
            <div>
              <h1>Logga in</h1>
              <p className="muted">Fortsätt där du slutade.</p>
            </div>
            <form className="stack stack--tight" onSubmit={onSubmit}>
              <label>
                E-post
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
              </label>
              <label>
                Lösenord
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn-primary">
                Logga in
              </button>
            </form>
            <p className="muted small">
              <Link to="/register">Skapa konto</Link>
            </p>
          </div>
        </div>
      </div>
    </Shell>
  )
}
