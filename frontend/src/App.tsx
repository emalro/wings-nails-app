import React, { useEffect } from 'react'
import { Outlet, Link } from '@tanstack/react-router'
import { useConfig } from './hooks'
import { useAuth } from './hooks/useAuth'
import { SkeletonLoader } from './components/SkeletonLoader'

function whatsappUrl(number: string): string {
  if (!number) return '#'
  return `https://wa.me/${number.replace(/[^0-9]/g, '')}`
}

function IconWhatsApp({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 6.5a8.5 8.5 0 0 1-2.5 12.5l-4 1 1.3-3.8A8.5 8.5 0 1 1 17.5 6.5Z" />
      <path d="M9 10.5c0-.3.2-.5.5-.5h1c.3 0 .5.2.5.5v.5c0 .8-.7 1.5-1.5 1.5h-.5" />
      <path d="M12 10.5c0-.3.2-.5.5-.5h1c.3 0 .5.2.5.5v.5c0 .8-.7 1.5-1.5 1.5h-.5" />
    </svg>
  )
}

function IconInstagram({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="18" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconFacebook({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z" />
    </svg>
  )
}

export default function App() {
  const { data: config } = useConfig()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const businessName = config?.business_name || 'Nails Studio'
  const fbUrl = config?.facebook_url || '#'
  const igUrl = config?.instagram_url || '#'
  const waUrl = config?.whatsapp_number ? whatsappUrl(config.whatsapp_number) : '#'
  const address = config?.address || 'Rosario, Santa Fe'

  useEffect(() => {
    document.title = businessName
  }, [businessName])

  if (authLoading) {
    return (
      <div className="page-wrap">
        <nav className="navbar">
          <div className="navbar-inner">
            <div className="navbar-brand">
              <span className="navbar-brand-logo">✦</span>
              <SkeletonLoader lines={1} className="w-32 inline-block" />
            </div>
          </div>
        </nav>
        <main className="page-main">
          <SkeletonLoader variant="card" className="max-w-2xl mx-auto mt-8" />
        </main>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <span className="navbar-brand-logo">✦</span>
            {businessName}
          </Link>
          <div className="navbar-links">
            <Link to="/" className="nav-link-text">Inicio</Link>
            <div className="navbar-social">
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp"><IconWhatsApp /></a>
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram"><IconInstagram /></a>
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook"><IconFacebook /></a>
            </div>
            <Link to={isAuthenticated ? "/admin" : "/login"} className="navbar-cta">Ingresar</Link>
            <Link to="/reservar" className="navbar-cta">Reservar Turno</Link>
          </div>
        </div>
      </nav>

      <main className="page-main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-left">
            &copy; {new Date().getFullYear()} <span>{businessName}</span> &mdash; {address}.
          </div>
          <div className="footer-social">
            <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp"><IconWhatsApp size={18} /></a>
            <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram"><IconInstagram size={18} /></a>
            <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook"><IconFacebook size={18} /></a>
          </div>
        </div>
      </footer>
    </div>
  )
}
