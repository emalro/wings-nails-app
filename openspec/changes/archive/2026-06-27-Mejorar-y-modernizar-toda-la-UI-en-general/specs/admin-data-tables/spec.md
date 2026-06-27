# Delta for Admin Data Tables

## MODIFIED Requirements

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
