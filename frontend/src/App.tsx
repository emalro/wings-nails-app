import React, { useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useConfig } from './hooks'

function whatsappUrl(number: string): string {
  if (!number) return '#'
  return `https://wa.me/${number.replace(/[^0-9]/g, '')}`
}

export default function App() {
  const { data: config } = useConfig()

  const businessName = config?.business_name || 'Nails Studio'
  const fbUrl = config?.facebook_url || '#'
  const igUrl = config?.instagram_url || '#'
  const waUrl = config?.whatsapp_number ? whatsappUrl(config.whatsapp_number) : '#'
  const address = config?.address || 'Rosario, Santa Fe'

  useEffect(() => {
    document.title = businessName
  }, [businessName])

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
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp">&#x1F4AC;</a>
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram">&#x1F4F8;</a>
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook">&#x1F310;</a>
            </div>
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
            <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp">&#x1F4AC;</a>
            <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram">&#x1F4F8;</a>
            <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook">&#x1F310;</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
