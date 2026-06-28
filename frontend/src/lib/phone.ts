/**
 * phone — Frontend mirror of backend normalize_phone.
 *
 * A-17: the canonical wire format for telefono is digits-only. The
 * backend already normalizes before storing, but the frontend also
 * needs to validate after normalization so the input length matches
 * the backend's >= 7 digit rule (a user typing "(0341) 5" passes
 * the backend on digits = 5, but the form should show the error
 * locally instead of waiting for the round-trip).
 *
 * The 10-11 digit range is what the booking flow enforces locally
 * (Argentina mobile + landline); the backend's >= 7 is a safety net
 * for international or short numbers in admin flows.
 */

/** Strip every non-digit character. Matches backend `normalize_phone`. */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  return input.replace(/\D/g, '')
}

/** True if the input, after normalization, has at least 7 digits. */
export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input).length >= 7
}
