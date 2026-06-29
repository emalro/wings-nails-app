import React from 'react'

/**
 * HoneypotField — a hidden input rendered in the booking form.
 *
 * Purpose (REQ-PUB-005, D2): naive spam-bots fill every visible input
 * on the page before submitting. This field is invisible to humans
 * (off-screen absolute position, aria-hidden, tabindex=-1) so a real
 * visitor never fills it, but a naive bot that scrapes the DOM and
 * posts every input will fill it. The backend then returns silent 200
 * with no DB write (D2) so the bot learns nothing from triggering it.
 *
 * DOM-vs-JSON-key trick (D7):
 *   - DOM name is "website" — a plausibly innocuous field name that a
 *     naive bot may autofill.
 *   - JSON key in the request body is "honeypot" — a generic name that
 *     is NOT trivially discoverable by inspecting the network panel.
 *   - The backend reads payload.honeypot, not payload.website.
 *   - The two are intentionally different so a bot that learns one
 *     does not automatically learn the other.
 *
 * Why not display:none? `display: none` is a known signal to bot
 * fingerprinters — sophisticated bots strip hidden fields. The
 * off-screen absolute pattern keeps the field in the rendered tree
 * (so a naive bot submits it) but visually hides it.
 */
function HoneypotField() {
  return (
    <input
      type="text"
      name="website"
      value=""
      onChange={() => {
        // Suppress React controlled-input warning: the field is
        // intentionally read-only from the user's perspective (bots
        // fill it; humans don't see it). We never read .value off
        // the DOM — the backend parses the JSON body for `honeypot`.
      }}
      aria-hidden="true"
      tabIndex={-1}
      autoComplete="off"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    />
  )
}

export default HoneypotField
