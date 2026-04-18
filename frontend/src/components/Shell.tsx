import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Om satt visas en tunn accent under sidhuvudet */
  variant?: 'default' | 'minimal'
}

export function Shell({ children, variant = 'default' }: Props) {
  return (
    <div className={`shell shell--${variant}`}>
      <header className="shell-header">
        <Link to="/" className="shell-logo">
          Valut
        </Link>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <p>Valut · Sparande som följer dina mål</p>
      </footer>
    </div>
  )
}
