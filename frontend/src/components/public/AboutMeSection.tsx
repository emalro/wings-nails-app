import React from 'react'

// TODO(sdd): user copy approval required
const ABOUT_COPY = [
  'Empecé en este mundo hace más de diez años, cuando descubrí que unas manos cuidadas pueden cambiar cómo te sentís con vos misma. No se trata solo de estética: es un ritual de pausa, un momento solo para vos.',
  'Me formé en técnicas clásicas y en nail art avanzado, y sigo capacitándome cada temporada para traer las tendencias que realmente valen la pena. Uso productos de calidad profesional, respeto los tiempos de secado y cuido la salud de tu uña natural ante todo.',
  'En cada turno mi objetivo es que te vayas tranquila, con las manos impecables y la cabeza más liviana. Porque en Nails Studio cada detalle importa, y el más importante sos vos.'
]

export default function AboutMeSection() {
  return (
    <section className="section" aria-labelledby="sobre-mi-title">
      <div className="content">
        <div className="section-header">
          <span className="overline">Sobre mí</span>
          <h2 id="sobre-mi-title">Conocé a tu nail artist</h2>
        </div>
        <div className="about-copy">
          {ABOUT_COPY.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}