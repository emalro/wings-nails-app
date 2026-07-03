import React from 'react'

// TODO(sdd): user copy approval required
const TESTIMONIALS = [
  {
    name: 'María González',
    role: 'Clienta habitual',
    quote: 'La atención es impecable. Salgo siempre con las uñas perfectas y me siento muy cuidada en cada visita. ¡Totalmente recomendable!',
  },
  {
    name: 'Laura Fernández',
    role: 'Primera vez',
    quote: 'No sabía qué diseño elegir y me asesoraron con mucha paciencia. El resultado superó mis expectativas. Volveré sin duda.',
  },
  {
    name: 'Carolina Ruiz',
    role: 'Clienta desde 2022',
    quote: 'Años confiando en este estudio y nunca me decepcionan. La calidad de los productos y la higiene son de diez.',
  },
] as const

export default function TestimonialsSection() {
  return (
    <section className="section section-alt" aria-labelledby="testimonios-title">
      <div className="content">
        <div className="section-header">
          <span className="overline">Testimonios</span>
          <h2 id="testimonios-title">Lo que dicen nuestras clientas</h2>
          <p>Experiencias reales de quienes ya nos visitaron.</p>
        </div>

        <div className="testimonials-grid" role="list" aria-label="Testimonios de clientas">
          {TESTIMONIALS.map((testimonial, index) => (
            <article key={index} className="testimonial-card" role="listitem">
              <div className="testimonial-badge">Ejemplo</div>
              <blockquote className="testimonial-quote">
                <p>&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <footer className="testimonial-author">
                <div className="testimonial-name">{testimonial.name}</div>
                {testimonial.role && (
                  <div className="testimonial-role">{testimonial.role}</div>
                )}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}