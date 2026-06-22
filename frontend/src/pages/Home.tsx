import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useServices, useConfig } from '../hooks'

type Service = {
  id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
}

export default function Home() {
  const navigate = useNavigate()
  const { data: services = [], isLoading } = useServices()
  const { data: config } = useConfig()

  return (
    <>
      <section className="hero">
        <div className="hero-accent" />
        <h1>Tu estilo,<br />en manos expertas</h1>
        <p>
          En {config?.business_name || 'Nails Studio'} cada detalle importa. Servicios profesionales de
          manicuría y nail design en un ambiente pensado para vos.
        </p>
        <div className="hero-actions">
          <button className="hero-btn-primary" onClick={() => navigate('/reservar')}>
            Reservá tu turno
          </button>
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
            <div className="empty-state">Cargando servicios...</div>
          ) : services.length === 0 ? (
            <div className="empty-state">No hay servicios disponibles por el momento.</div>
          ) : (
            <div className="service-grid">
              {services.map((service: Service) => (
                <div key={service.id} className="service-card">
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

      <section className="cta-section">
        <h2>¿Necesitás hacerte las uñas?</h2>
        <p>Agendá tu turno online y asegurá tu lugar. Elegí día, horario y servicio sin moverte de tu casa.</p>
        <button className="cta-btn" onClick={() => navigate('/reservar')}>
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
            <p className="hint">{config?.address || 'Rosario, Santa Fe'}</p>
          </div>
        </div>
      </section>
    </>
  )
}
