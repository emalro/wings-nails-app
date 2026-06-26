# Delta for Admin Agenda Visual

## MODIFIED Requirements

### Requirement: Admin Route Protection

All admin routes SHALL require authentication via JWT token validation. Unauthenticated users attempting to access admin routes SHALL be redirected to the login page.

(Previously: No authentication requirement for admin routes)

#### Scenario: Unauthenticated access to admin panel

- GIVEN user is not authenticated
- WHEN user navigates to /admin or any admin sub-route
- THEN user is redirected to /login
- AND a flash message indicates authentication is required

#### Scenario: Authenticated access to admin panel

- GIVEN user is authenticated with valid JWT
- WHEN user navigates to /admin
- THEN admin panel loads normally
- AND all calendar and appointment features function as specified

## ADDED Requirements

### Requirement: Admin Session Persistence

The admin panel SHALL maintain user session across page refreshes using refresh tokens stored in httpOnly cookies.

#### Scenario: Session persistence on refresh

- GIVEN user is authenticated with valid refresh token
- WHEN user refreshes the page
- THEN system validates refresh token
- AND issues new access token if needed
- AND admin panel remains accessible without re-login

#### Scenario: Session expiration

- GIVEN user's refresh token has expired
- WHEN user refreshes the page
- THEN system clears expired tokens
- AND redirects to /login
- AND displays session expired message

## Edge Cases

| Case | Behavior |
|------|----------|
| Token expires during active session | Axios interceptor silently refreshes token |
| Multiple browser tabs | Auth state synchronized via shared cookies |
| Admin manually clears cookies | Next navigation redirects to login |
| Backend auth service unavailable | Admin panel shows maintenance message |
