import React, { useEffect, useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useConfig } from './hooks'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/layout/Navbar'
import SkipLink from './components/SkipLink'
import ScrollToTop from './components/ScrollToTop'
import { FaWhatsapp, FaInstagram, FaFacebook } from "react-icons/fa";
import { isContactUrl } from "./lib/contactLinks";


export default function App() {
  const { data: config } = useConfig()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [isDesktop, setIsDesktop] = useState(false)

  const businessName = config?.business_name || 'Wings Nails'
  const fbUrl = config?.facebook_url || ''
  const igUrl = config?.instagram_url || ''
  const waUrl = config?.whatsapp_number ? `https://wa.me/${config.whatsapp_number.replace(/[^0-9]/g, '')}` : ''

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

  if (authLoading) {
    return (
      <div className="page-wrap">
        <SkipLink />
        <Navbar
          isDesktop={isDesktop}
          isAuthenticated={isAuthenticated}
          isLoading
          businessName={businessName}
          fbUrl={fbUrl}
          igUrl={igUrl}
          waUrl={waUrl}
        />
        <main className="page-main" id="main" tabIndex={-1}>
          <div className="max-w-2xl mx-auto mt-8 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-[var(--surface-container)] rounded w-1/3" />
              <div className="h-4 bg-[var(--surface-container)] rounded w-full" />
              <div className="h-4 bg-[var(--surface-container)] rounded w-2/3" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <SkipLink />
      <Navbar
        isDesktop={isDesktop}
        isAuthenticated={isAuthenticated}
        businessName={businessName}
        fbUrl={fbUrl}
        igUrl={igUrl}
        waUrl={waUrl}
      />

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
      {isContactUrl(waUrl) && !isDesktop && (
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
