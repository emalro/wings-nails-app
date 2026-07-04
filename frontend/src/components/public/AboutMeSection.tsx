import React from 'react'
import { useConfig } from '../../hooks'

export default function AboutMeSection() {
  const { data: config } = useConfig()
  const html = config?.sobre_mi || ''

  if (!html) {
    return (
      <section className="section" aria-labelledby="sobre-mi-title">
        <div className="content">
          <div className="section-header">
            <span className="overline">Sobre mí</span>
            <h2 id="sobre-mi-title">Conocé a tu nail artist</h2>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
            Próximamente: historia, formación y filosofía de trabajo.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="section" aria-labelledby="sobre-mi-title">
      <div className="content">
        <div className="section-header">
          <span className="overline">Sobre mí</span>
          <h2 id="sobre-mi-title">Conocé a tu nail artist</h2>
        </div>
        <div
          className="about-copy"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  )
}
