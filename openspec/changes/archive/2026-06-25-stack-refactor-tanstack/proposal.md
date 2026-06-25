# Proposal: Stack Refactor — TanStack Router + UI Polish

## Intent

Replace react-router-dom with @tanstack/react-router for type-safe routing, and add admin data tables + form validation. Router migration is a pure refactor (zero behavioral change). Tables and validation add new capabilities.

## Scope

### In Scope
- Migrate 4 existing routes (/, /reservar, /login, /admin) from react-router-dom v6 → @tanstack/react-router (code-based, no Vite plugin)
- Port App.tsx (layout), ProtectedRoute.tsx (auth guard), Login.tsx, Home.tsx to TanStack Router APIs
- Sortable/filterable admin data tables for clients, services, appointments
- Client-side form validation for booking and admin forms

### Out of Scope
- New pages beyond existing 4 routes
- File-based routing (unnecessary at this route count)
- Backend changes of any kind
- Component library or design system
- Mobile app / PWA routing
- SSR or streaming

## Capabilities

### New Capabilities
- `admin-data-tables`: Sortable, filterable data tables for admin management of clients, services, and appointments
- `form-validation`: Client-side validation utilities for required fields, patterns, and business rules

### Modified Capabilities
- None — routing is a pure implementation refactor (same routes, same behavior). Tables and validation are additive, not behavioral spec changes.

## Approach

**Phase 1 — Router migration** (pure refactor):
1. Install @tanstack/react-router, uninstall react-router-dom
2. Define code-based route tree in `src/routes/` (root, index, reservar, login, admin with auth guard)
3. Wire RouterProvider in main.tsx
4. Port App.tsx layout (Outlet → TanStack Outlet, Link → TanStack Link)
5. Port ProtectedRoute (Navigate → TanStack redirect)
6. Port Login.tsx (useNavigate, useSearchParams → TanStack equivalents)
7. Port Home.tsx (useNavigate → TanStack)
8. Validate no behavioral diffs — all routes load identically

**Phase 2 — Tables + validation** (new features):
1. Reusable DataTable component (column defs, sorting, text filter)
2. Admin views: clients table, services table, appointments table
3. Form validation hook with required, pattern, min/max rules
4. Integrate validation into booking form and admin client forms

## User Flow Impact

**Zero change** for routing — same URLs, same navigation, same auth guard behavior. Tables add click-to-sort and type-to-filter to existing admin views. Validation adds inline error messages below form fields — no change to submission flow.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auth redirect loop with new router | Medium | Test all auth states: unauthenticated, expired token, valid token |
| TanStack Router v1.x API instability | Low | Pin explicit version, verify build before porting |
| Table scope creep | Medium | Ship sort+filter only, defer row actions/virtual scroll |
| Flash messages lost on migration | Low | Verify useSearch → search param capture in tests |

## Rollback Plan

1. Revert frontend/package.json (restore react-router-dom deps)
2. Revert all ported files (main.tsx, App.tsx, ProtectedRoute.tsx, Login.tsx, Home.tsx)
3. Remove src/routes/ directory and new table/validation components
4. Run `tsc --noEmit` and manual route test on all 4 routes
5. Commit as single revert

## Dependencies

- @tanstack/react-router (pin ^1.x, verify React 18 compat)
- No new backend dependencies

## Success Criteria

- [ ] `tsc --noEmit` passes cleanly, zero type errors
- [ ] All 4 routes (/, /reservar, /login, /admin) render identically pre/post migration
- [ ] Auth redirect to /login?reason=* works on unauthenticated /admin access
- [ ] Admin tables render with sort/filter controls and correct data
- [ ] Booking form shows inline validation errors on invalid submit
