import React from 'react'
import { useNavigate } from '@tanstack/react-router'

// TODO(sdd): user copy approval required
const STEPS = [
  {
    number: 1,
    title: 'Elegí tus servicios',
    description: 'Seleccioná uno o más diseños y servicios de nuestra cartelera. Podés combinarlos como quieras.',
  },
  {
    number: 2,
    title: 'Completá tus datos',
    description: 'Ingresá nombre, apellido, DNI, teléfono (WhatsApp) y elegí fecha y hora para tu turno.',
  },
  {
    number: 3,
    title: 'Confirmá la reserva',
    description: 'Revisá el resumen: servicios, horario, total y seña. Si está todo bien, confirmá el turno.',
  },
  {
    number: 4,
    title: 'Pagá la seña',
    description: 'Aboná la seña por transferencia (CBU/Alias) y enviá el comprobante por WhatsApp. Tu turno queda en estado Pendiente hasta validar el pago.',
  },
]

export default function HowToBookSection() {
  const navigate = useNavigate()

  return (
    <section className="section section-alt" aria-labelledby="como-reservar-title">
      <div className="content">
        <div className="section-header">
          <span className="overline">Cómo reservar</span>
          <h2 id="como-reservar-title">Reservá tu turno en 4 pasos</h2>
          <p>Así de simple: elegí, completá, confirmá y pagá la seña. Todo online, sin llamadas.</p>
        </div>

        <ol className="steps-list" role="list">
          {STEPS.map((step) => (
            <li key={step.number} className="step-item">
              <div className="step-number">{step.number}</div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="steps-cta">
          <button
            className="button-primary"
            onClick={() => navigate({ to: '/reservar' })}
            aria-label="Reservar Turno"
          >
            Reservar Turno
          </button>
          <p className="steps-hint">Te llevamos directo al calendario para elegir día y hora.</p>
        </div>
      </div>
    </section>
  )
}