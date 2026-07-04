import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTestimonials, type TestimonialRead } from '../../api'

export default function TestimonialsSection() {
  const { data: testimonials = [], isLoading } = useQuery<TestimonialRead[]>({
    queryKey: ['testimonials-public'],
    queryFn: getTestimonials,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  if (isLoading || testimonials.length === 0) {
    return null
  }

  return (
    <section className="section section-alt" aria-labelledby="testimonios-title">
      <div className="content">
        <div className="section-header">
          <span className="overline">Testimonios</span>
          <h2 id="testimonios-title">Lo que dicen nuestras clientas</h2>
          <p>Experiencias reales de quienes ya nos visitaron.</p>
        </div>

        <div className="testimonials-grid" role="list" aria-label="Testimonios de clientas">
          {testimonials.map((testimonial) => (
            <article key={testimonial.id} className="testimonial-card" role="listitem">
              <blockquote className="testimonial-quote">
                <p>&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <footer className="testimonial-author">
                <div className="testimonial-name">{testimonial.nombre}</div>
                {testimonial.rol && (
                  <div className="testimonial-role">{testimonial.rol}</div>
                )}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
