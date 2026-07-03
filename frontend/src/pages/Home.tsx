import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServices, useConfig } from '../hooks'
import { isContactUrl } from '../lib/contactLinks'
import { SkeletonLoader } from '../components/SkeletonLoader'
import { GallerySection } from '../components/public/GallerySection'
import AboutMeSection from '../components/public/AboutMeSection'
import type { Servicio } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const { data: services = [], isLoading, isError: servicesError, refetch: refetchServices } = useServices()
  const { data: config, isLoading: configLoading } = useConfig()

  const fbUrl = config?.facebook_url || ''
  const igUrl = config?.instagram_url || ''
  const waUrl = config?.whatsapp_number
    ? `https://wa.me/${config.whatsapp_number.replace(/[^0-9]/g, '')}`
    : ''
  const address = config?.address || 'Rosario, Santa Fe'

  // REQ-VIS-011: bento layout — first card spans 2 cols when there are 3+
  // services. The grid itself uses auto-fill, minmax(280px, 1fr) so the
  // number of services doesn't break the layout.
  const showBentoFeature = services.length >= 3

  // Placeholder components for upcoming sections (W2.4, W2.5, W2.6)
  function SobreMi() {
    return (
      <section className="section" aria-labelledby="sobre-mi-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Sobre mí</span>
            <h2 id="sobre-mi-title">Conocé a tu nail artist</h2>
            <p>Próximamente: historia, formación y filosofía de trabajo.</p>
          </div>
        </div>
      </section>
    )
  }

  function ComoReservar() {
    return (
      <section className="section section-alt" aria-labelledby="como-reservar-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Cómo reservar</span>
            <h2 id="como-reservar-title">Reservá tu turno en 3 pasos</h2>
            <p>Próximamente: guía paso a paso para agendar tu turno online.</p>
          </div>
        </div>
      </section>
    )
  }

  function Testimonios() {
    return (
      <section className="section" aria-labelledby="testimonios-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Testimonios</span>
            <h2 id="testimonios-title">Lo que dicen nuestras clientas</h2>
            <p>Próximamente: reseñas y experiencias reales.</p>
          </div>
        </div>
      </section>
    )
  }

  function FAQ() {
    return (
      <section className="section section-alt" aria-labelledby="faq-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">FAQ</span>
            <h2 id="faq-title">Preguntas frecuentes</h2>
            <p>Próximamente: respuestas a las dudas más frecuentes.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Tu estilo,<br />en manos expertas</h1>
        <p>
          En {config?.business_name || 'Nails Studio'} cada detalle importa. Servicios profesionales de
          manicuría y nail design en un ambiente pensado para vos.
        </p>
        {/* REQ-VIS-005 + REQ-VIS-006: two CTAs above the fold. The rose
            "Reservar Turno" is the primary action; the lavender WhatsApp
            CTA is the secondary action. */}
        <div className="hero-actions">
          <button
            className="hero-btn-primary"
            onClick={() => navigate({ to: '/reservar' })}
            aria-label="Reservar Turno"
          >
            Reservar Turno
          </button>
          {isContactUrl(waUrl) && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-btn-secondary"
              aria-label="Contactar por WhatsApp"
            >
              Contactar por WhatsApp
            </a>
          )}
        </div>
      </section>

      <section className="section" id="servicios">
        <div className="content">
          <div className="section-header">
            <span className="overline">Servicios</span>
            <h2>Elegí el diseño que más te guste</h2>
            <p>Explorá nuestra cartelera de servicios y encontrá el look ideal para tu próxima visita.</p>
          </div>

          {isLoading ? (
            <div className="service-grid" aria-busy="true" aria-label="Cargando servicios">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonLoader key={i} variant="card" />
              ))}
            </div>
          ) : servicesError ? (
            <div className="empty-state" role="alert">
              <p>No pudimos cargar los servicios. El servidor puede estar despertando.</p>
              <button
                type="button"
                onClick={() => refetchServices()}
                className="button-primary mt-3 inline-flex"
              >
                Reintentar
              </button>
            </div>
          ) : services.length === 0 ? (
            <div className="empty-state">No hay servicios disponibles por el momento.</div>
          ) : (
            <div className="service-grid">
              {services.map((service: Servicio, idx: number) => (
                <div
                  key={service.id}
                  className={`service-card${showBentoFeature && idx === 0 ? ' bento-feature' : ''}`}
                >
                  <div className="service-card-top">
                    <span className="service-card-title">{service.nombre_servicio}</span>
                    <span className="service-card-price">${service.precio_actual}</span>
                  </div>
                  <p className="service-card-desc">{service.descripcion}</p>
                  <div className="service-card-meta">
                    <span>{service.duracion_minutos} min</span>
                    <span>Seña ${service.monto_sena_actual}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* W2.3 — Galería (REQ-VIS-GALLERY) */}
      <GallerySection />

      {/* W2.4 — Sobre mí */}
      <AboutMeSection />

      {/* W2.5 — Cómo reservar (placeholder) */}
      <ComoReservar />

      {/* W2.6 — Testimonios (placeholder) */}
      <Testimonios />

      {/* W2.7 — FAQ (placeholder) */}
      <FAQ />

      {/* REQ-VIS-006: Conectemos section — WhatsApp rose chip + Instagram
          lavender chip + Facebook rose-variant chip + address. */}
      <section className="section section-conectemos" aria-labelledby="conectemos-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Conectemos</span>
            <h2 id="conectemos-title">Hablamos por donde te quede más cómodo</h2>
            <p>Elegí tu canal favorito para reservar, hacer una consulta o ver los últimos diseños.</p>
          </div>
          <div className="conectemos-grid" aria-busy={configLoading || undefined}>
            {configLoading ? (
              <>
                <div className="h-12 w-32 bg-surface-container rounded-full animate-pulse" aria-hidden="true" />
                <div className="h-12 w-32 bg-surface-container rounded-full animate-pulse" aria-hidden="true" />
                <div className="h-12 w-32 bg-surface-container rounded-full animate-pulse" aria-hidden="true" />
              </>
            ) : isContactUrl(waUrl) && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="conectemos-chip chip-whatsapp"
                aria-label="Contactar por WhatsApp"
              >
                WhatsApp
              </a>
            )}
            {isContactUrl(igUrl) && (
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="conectemos-chip chip-instagram"
                aria-label="Ver Instagram"
              >
                Instagram
              </a>
            )}
            {isContactUrl(fbUrl) && (
              <a
                href={fbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="conectemos-chip chip-facebook"
                aria-label="Ver Facebook"
              >
                Facebook
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="cta-section" aria-labelledby="cta-title">
        <h2 id="cta-title">¿Necesitás hacerte las uñas?</h2>
        <p>Agendá tu turno online y asegurá tu lugar. Elegí día, horario y servicio sin moverte de tu casa.</p>
        <button className="cta-btn" onClick={() => navigate({ to: '/reservar' })}>
          Reservar Turno
        </button>
      </section>

      <section className="section section-alt">
        <div className="content">
          <div className="section-header">
            <span className="overline">Ubicación</span>
            <h2>Vení a conocernos</h2>
            <p>Estamos en Rosario, Santa Fe. Agendá tu visita y disfrutá de una experiencia única.</p>
          </div>
          <div className="map-container">
            <iframe
              className="map-iframe"
              src={`https://www.google.com/maps?q=${encodeURIComponent(config?.address || 'Rosario, Santa Fe')}&output=embed`}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación del estudio"
            />
            <p className="hint">{configLoading ? <SkeletonLoader variant="text" lines={1} className="max-w-xs mx-auto" /> : (config?.address || 'Rosario, Santa Fe')}</p>
          </div>
        </div>
      </section>
    </>
  )
}
