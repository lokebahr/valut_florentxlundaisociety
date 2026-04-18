import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import logoSvg from '../../pictures/logo.svg'

type Props = {
  children: ReactNode
  /** Om satt visas en tunn accent under sidhuvudet */
  variant?: 'default' | 'minimal'
  /** Dölj sidfot (t.ex. helskärmsöversikt) */
  hideFooter?: boolean
}

export function Shell({ children, variant = 'default', hideFooter = false }: Props) {
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
      <main className={`shell-main${hideFooter ? ' shell-main--fill' : ''}`}>{children}</main>
    </div>
  )
}
