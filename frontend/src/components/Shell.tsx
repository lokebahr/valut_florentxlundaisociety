import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import logoSvg from '../../pictures/logo.svg'

type Props = {
  children: ReactNode
  /** Om satt visas en tunn accent under sidhuvudet */
  variant?: 'default' | 'minimal'
}

export function Shell({ children, variant = 'default' }: Props) {
  const { token, setToken } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    setToken(null)
    navigate('/', { replace: true })
  }

  return (
    <div className={`shell shell--${variant}`}>
      <header className="shell-header">
        <Link to="/" className="shell-logo">
          <img src={logoSvg} alt="Valut" className="shell-logo__img" />
        </Link>
        {token && (
          <button className="shell-logout" onClick={handleLogout}>
            Logga ut
          </button>
        )}
      </header>
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <p>Valut · Sparande som följer dina mål</p>
      </footer>
    </div>
  )
}
