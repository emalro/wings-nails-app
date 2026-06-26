# User Auth Specification

## Purpose

JWT-based authentication system for protecting admin routes. Provides login, token management, route protection, and admin user seeding from environment variables.

## Requirements

### Requirement: Admin User Seeding

The system SHALL seed a single admin user on startup from environment variables if not already present in database.

#### Scenario: Admin seeded on first startup

- GIVEN the database has no admin user
- WHEN the application starts
- THEN an admin user is created with email from ADMIN_EMAIL env var
- AND hashed password from ADMIN_PASSWORD_HASH env var
- AND role set to "admin"

#### Scenario: Admin already exists

- GIVEN the database already contains an admin user
- WHEN the application starts
- THEN no duplicate admin user is created

### Requirement: Login Endpoint

The system SHALL provide a POST /auth/login endpoint that validates credentials and returns JWT access and refresh tokens.

#### Scenario: Successful login

- GIVEN a valid admin email and password
- WHEN POST /auth/login with credentials
- THEN response contains access_token and refresh_token
- AND tokens are set in httpOnly cookies
- AND response includes user profile (email, role)

#### Scenario: Invalid credentials

- GIVEN an incorrect password
- WHEN POST /auth/login with invalid credentials
- THEN response returns 401 Unauthorized
- AND no tokens are issued

### Requirement: Token Refresh

The system SHALL provide a POST /auth/refresh endpoint that issues new access token using valid refresh token.

#### Scenario: Successful refresh

- GIVEN a valid refresh token in httpOnly cookie
- WHEN POST /auth/refresh
- THEN new access_token is issued
- AND refresh_token remains valid

#### Scenario: Expired refresh token

- GIVEN an expired refresh token
- WHEN POST /auth/refresh
- THEN response returns 401 Unauthorized
- AND cookies are cleared

### Requirement: Protected Route Dependency

The system SHALL provide a FastAPI dependency that validates JWT tokens and rejects unauthorized requests.

#### Scenario: Access with valid token

- GIVEN a valid access token in Authorization header
- WHEN accessing a protected route
- THEN request proceeds with authenticated user context

#### Scenario: Access without token

- GIVEN no Authorization header
- WHEN accessing a protected route
- THEN response returns 401 Unauthorized

#### Scenario: Access with invalid token

- GIVEN an invalid or expired access token
- WHEN accessing a protected route
- THEN response returns 401 Unauthorized

### Requirement: Logout

The system SHALL provide a POST /auth/logout endpoint that clears tokens from cookies.

#### Scenario: Successful logout

- GIVEN an authenticated user
- WHEN POST /auth/logout
- THEN access and refresh cookies are cleared
- AND response returns 200 OK

### Requirement: Frontend Auth Context

The frontend SHALL maintain authentication state using React Context.

#### Scenario: Auth state management

- GIVEN user is not authenticated
- WHEN user logs in via LoginPage
- THEN AuthContext stores user profile and tokens
- AND ProtectedRoute components allow access to protected routes

#### Scenario: Auth state persistence

- GIVEN user is authenticated
- WHEN page is refreshed
- THEN AuthContext checks for valid token via /auth/me endpoint
- AND restores auth state if token valid

### Requirement: Login Page

The frontend SHALL provide a LoginPage component at /login route.

#### Scenario: Login form submission

- GIVEN user is on /login page
- WHEN user enters valid credentials and submits
- THEN LoginPage calls auth API
- AND on success redirects to /admin
- AND on failure shows error message

### Requirement: Protected Route Wrapper

The frontend SHALL provide a ProtectedRoute component that redirects unauthenticated users.

#### Scenario: Unauthenticated access

- GIVEN user is not authenticated
- WHEN user navigates to a protected route
- THEN ProtectedRoute redirects to /login

#### Scenario: Authenticated access

- GIVEN user is authenticated
- WHEN user navigates to a protected route
- THEN ProtectedRoute renders the protected component

### Requirement: Axios Interceptor

The frontend SHALL configure axios to automatically attach access token to requests.

#### Scenario: Token injection

- GIVEN user is authenticated with access token
- WHEN making API request
- THEN axios interceptor adds Authorization: Bearer <token> header

#### Scenario: Token refresh on 401

- GIVEN access token is expired
- WHEN API returns 401
- THEN axios interceptor attempts token refresh
- AND retries original request with new token

### Requirement: Navbar Auth Integration

The Navbar SHALL display authentication-aware navigation.

#### Scenario: Unauthenticated state

- GIVEN user is not authenticated
- WHEN Navbar renders
- THEN "Ingresar" button links to /login

#### Scenario: Authenticated state

- GIVEN user is authenticated
- WHEN Navbar renders
- THEN "Ingresar" button links to /admin

## Edge Cases

| Case | Behavior |
|------|----------|
| Missing env vars | Application fails to start with clear error message |
| Database connection failure | Seed process retries with exponential backoff |
| Concurrent login attempts | Rate limiting prevents brute force attacks |
| Token cookie tampering | JWT signature validation rejects invalid tokens |
| CORS with credentials | Must be configured for cookie-based auth |
