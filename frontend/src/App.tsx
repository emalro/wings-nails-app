import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Outlet, Link } from '@tanstack/react-router'
import { useConfig } from './hooks'
import { useAuth } from './hooks/useAuth'
import { SkeletonLoader } from './components/SkeletonLoader'
import SkipLink from './components/SkipLink'
import ScrollToTop from './components/ScrollToTop'
import { FaWhatsapp, FaInstagram, FaFacebook, FaAddressBook, FaBars, FaTimes } from "react-icons/fa";
import { isContactUrl } from "./lib/contactLinks";


function whatsappUrl(number: string): string {
  if (!number) return '#'
  return `https://wa.me/${number.replace(/[^0-9]/g, '')}`
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function App() {
  const { data: config } = useConfig()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const businessName = config?.business_name || 'Wings Nails'
  const fbUrl = config?.facebook_url || ''
  const igUrl = config?.instagram_url || ''
  const waUrl = config?.whatsapp_number ? whatsappUrl(config.whatsapp_number) : ''
  const adminLabel = 'Administración'

  useEffect(() => {
    document.title = businessName
  }, [businessName])

  // Track viewport size: hide the WhatsApp FAB on desktop where the
  // navbar already exposes the same icon in the social row.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(min-width: 768px)')
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    setIsDesktop(mq.matches)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Mobile drawer: Escape closes, focus trap keeps Tab/Shift+Tab inside the
  // drawer while it is open. Focus moves to the close button on open.
  useEffect(() => {
    if (!mobileOpen) return

    // Defer focus to the next paint so the element is in the DOM tree.
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 0)

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobile()
        return
      }
      if (e.key !== 'Tab' || !drawerRef.current) return
      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKey)
    }
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
        <main className="page-main" id="main" tabIndex={-1}>
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
            <img src="/logo.png" alt={businessName} width={36} height={36} className="navbar-brand-logo" />
            {businessName}
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1.5">
            <Link to="/reservar" className="navbar-cta">Reservar Turno</Link>
            <div className="navbar-social">
              {isContactUrl(waUrl) && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp"><FaWhatsapp size={22} /></a>
              )}
              {isContactUrl(igUrl) && (
                <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram"><FaInstagram size={22} /></a>
              )}
              {isContactUrl(fbUrl) && (
                <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook"><FaFacebook size={22} /></a>
              )}
              <Link
                to={isAuthenticated ? "/admin" : "/login"}
                aria-label={adminLabel}
                title={adminLabel}
              >
                <FaAddressBook size={22} />
              </Link>
            </div>
          </div>

          {/* Hamburger button */}
          <button
            className="md:hidden bg-none border-none p-2 text-[var(--on-background)] text-1.3rem"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-drawer"
          >
            {mobileOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(42, 31, 44, 0.45)' }}
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-72 bg-[var(--surface)] z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ boxShadow: 'var(--shadow-lg)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Navegación móvil"
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--outline-variant)]">
          <span className="font-[var(--font-display)] font-bold text-[var(--on-background)]">{businessName}</span>
          <button
            ref={closeButtonRef}
            onClick={closeMobile}
            className="bg-none border-none text-[var(--on-background)] text-xl p-1 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <Link
            to="/reservar"
            className="block py-3 px-4 rounded-lg font-semibold text-[var(--on-primary)] bg-[var(--primary)] text-center"
            onClick={closeMobile}
          >
            Reservar Turno
          </Link>
          <Link
            to={isAuthenticated ? "/admin" : "/login"}
            className="block py-3 px-4 rounded-lg font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--primary-container)] hover:text-[var(--on-primary-container)] transition-colors text-center"
            onClick={closeMobile}
            aria-label={adminLabel}
          >
            <FaAddressBook className="inline mr-2" /> Administración
          </Link>
          <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-[var(--outline-variant)]">
            {isContactUrl(waUrl) && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className="text-[var(--on-surface-variant)] hover:text-[var(--primary)] inline-flex items-center justify-center min-w-[24px] min-h-[24px]"><FaWhatsapp size={22} /></a>
            )}
            {isContactUrl(igUrl) && (
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram" className="text-[var(--on-surface-variant)] hover:text-[var(--primary)] inline-flex items-center justify-center min-w-[24px] min-h-[24px]"><FaInstagram size={22} /></a>
            )}
            {isContactUrl(fbUrl) && (
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook" className="text-[var(--on-surface-variant)] hover:text-[var(--primary)] inline-flex items-center justify-center min-w-[24px] min-h-[24px]"><FaFacebook size={22} /></a>
            )}
          </div>
        </div>
      </div>

      <main className="page-main" id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="bg-[var(--on-background)] text-white/70 py-5 px-5 mt-auto">
        <div className="max-w-[1120px] mx-auto flex justify-between items-center gap-4 flex-wrap text-sm">
          <div>
            &copy; {new Date().getFullYear()} <span className="text-[var(--secondary-container)]">{businessName}</span>. Todos los derechos reservados.
          </div>
          <div className="flex gap-3">
            {isContactUrl(waUrl) && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className="text-white/70 hover:text-[var(--secondary-container)] transition-colors"><FaWhatsapp size={22} /></a>
            )}
            {isContactUrl(igUrl) && (
              <a href={igUrl} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram" className="text-white/70 hover:text-[var(--secondary-container)] transition-colors"><FaInstagram size={22} /></a>
            )}
            {isContactUrl(fbUrl) && (
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook" className="text-white/70 hover:text-[var(--secondary-container)] transition-colors"><FaFacebook size={22} /></a>
            )}
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp FAB — visible on mobile only, hides when the
          navbar already exposes the same icon (desktop) or the mobile
          drawer is open. Sits above the ScrollToTop button in the
          bottom-right stack. */}
      {isContactUrl(waUrl) && !isDesktop && !mobileOpen && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-fab"
          aria-label="Contactar por WhatsApp"
          title="Contactar por WhatsApp"
        >
          <FaWhatsapp size={26} />
        </a>
      )}

      <ScrollToTop />
    </div>
  )
}
