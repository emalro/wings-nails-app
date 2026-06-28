/**
 * contactLinks — pattern guard for contact URLs.
 *
 * RULE: A contact link or button MUST NOT render if its URL is empty,
 * null, undefined, or whitespace-only. This prevents "phantom links"
 * that go nowhere (e.g., `href="#"` placeholders) and keeps the UI
 * honest about what's actually configured.
 *
 * Convention for new contact links (WhatsApp, Instagram, Facebook,
 * web, email, phone, etc.):
 *
 *   const myUrl = config?.my_url
 *   {isContactUrl(myUrl) && <a href={myUrl}>...</a>}
 *
 * For multi-channel surfaces (e.g., the Conectemos section in Home,
 * the footer social row, the navbar), each channel is gated
 * independently. The container is always shown; only the empty
 * channels disappear.
 *
 * Hardcoded fallback URLs (e.g., a default Instagram handle baked
 * into the code) are FORBIDDEN: they violate this rule by making
 * the link appear even when the admin hasn't configured it. Always
 * read the URL from config and let `isContactUrl` do the gating.
 */

export function isContactUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string') return false
  return url.trim().length > 0
}
