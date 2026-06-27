# Admin Data Tables

**Domain**: `admin-data-tables`
**Status**: Active

---

## Purpose

Sortable, filterable data tables for admin management of clients, services, and appointments within the admin panel. Overrides the current list-based views.

## Requirements

### TBL-001 — Reusable DataTable Component (MUST)

The admin panel MUST provide a reusable DataTable component accepting column definitions with sortable, filterable, and render callbacks.

#### Scenario: Sort column ascending/descending

- GIVEN a table with 5 services sorted by name
- WHEN user clicks "Precio" column header
- THEN rows reorder by price ascending
- AND header shows sort indicator
- WHEN user clicks "Precio" again
- THEN rows reorder by price descending

#### Scenario: Text filter narrows results

- GIVEN a clients table with 20 entries
- WHEN user types "Mar" in filter input
- THEN only clients matching "Mar" in name, phone, or DNI display

#### Scenario: Empty filter state

- GIVEN no items match the active filter
- THEN table shows "No se encontraron resultados" message

### TBL-002 — Appointments Table (MUST)

The admin panel MUST display appointments in a table sortable by date/time, client name, service, and status. MUST support filter by date range and filter by status dropdown.

#### Scenario: Filter by status

- GIVEN appointments with mixed statuses
- WHEN user selects "Confirmado" from status filter
- THEN only confirmed appointments display

#### Scenario: Sort by date

- GIVEN appointments table loaded
- WHEN user clicks "Fecha" header twice
- THEN appointments ordered oldest-first (descending after second click)

### TBL-003 — Clients Table (MUST)

The admin panel MUST display clients in a searchable table showing nombre, apellido, DNI, teléfono principal, and turnos pagados count.

#### Scenario: Search by name

- GIVEN clients "María García", "Martín López", "Ana Martínez"
- WHEN user types "Mar" in search
- THEN "María García" and "Ana Martínez" appear (matches first name start)

#### Scenario: Search by phone

- GIVEN client with teléfono "541112345678"
- WHEN user types "112345" in search
- THEN client appears in results

### TBL-004 — Services Table (MUST)

The admin panel MUST display services in a sortable table with columns: nombre, duración (min), precio ($).

#### Scenario: Sort by price

- GIVEN services at $2000, $3500, $5000
- WHEN user clicks "Precio" header
- THEN rows order $2000 → $3500 → $5000

### TBL-005 — Responsive Card Collapse (MUST)

On viewports below 768px, DataTable MUST render each row as a card showing key fields, with sort/filter controls still accessible. Cards MUST use Tailwind responsive utilities for layout. Sort and filter controls MUST stack vertically on mobile to prevent overlap.

(Previously: Responsive card collapse existed but relied on inline styles and lacked explicit stacking rules for controls.)

#### Scenario: Mobile card layout

- GIVEN viewport at 375px width
- WHEN admin views appointments table
- THEN each appointment renders as a card with client name, date, status, amount
- AND sort/filter controls remain accessible above cards
- AND controls stack vertically without overlap

#### Scenario: Mobile card layout — services table

- GIVEN viewport at 375px width
- WHEN admin views services table
- THEN each service renders as a card with name, duration, price
- AND cards have consistent spacing and readable text

#### Scenario: Desktop table unchanged

- GIVEN viewport at 1440px width
- WHEN admin views any data table
- THEN rows render in standard table format
- AND no card layout is applied

### TBL-006 — ScheduleSection Mobile Layout (MUST)

The ScheduleSection schedule grid/table MUST be horizontally scrollable on viewports below 768px, or alternatively switch to a stacked card layout. All time slot columns MUST remain accessible on mobile.

#### Scenario: Schedule grid scrolls on mobile

- GIVEN viewport at 375px width
- WHEN admin views the schedule section
- THEN the schedule grid is contained in a horizontal scroll container
- AND all day columns are accessible via horizontal scroll
- AND no content overflows the page boundary

#### Scenario: Schedule cards on mobile (alternative)

- GIVEN viewport at 375px width
- WHEN the schedule section renders in card mode
- THEN each day shows as a vertical card with its time slots
- AND navigation between days is accessible

### TBL-007 — ExceptionsSection Mobile Layout (MUST)

The ExceptionsSection form fields and list MUST stack vertically on viewports below 768px using Tailwind responsive classes. Form inputs MUST remain full-width and readable on mobile.

#### Scenario: Exceptions form stacks on mobile

- GIVEN viewport at 375px width
- WHEN admin views the exceptions section
- THEN form fields stack in a single vertical column
- AND each input is full-width and tappable
- AND labels are positioned above inputs

#### Scenario: Exceptions list on mobile

- GIVEN viewport at 375px width with existing exceptions
- WHEN admin views the exceptions list
- THEN each exception renders as a card with date, type, and actions
- AND cards stack vertically with clear spacing

## Edge Cases

| Case | Behavior |
|------|----------|
| Column value is null | Shows "—" dash placeholder |
| Rapid sort toggle | Debounce applied, maintains current page |
| Filter with 0 results | Shows "No se encontraron resultados" with clear-filter link |
| Client name truncation | Long names truncated with ellipsis, full name on title tooltip |
| Very long service list per row | Shows first 3 + "y N más" badge |
| Mobile sort/filter overlap | Controls stack vertically on narrow screens |
