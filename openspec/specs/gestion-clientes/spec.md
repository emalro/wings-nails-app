# Spec: Gestión de Clientes

## Requirements

### Requirement: REQ-CLI-001 — DNI Field (MUST)

`Cliente` model has required `dni: str` with UNIQUE constraint. Schemas `ClienteCreate` and `ClienteRead` include `dni` as required.

#### Scenario: Valid DNI accepted
- GIVEN `ClienteCreate` with `dni: "12345678"`
- WHEN `POST /clients`
- THEN `201` with response body containing `dni: "12345678"`

#### Scenario: Duplicate DNI returns existing client
- GIVEN a client exists with `dni: "12345678"` and phone `"541112345678"`
- WHEN `POST /clients` with same `dni` and same phone
- THEN `200` with existing client data (find-or-create by phone or DNI)

#### Scenario: Missing DNI
- GIVEN `ClienteCreate` without `dni`
- WHEN `POST /clients`
- THEN `422` with `dni` required error

### Requirement: REQ-CLI-002 — Phone Validation (MUST)

`ClienteCreate` validates Argentine phone format. Acceptable: `+54`, `11`/`15` prefixes, spaces, dashes, parentheses. Rejected: letters, special characters, fewer than 7 digits.

#### Scenario: Valid Argentine phone
- GIVEN `telefono: "+54 11 1234-5678"`
- WHEN `POST /clients`
- THEN `201` (validation passes)

#### Scenario: Letters in phone rejected
- GIVEN `telefono: "11-ABCD-5678"`
- WHEN `POST /clients`
- THEN `422` with invalid phone error

#### Scenario: Fewer than 7 digits rejected
- GIVEN `telefono: "123-456"` (6 digits)
- WHEN `POST /clients`
- THEN `422` with invalid phone error

### Requirement: REQ-CLI-003 — Phone Normalization (MUST)

Phone numbers normalize to digits-only before storage and before search queries.

#### Scenario: Storage normalization
- GIVEN `telefono: "+54 11 1234-5678"`
- WHEN `POST /clients`
- THEN stored value is `"541112345678"` (digits only)

#### Scenario: Search normalization
- GIVEN a client with stored `telefono: "541112345678"`
- WHEN `POST /clients` with `telefono: "+54 11 1234-5678"`
- THEN `200` with existing client (normalized phone matches)

### Requirement: REQ-CLI-004 — Find-or-Create by Phone (MUST)

`POST /clients` searches by normalized phone across `ClienteTelefono` first, then by DNI. On match: `200` with existing client. No match: create and `201`.

#### Scenario: Phone match via ClienteTelefono
- GIVEN a client with `ClienteTelefono: "541112345678"`
- WHEN `POST /clients` with same phone, different DNI
- THEN `200` with existing client (phone wins)

#### Scenario: DNI match when phone is new
- GIVEN a client with DNI `"12345678"`, phone `"541111111111"`
- WHEN `POST /clients` with same DNI, different phone `"542222222222"`
- THEN `200` with existing client

#### Scenario: New client created
- GIVEN no client with given phone or DNI
- WHEN `POST /clients`
- THEN `201` with new client record

#### Scenario: Phone match takes priority over DNI
- GIVEN client A: phone `"541111111111"`, DNI `"11111111"` in `ClienteTelefono`
- GIVEN client B: phone `"542222222222"`, DNI `"22222222"`
- WHEN `POST /clients` with phone of A, DNI of B
- THEN `200` with client A (phone match wins, no duplicate)

### Requirement: REQ-CLI-005 — All Fields Required (MUST)

`ClienteCreate` requires `nombre`, `apellido`, `dni`, `telefono`. `telefono` is stored in `ClienteTelefono`. Missing fields return `422`.

#### Scenario: Missing nombre
- GIVEN payload without `nombre`
- WHEN `POST /clients`
- THEN `422` with `nombre` required error

#### Scenario: Missing apellido
- GIVEN payload without `apellido`
- WHEN `POST /clients`
- THEN `422` with `apellido` required error

#### Scenario: Missing dni
- GIVEN payload without `dni`
- WHEN `POST /clients`
- THEN `422` with `dni` required error

#### Scenario: Missing telefono on creation
- GIVEN payload without `telefono`
- WHEN `POST /clients`
- THEN `422` with `telefono` required error

#### Scenario: New client creates ClienteTelefono row
- GIVEN valid payload with `telefono: "+54 11 1234-5678"`
- WHEN `POST /clients`
- THEN `201` and `ClienteTelefono` contains normalized `"541112345678"` with `es_principal=true`

### Requirement: REQ-CLI-006 — ClienteTelefono table (MUST)

Model `ClienteTelefono` with `id`, `id_cliente` (FK → Cliente), `telefono` (digits-only), `etiqueta` (optional free text), `es_principal` (bool). Exactly one phone per client MAY have `es_principal=true`. Migration MUST copy `Cliente.telefono` → `ClienteTelefono` with `es_principal=true`, then drop `telefono` from `Cliente`. `Cliente` gains `activo: bool = True`. Endpoints: `GET/PATCH/DELETE /clients/{id}`, `POST /clients/{id}/phones`, `DELETE /clients/{id}/phones/{phone_id}`, `PATCH /clients/{id}/phones/{phone_id}`.

#### Scenario: Get client with phones
- GIVEN a client with 2 phones in `ClienteTelefono`
- WHEN `GET /clients/{id}`
- THEN `200` with `telefonos: [{telefono, etiqueta, es_principal}, ...]`

#### Scenario: Add phone
- GIVEN a client exists
- WHEN `POST /clients/{id}/phones` with `{telefono: "+54 11 1234-5678"}`
- THEN `201` with phone normalized to `"541112345678"`

#### Scenario: Remove non-principal phone
- GIVEN a client with a non-principal phone
- WHEN `DELETE /clients/{id}/phones/{phone_id}`
- THEN `204`

#### Scenario: Update phone label and principal
- GIVEN phone A (`es_principal=true`) and phone B (`es_principal=false`)
- WHEN `PATCH /clients/{id}/phones/{B_id}` with `{es_principal: true, etiqueta: "Trabajo"}`
- THEN B becomes `es_principal=true`, A becomes `es_principal=false`

#### Scenario: Soft-delete sets activo=false
- GIVEN an active client
- WHEN `DELETE /clients/{id}`
- THEN `204` and `Cliente.activo=false`

#### Scenario: Reactivate sets activo=true
- GIVEN an inactive client
- WHEN `PATCH /clients/{id}/reactivate`
- THEN `200` with `activo: true`

### Requirement: REQ-CLI-007 — Search across multi-phone (MUST)

`GET /clients/search?q=` MUST match `Cliente.nombre`, `apellido`, `dni`, AND `ClienteTelefono.telefono`. `POST /clients` find-or-create MUST check DNI AND all `ClienteTelefono` numbers for duplicates before creating.

#### Scenario: Search by phone fragment
- GIVEN a client with phone `"541112345678"` in `ClienteTelefono`
- WHEN `GET /clients/search?q=112345678`
- THEN client appears in results

#### Scenario: Find-or-create by phone in ClienteTelefono
- GIVEN a client exists with `ClienteTelefono: "541112345678"`, DNI `"11111111"`
- WHEN `POST /clients` with same phone `"+54 11 1234-5678"`, DNI `"22222222"`
- THEN `200` with existing client (phone match wins)

### Requirement: REQ-CLI-008 — Admin client management UI (MUST)

Admin MUST have a "Clientas" section with: searchable list (nombre, apellido, DNI, primary phone, total/appointments paid count), detail view (all fields, phones with labels, appointment history), edit form for `nombre`/`apellido`/`dni`, inline phone add/remove/edit label and principal flag, soft-delete with confirmation, reactivation toggle, and "show inactive" checkbox.

#### Scenario: View and search clients
- GIVEN admin is on "Clientas" tab
- WHEN typing a search query
- THEN matching clients display with key info

#### Scenario: Edit client fields
- GIVEN a client detail view
- WHEN updating nombre and apellido
- THEN `PATCH /clients/{id}` returns `200` with updated data

#### Scenario: Appointment history visible
- GIVEN a client with past and future appointments
- WHEN viewing client detail
- THEN all appointments appear ordered by date (most recent first)

### Requirement: REQ-CLI-009 — Soft delete with rollback (MUST)

Inactive clients excluded from default search results. "Mostrar inactivos" toggle includes them. Appointments linked to inactive clients remain intact; client name visible in past appointments.

#### Scenario: Toggle shows inactive clients
- GIVEN an inactive client
- WHEN "Mostrar inactivos" is checked
- THEN client appears in search results

#### Scenario: Past appointments preserve client name
- GIVEN an inactive client with past appointments
- WHEN querying appointments
- THEN `cliente_nombre` still shows the client's name

### Requirement: REQ-CLI-010 — Phone label (SHOULD)

`etiqueta` is free text, optional, no validation beyond max length (100). Labels are NOT searchable — only the phone number is searchable.

#### Scenario: Label is optional
- GIVEN `POST /clients/{id}/phones` with `{telefono: "...", etiqueta: "Casa"}`
- THEN `201` and label stored
- GIVEN same without `etiqueta`
- THEN `201` and `etiqueta` is null
