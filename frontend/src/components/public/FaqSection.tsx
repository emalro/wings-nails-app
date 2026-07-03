import React, { useState, useCallback } from 'react'

// TODO(sdd): user copy approval required
const FAQS = [
  {
    question: '¿Cómo reservo mi turno?',
    answer:
      'Es muy simple: entrás a la sección "Reservar Turno", elegís los servicios que querés, completás tus datos, elegís día y hora, confirmás y pagás la seña por transferencia. Tu turno queda en estado Pendiente hasta que validamos el pago.',
  },
  {
    question: '¿Cuánto tiempo antes debo cancelar o reprogramar?',
    answer:
      'Pedimos que avisés con al menos 24 horas de antelación para cancelar o reprogramar sin cargo. Si avisás con menos tiempo, la seña no se devuelve. Podés hacerlo desde el link que te llega por WhatsApp o respondiendo al mensaje de confirmación.',
  },
  {
    question: '¿Qué formas de pago aceptan?',
    answer:
      'La seña se abona por transferencia bancaria (CBU/Alias) y se valida enviando el comprobante por WhatsApp. El resto del servicio se paga en el estudio al finalizar tu turno, en efectivo o transferencia.',
  },
  {
    question: '¿Puedo combinar varios servicios en un mismo turno?',
    answer:
      'Sí, podés combinar los servicios que quieras. El sistema suma las duraciones automáticamente y te muestra el total y la seña correspondiente. Si la duración supera cierto límite, el sistema te avisará para que lo dividas en dos turnos.',
  },
  {
    question: '¿Qué pasa si llego tarde a mi turno?',
    answer:
      'Te esperamos hasta 10 minutos de cortesía. Si llegás más tarde, es posible que tengamos que acortar el servicio o reprogramar, según la disponibilidad del día. Te recomendamos llegar 5 minutos antes para acomodarte tranquila.',
  },
] as const

export default function FaqSection() {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set())

  const toggleIndex = useCallback((index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const isOpen = useCallback(
    (index: number) => openIndices.has(index),
    [openIndices]
  )

  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="content">
        <div className="section-header">
          <span className="overline">FAQ</span>
          <h2 id="faq-title">Preguntas frecuentes</h2>
          <p>Respuestas rápidas a las dudas más comunes.</p>
        </div>

        <div className="faq-list" role="list" aria-label="Preguntas frecuentes">
          {FAQS.map((faq, index) => (
            <details
              key={index}
              className="faq-item"
              open={isOpen(index)}
              onToggle={(e) => {
                e.preventDefault()
                toggleIndex(index)
              }}
            >
              <summary className="faq-question" aria-expanded={isOpen(index)}>
                <span>{faq.question}</span>
                <span className="faq-chevron" aria-hidden="true" />
              </summary>
              <div className="faq-answer" role="region" aria-label={`Respuesta: ${faq.question}`}>
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div    )
}