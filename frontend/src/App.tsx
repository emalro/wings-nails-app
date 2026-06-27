import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, Link } from '@tanstack/react-router'
import { useConfig } from './hooks'
import { useAuth } from './hooks/useAuth'
import { SkeletonLoader } from './components/SkeletonLoader'
import SkipLink from './components/SkipLink'
import { FaWhatsapp, FaInstagram, FaFacebook, FaAddressBook, FaBars, FaTimes } from "react-icons/fa";
import { GiAngelWings } from "react-icons/gi";


function whatsappUrl(number: string): string {
  if (!number) return '#'
  return `https://wa.me/${number.replace(/[^0-9]/g, '')}`
}

export default function App() {
  const { data: config } = useConfig()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const businessName = config?.business_name || 'Wings Nails'
  const fbUrl = config?.facebook_url || 'https://www.facebook.com/wingsnails.rosario'
  const igUrl = config?.instagram_url || 'https://www.instagram.com/wings__nails_/'
  const waUrl = config?.whatsapp_number ? whatsappUrl(config.whatsapp_number) : ''
  const address = config?.address || 'México 1223, S2000 Rosario, Santa Fe'

  useEffect(() => {
    document.title = businessName
  }, [businessName])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    if (!mobileOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mobileOpen, closeMobile])

  if (authLoading) {
    return (
      <div className="page-wrap">
        <SkipLink />
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
      <SkipLink />
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <span className="navbar-brand-logo"><GiAngelWings /></span>
            {businessName}
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1.5">
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
              <Link to={isAuthenticated ? "/admin" : "/login"}><FaAddressBook size={25} /></Link>
            </div>
          </div>

          {/* Hamburger button */}
          <button
            className="md:hidden bg-none border-none p-2 text-[var(--text)] text-1.3rem"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-lg transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <span className="font-[var(--font-display)] font-bold text-[var(--text)]">{businessName}</span>
          <button
            onClick={closeMobile}
            className="bg-none border-none text-[var(--text)] text-xl p-1"
            aria-label="Close menu"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <Link
            to="/reservar"
            className="block py-3 px-4 rounded-lg font-semibold text-[var(--primary)] bg-[var(--primary-light)] text-center"
            onClick={closeMobile}
          >
            Reservar Turno
          </Link>
          <Link
            to={isAuthenticated ? "/admin" : "/login"}
            className="block py-3 px-4 rounded-lg font-semibold text-[var(--text-secondary)] hover:bg-[var(--primary-light)] text-center"
            onClick={closeMobile}
          >
            <FaAddressBook className="inline mr-2" /> Admin
          </Link>
          <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-[var(--border)]">
            {waUrl.length > 0 && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className="text-[var(--text-secondary)] hover:text-[var(--primary)]"><FaWhatsapp size={22} /></a>
            )}
            {igUrl.length > 0 && (
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram" className="text-[var(--text-secondary)] hover:text-[var(--primary)]"><FaInstagram size={22} /></a>
            )}
            {fbUrl.length > 0 && (
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook" className="text-[var(--text-secondary)] hover:text-[var(--primary)]"><FaFacebook size={22} /></a>
            )}
          </div>
        </div>
      </div>

      <main className="page-main" id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="bg-[var(--text)] text-white/70 py-5 px-5 mt-auto">
        <div className="max-w-[1120px] mx-auto flex justify-between items-center gap-4 flex-wrap text-sm">
          <div>
            &copy; {new Date().getFullYear()} <span className="text-[var(--gold)]">{businessName}</span> &mdash; {address}.
          </div>
          <div className="flex gap-3">
            {waUrl.length > 0 && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className="text-white/60 hover:text-[var(--gold)] transition-colors"><FaWhatsapp size={18} /></a>
            )}
            {igUrl.length > 0 && (
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram" className="text-white/60 hover:text-[var(--gold)] transition-colors"><FaInstagram size={18} /></a>
            )}
            {fbUrl.length > 0 && (
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook" className="text-white/60 hover:text-[var(--gold)] transition-colors"><FaFacebook size={18} /></a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
