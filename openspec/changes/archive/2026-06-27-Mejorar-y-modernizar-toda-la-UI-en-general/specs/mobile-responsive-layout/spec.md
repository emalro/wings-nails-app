# Mobile Responsive Layout Specification

**Domain**: `mobile-responsive-layout`
**Status**: New
**Change**: `Mejorar-y-modernizar-toda-la-UI-en-general`

---

## Purpose

Tailwind CSS mobile-first CSS architecture providing responsive layout across all pages, hamburger drawer navigation for mobile, responsive grid systems, and skeleton loader functionality.

## Requirements

### MRL-001 — Tailwind Configuration (MUST)

The project MUST install and configure Tailwind CSS with Vite. Design tokens (colors, shadows, radii, typography) MUST be migrated to `tailwind.config.js` `theme.extend`. The `styles.css` monolith MUST be eliminated or reduced to minimal `@layer` components.

#### Scenario: Tailwind utility classes compile

- GIVEN Tailwind is installed with PostCSS and Autoprefixer
- WHEN a component uses `<div className="flex p-4">`
- THEN the element renders with correct flex and padding
- AND no phantom class warnings appear in console

#### Scenario: Design tokens accessible via Tailwind

- GIVEN project colors defined in `tailwind.config.js` theme.extend
- WHEN a component uses `<div className="bg-brand-primary">`
- THEN the element renders with the project's primary brand color

#### Scenario: Legacy styles.css eliminated

- GIVEN all classes from `styles.css` have been migrated
- WHEN the build completes
- THEN no unused CSS variables remain in a standalone `styles.css`
- AND all styles load via Tailwind directives in `index.css`

### MRL-002 — Mobile Hamburger Navigation (MUST)

The navbar MUST display a hamburger button on viewports below 768px. The hamburger MUST toggle a slide-in drawer containing all navigation links. The drawer MUST close on link click, overlay tap, or Escape key. The hamburger MUST have an accessible `aria-label`.

#### Scenario: Hamburger visible on mobile

- GIVEN viewport at 375px width
- WHEN the page loads
- THEN a hamburger icon is visible in the navbar
- AND desktop nav links are hidden

#### Scenario: Drawer opens and closes

- GIVEN viewport at 375px and hamburger visible
- WHEN user taps the hamburger
- THEN a drawer slides in from the left/right with all nav links
- WHEN user taps a link OR the overlay OR presses Escape
- THEN the drawer closes

#### Scenario: Desktop nav unchanged

- GIVEN viewport at 1440px width
- WHEN the page loads
- THEN all nav links display inline in the navbar
- AND no hamburger icon is visible

### MRL-003 — Responsive Grid Layout (MUST)

All page layouts MUST use Tailwind responsive grid/flex utilities. No `style={{ gridTemplateColumns }}` or similar inline responsive layout props SHALL remain. Grids MUST stack to single column on mobile (<768px) and expand to multi-column on desktop (≥1024px).

#### Scenario: Page layout at 375px

- GIVEN any page with a multi-column grid layout
- WHEN viewport is 375px
- THEN all content stacks in a single column
- AND no horizontal overflow occurs
- AND all elements are visible without clipping

#### Scenario: Page layout at 1440px

- GIVEN any page with a multi-column grid layout
- WHEN viewport is 1440px
- THEN columns display at their intended desktop width
- AND layout matches the pre-migration desktop appearance

### MRL-004 — SkeletonLoader Fix (MUST)

The SkeletonLoader component MUST render visible loading skeletons. Existing phantom Tailwind classes (`animate-pulse`, `bg-gray-200`) MUST produce correct visual output once Tailwind is installed.

#### Scenario: Skeleton visible during loading

- GIVEN data is being fetched
- WHEN SkeletonLoader renders
- THEN animated pulsing placeholder blocks appear
- AND blocks match the shape of the content they replace

### MRL-005 — Inline Style Elimination (MUST)

All responsive-critical `style={}` props controlling layout, width, height, or grid structure MUST be replaced with Tailwind className. Dynamic color inline styles MAY remain where values are computed at runtime.

#### Scenario: No inline responsive styles remain

- GIVEN a codebase audit of all `.tsx` files
- WHEN searching for `style={{` patterns with `width`, `height`, `display`, `grid`, `flex`
- THEN zero matches exist for responsive layout control
- AND dynamic color `style={{ color: variable }}` patterns still function
