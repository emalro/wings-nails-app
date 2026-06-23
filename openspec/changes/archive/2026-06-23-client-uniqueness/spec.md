# Delta for gestion-clientes

## ADDED Requirements

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

`POST /clients` searches by normalized phone first, then by DNI. On match: `200` with existing client. No match: create and `201`.

#### Scenario: New client created
- GIVEN no client with given phone or DNI
- WHEN `POST /clients`
- THEN `201` with new client record

#### Scenario: Phone match returns existing
- GIVEN a client with `telefono: "541112345678"`
- WHEN `POST /clients` with same phone, different DNI
- THEN `200` with existing client data (phone wins)

#### Scenario: DNI match when phone differs
- GIVEN a client with `dni: "12345678"`, phone `"541111111111"`
- WHEN `POST /clients` with same DNI, different phone `"542222222222"`
- THEN `200` with existing client data (DNI dedup)

#### Scenario: Phone match takes priority over DNI
- GIVEN client A: phone `"541111111111"`, DNI `"11111111"`
- GIVEN client B: phone `"542222222222"`, DNI `"22222222"`
- WHEN `POST /clients` with phone of A, DNI of B
- THEN `200` with client A (phone match wins, no duplicate)

### Requirement: REQ-CLI-005 — All Fields Required (MUST)

`ClienteCreate` requires `nombre`, `apellido`, `dni`, `telefono`. All non-empty strings. Missing fields return `422`.

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

#### Scenario: Missing telefono
- GIVEN payload without `telefono`
- WHEN `POST /clients`
- THEN `422` with `telefono` required error
