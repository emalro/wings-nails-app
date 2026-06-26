import React, { useEffect } from 'react'
import { Outlet, Link } from '@tanstack/react-router'
import { useConfig } from './hooks'
import { useAuth } from './hooks/useAuth'
import { SkeletonLoader } from './components/SkeletonLoader'
import { FaWhatsapp, FaInstagram, FaFacebook, FaAddressBook } from "react-icons/fa";
import { GiAngelWings } from "react-icons/gi";


function whatsappUrl(number: string): string {
  if (!number) return '#'
  return `https://wa.me/${number.replace(/[^0-9]/g, '')}`
}

export default function App() {
  const { data: config } = useConfig()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const businessName = config?.business_name || 'Wings Nails'
  const fbUrl = config?.facebook_url || 'https://www.facebook.com/wingsnails.rosario'
  const igUrl = config?.instagram_url || 'https://www.instagram.com/wings__nails_/'
  const waUrl = config?.whatsapp_number ? whatsappUrl(config.whatsapp_number) : ''
  const address = config?.address || 'México 1223, S2000 Rosario, Santa Fe'

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
            <span className="navbar-brand-logo"><GiAngelWings /></span>
            {businessName}
          </Link>
          <div className="navbar-links">
            <Link to="/reservar" className="navbar-cta">Reservar Turno</Link>
            <div className="navbar-social">
              {waUrl.length > 0 && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp"><FaWhatsapp size={25} /></a>
              )}
              {igUrl.length > 0 && (
                <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram"><FaInstagram size={25} /></a>
              )}
              {fbUrl.length > 0 && (
                <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook"><FaFacebook size={25} /></a>
              )}
              <Link to={isAuthenticated ? "/admin" : "/login"}><FaAddressBook  size={25} /></Link>
            </div>   
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
            {waUrl.length > 0 && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp"><FaWhatsapp size={18} /></a>
            )}
            {igUrl.length > 0 && (
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram"><FaInstagram size={18} /></a>
            )}
            {fbUrl.length > 0 && (
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook"><FaFacebook  size={18} /></a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
