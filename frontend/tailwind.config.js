/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      sm: '600px',
      md: '768px',
      lg: '1024px',
    },
    extend: {
      colors: {
        // ── Brand: rose family ──
        primary:                  '#B85776', // strong rose — primary CTAs
        'primary-container':      '#F5C4D1', // light blush — soft surface tints
        'on-primary':             '#FFFFFF', // text/icon on --primary
        'on-primary-container':   '#7A2E47', // text on --primary-container

        // ── Brand: lavender family ──
        secondary:                '#8A75A0', // deep lavender — accents
        'secondary-container':    '#E0D5E8', // soft lilac — chip backgrounds
        'on-secondary':           '#FFFFFF', // text on --secondary
        'on-secondary-container': '#3D3251', // text on --secondary-container

        // ── Brand: tertiary (rose variant) ──
        tertiary:                 '#C66B96',
        'tertiary-container':     '#FADCE5',
        'on-tertiary':            '#FFFFFF',
        'on-tertiary-container':  '#5A2A40',

        // ── Surfaces ──
        background:               '#FDF8FA',
        surface:                  '#FFFFFF',
        'surface-container':      '#F5EEF2',
        'surface-container-low':  '#FAF5F7',
        'surface-variant':        '#E8DEE3',

        // ── Foreground (text) ──
        'on-background':          '#2A1F2C', // body text — AAA on background
        'on-surface':             '#2A1F2C',
        'on-surface-variant':     '#5A4A52',

        // ── Outlines ──
        outline:                  '#A89AA5',
        'outline-variant':        '#D2C5CC',

        // ── Status (semantic, NOT brand) ──
        // DO NOT use these for non-status UI decoration. The only hex in this
        // block that is a documented exception to "no warm tones for brand" is
        // --status-pending (warm gold) — it is reserved for appointment status
        // semantics and is gated by the design in
        // openspec/changes/visual-style-refresh/design.md §5.5.
        'status-confirmed':       '#7A5A8F', // lavender
        'status-pending':         '#D4A85F', // warm gold — status only
        'status-cancelled':       '#C66B7E', // rose
        'status-attended':        '#7AA899', // sage
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '20px',
      },
      boxShadow: {
        sm: '0 2px 8px rgba(184,87,118,0.08)',
        md: '0 8px 24px rgba(184,87,118,0.10)',
        lg: '0 16px 40px rgba(184,87,118,0.12)',
      },
      maxWidth: {
        content: '1120px',
      },
    },
  },
  plugins: [],
}
