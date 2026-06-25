# Form Validation

**Domain**: `form-validation`
**Status**: Active

---

## Purpose

Client-side validation for booking, admin, and login forms with inline field errors, submit gating, and visual feedback.

## Requirements

### VAL-001 — Appointment Form Validation (MUST)

The booking form MUST validate: client selection (required), date/time (required, must be future), at least one service (required), observaciones (required, max 500 chars).

#### Scenario: Missing client

- GIVEN empty client field
- WHEN user submits booking form
- THEN inline error "Seleccioná una clienta" below field
- AND form does not submit

#### Scenario: Past date rejected

- GIVEN selected date is yesterday
- WHEN user submits
- THEN error "La fecha debe ser futura" shown
- AND submission blocked

#### Scenario: No services selected

- GIVEN no services checked in the list
- WHEN user submits
- THEN error "Seleccioná al menos un servicio" shown
- AND submission blocked

#### Scenario: Valid form submits

- GIVEN client, future date, one service, and observaciones filled
- WHEN user submits
- THEN form submits successfully with no inline errors

### VAL-002 — Client Form Validation (MUST)

The admin client form MUST validate: nombre (required), apellido (required), dni (required, digits only), teléfono (required, Argentine phone format), email (optional, valid format if provided).

#### Scenario: Required fields empty

- GIVEN empty nombre, apellido, dni, teléfono
- WHEN user submits client form
- THEN each field shows respective inline error
- AND form does not submit

#### Scenario: Invalid email rejected

- GIVEN email value "not-an-email"
- WHEN user submits
- THEN error "Email inválido" shown below field
- AND submission blocked

#### Scenario: Optional email omitted

- GIVEN all required fields valid, email empty
- WHEN user submits
- THEN form submits (email field is optional)

### VAL-003 — Login Form Validation (MUST)

The login form MUST validate: email (required, valid format), password (required).

#### Scenario: Missing credentials

- GIVEN empty email and password fields
- WHEN user submits
- THEN both fields show "requerido" errors
- AND form does not submit

#### Scenario: Invalid email format

- GIVEN email "admin" (no domain)
- WHEN user submits
- THEN error "Formato de email inválido" shown

### VAL-004 — Visual Feedback Behavior (MUST)

All forms MUST display inline errors below invalid fields, disable submit button while invalid or submitting, and clear errors on valid re-entry.

#### Scenario: Error clears on valid input

- GIVEN a field showing inline error
- WHEN user types a valid value
- THEN inline error disappears without requiring resubmit

#### Scenario: Submit disabled while invalid

- GIVEN at least one validation error present
- THEN submit button is disabled
- WHEN all fields become valid
- THEN submit button enables

### VAL-005 — Validation Hook (SHOULD)

The frontend SHOULD provide a reusable `useValidation` hook accepting field rule definitions and returning `{ errors, isValid, validateAll, clearErrors }`.

#### Scenario: Hook returns validation state

- GIVEN `useValidation` with rules requiring `nombre` to be non-empty
- WHEN `validateAll` is called with `{ nombre: "" }`
- THEN returns `{ errors: { nombre: "Este campo es requerido" }, isValid: false }`

## Edge Cases

| Case | Behavior |
|------|----------|
| Whitespace-only input | Trimmed before validation — treated as empty |
| Double-click rapid submit | Button disabled during pending submission |
| DNI with leading zeros | Preserved as-is, no stripping |
| Email case sensitivity | Normalized to lowercase and re-validated |
| Input exceeding maxlength | Truncated at field maxlength attribute |
| Tab-between-fields | Validates individually on blur |
