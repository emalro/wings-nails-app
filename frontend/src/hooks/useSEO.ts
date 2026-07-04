import { useEffect } from 'react'

interface SEOOptions {
  title: string
  description: string
  canonical?: string
}

const SITE_NAME = 'Nails Studio'
const DEFAULT_DESCRIPTION = 'Servicios profesionales de manicuría y nail design en Rosario, Santa Fe.'

export function useSEO({ title, description, canonical }: SEOOptions) {
  useEffect(() => {
    document.title = `${title} — ${SITE_NAME}`

    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', description)

    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute('content', `${title} — ${SITE_NAME}`)

    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute('content', description)

    const twitterTitle = document.querySelector('meta[name="twitter:title"]')
    if (twitterTitle) twitterTitle.setAttribute('content', `${title} — ${SITE_NAME}`)

    const twitterDesc = document.querySelector('meta[name="twitter:description"]')
    if (twitterDesc) twitterDesc.setAttribute('content', description)

    if (canonical) {
      let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
      if (!canonicalEl) {
        canonicalEl = document.createElement('link')
        canonicalEl.rel = 'canonical'
        document.head.appendChild(canonicalEl)
      }
      canonicalEl.href = canonical
    }
  }, [title, description, canonical])
}

export { SITE_NAME, DEFAULT_DESCRIPTION }
