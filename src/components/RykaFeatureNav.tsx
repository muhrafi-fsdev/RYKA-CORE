import { Link, useRouterState } from '@tanstack/react-router'
import { Accessibility, Camera, Hand, ShieldCheck } from 'lucide-react'

import './ryka-feature-nav.css'

export default function RykaFeatureNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const legacyAccess =
    typeof window !== 'undefined' &&
    pathname === '/' &&
    new URLSearchParams(window.location.search).get('mode') === 'access'

  const coreActive = pathname === '/' && !legacyAccess
  const accessActive = pathname === '/access' || legacyAccess

  return (
    <nav className="ryka-feature-nav" aria-label="Navigasi fitur RYKA CORE">
      <div className="ryka-feature-nav__brand" aria-label="RYKA CORE modules">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>RYKA</span>
      </div>

      <Link
        to="/"
        className={`ryka-feature-nav__item ${coreActive ? 'is-active' : ''}`}
        activeOptions={{ exact: true }}
      >
        <Hand size={15} aria-hidden="true" />
        <span>CORE</span>
      </Link>

      <Link
        to="/access"
        className={`ryka-feature-nav__item ${accessActive ? 'is-active' : ''}`}
      >
        <Accessibility size={15} aria-hidden="true" />
        <span>ACCESS</span>
      </Link>

      <Link
        to="/puzzle-cam"
        className={`ryka-feature-nav__item ${pathname === '/puzzle-cam' ? 'is-active' : ''}`}
      >
        <Camera size={15} aria-hidden="true" />
        <span>PUZZLE CAM</span>
      </Link>
    </nav>
  )
}
