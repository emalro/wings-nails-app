import os
import sys
from datetime import datetime, timedelta

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-jwt-32-chars-long!"
os.environ["LOGIN_RATE_LIMIT"] = "100/minute"
if os.path.exists("test.db"):
    os.remove("test.db")

from fastapi.testclient import TestClient
from app.main import app, seed_default_schedule
from app.database import create_db_and_tables, engine
from sqlmodel import Session

# Ensure DB tables exist for tests
create_db_and_tables()
# Seed default schedule so tests have 7 records
with Session(engine) as session:
    seed_default_schedule(session)

client = TestClient(app)

# ── Auth setup for protected endpoints ─────────────────────────────────
# Create a real user and login so the TestClient has auth cookies
from app.auth import get_password_hash
from app.models import Usuario
with Session(engine) as session:
    hashed = get_password_hash("testpass123")
    user = Usuario(
        email="test-auth@test.com",
        hashed_password=hashed,
        role="admin",
        is_active=True,
    )
    session.add(user)
    session.commit()

login_resp = client.post("/auth/login", json={"email": "test-auth@test.com", "password": "testpass123"})
assert login_resp.status_code == 200, f"Auth setup failed: {login_resp.status_code} {login_resp.text}"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_and_list_client():
    payload = {"nombre": "Ana", "apellido": "Lopez", "dni": _unique_dni(), "telefono": "123456789"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Ana"

    r2 = client.get("/clients")
    assert r2.status_code == 200
    assert any(c["nombre"] == "Ana" for c in r2.json())


_test_counter: int = 0
_BASE_TEST_DATE = datetime(2026, 7, 1, 10, 0, 0)


def _unique_date_offset():
    """Return a unique (days, minutes) offset for data isolation."""
    global _test_counter
    _test_counter += 1
    # Each test gets its own day to avoid any cross-test overlap
    days = _test_counter - 1
    minutes = 0
    return days, minutes


def _unique_dni() -> str:
    """Return a unique DNI string for data isolation across tests."""
    global _test_counter
    _test_counter += 1
    return f"{_test_counter:08d}"


def _unique_phone() -> str:
    """Return a unique phone string for data isolation across tests."""
    global _test_counter
    _test_counter += 1
    return f"54{_test_counter:010d}"


def _create_test_client_and_appointment():
    """Helper to create a test client + service + appointment and return relevant IDs.
    Uses a unique date per call to avoid data collision across tests."""
    days_offset, minutes_offset = _unique_date_offset()

    client_payload = {"nombre": "Lucia", "apellido": "Perez", "dni": _unique_dni(), "telefono": _unique_phone()}
    client_resp = client.post("/clients", json=client_payload)
    assert client_resp.status_code == 201
    client_id = client_resp.json()["id"]

    service_payload = {
        "nombre_servicio": "Manicura",
        "duracion_minutos": 60,
        "precio_actual": 2500.0,
        "monto_sena_actual": 500.0,
        "descripcion": "Manicura Spa",
        "activo": True,
    }
    service_resp = client.post("/services", json=service_payload)
    assert service_resp.status_code == 200
    service_id = service_resp.json()["id"]

    appointment_time = _BASE_TEST_DATE + timedelta(days=days_offset, minutes=minutes_offset)
    appointment_payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": appointment_time.isoformat(),
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "servicios": [
            {
                "servicio_id": service_id,
                "duracion_minutos": 60,
                "precio_unitario": 2500.0,
                "subtotal": 2500.0,
            }
        ]
    }
    appt_resp = client.post("/appointments", json=appointment_payload)
    assert appt_resp.status_code == 200
    appointment_id = appt_resp.json()["id"]
    return client_id, service_id, appointment_id


# ---- STRICT TDD: tests for extended PATCH endpoint ----


def test_patch_negative_monto_rejected():
    """RED 1: PATCH with negative monto_recibido_en_caja should return 422."""
    _, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"estado_cita": "Asistido", "monto_recibido_en_caja": -100.0},
    )
    assert resp.status_code == 422


def test_patch_no_monto_backward_compat():
    """RED 2: PATCH without monto should still work (backward compat)."""
    _, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"estado_cita": "Asistido"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado_cita"] == "Asistido"


def test_patch_asistido_increments_abonados():
    """RED 3: PATCH to Asistido with monto should increment cantidad_turnos_abonados."""
    client_id, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"estado_cita": "Asistido", "monto_recibido_en_caja": 2500.0},
    )
    assert resp.status_code == 200

    # Check that the client's counter was incremented
    client_resp = client.get("/clients")
    assert client_resp.status_code == 200
    clients = client_resp.json()
    target = next(c for c in clients if c["id"] == client_id)
    assert target["cantidad_turnos_abonados"] == 1


def test_patch_asistido_no_client():
    """RED 4: PATCH to Asistido with non-existent client should not crash."""
    _, _, appointment_id = _create_test_client_and_appointment()

    # Manually delete the client to simulate orphan appointment
    from app.database import engine
    from app.models import Cliente
    from sqlmodel import Session
    with Session(engine) as session:
        # Find the client linked to this appointment
        from app.models import Cita
        cita = session.get(Cita, appointment_id)
        if cita:
            cliente = session.get(Cliente, cita.id_cliente)
            if cliente:
                session.delete(cliente)
                session.commit()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"estado_cita": "Asistido", "monto_recibido_en_caja": 2500.0},
    )
    assert resp.status_code == 200


def test_patch_cancelado_no_monto():
    """RED 5: PATCH to Cancelado_Cliente without monto should work (backward compat)."""
    _, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"estado_cita": "Cancelado_Cliente"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado_cita"] == "Cancelado_Cliente"


def test_patch_update_datetime():
    """EDIT-1: PATCH with fecha_hora_cita updates the appointment time."""
    _, _, appointment_id = _create_test_client_and_appointment()
    new_time = "2026-07-15T15:00:00"

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"fecha_hora_cita": new_time},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "2026-07-15T15:00" in data["fecha_hora_cita"]


def test_patch_conflicting_datetime_returns_409():
    """EDIT-2: PATCH with fecha_hora_cita that conflicts returns 409."""
    # Create two appointments
    _, _, appt1_id = _create_test_client_and_appointment()
    _, _, appt2_id = _create_test_client_and_appointment()

    # Get appt1's time and try to set appt2 to same time
    r = client.get("/appointments")
    appt1 = next(a for a in r.json() if a["id"] == appt1_id)
    conflict_time = appt1["fecha_hora_cita"]

    resp = client.patch(
        f"/appointments/{appt2_id}",
        json={"fecha_hora_cita": conflict_time},
    )
    assert resp.status_code == 409


def test_patch_update_servicios():
    """EDIT-3: PATCH with servicios updates the services list."""
    _, service_id, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"servicios": [
            {"servicio_id": service_id, "duracion_minutos": 90, "precio_unitario": 3000.0, "subtotal": 3000.0},
        ]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["servicios"]) == 1
    assert data["servicios"][0]["duracion_minutos"] == 90
    assert data["duracion_total_minutos"] == 90


def test_patch_verificado_manual():
    """EDIT-4: PATCH with comprobante_verificado_manual sets the flag."""
    _, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"comprobante_verificado_manual": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["comprobante_verificado_manual"] is True


def test_patch_update_precios():
    """EDIT-5: PATCH updates precio_historico_cobrado and sena_historica_pagada."""
    _, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={"precio_historico_cobrado": 3000.0, "sena_historica_pagada": 1000.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["precio_historico_cobrado"] == 3000.0
    assert data["sena_historica_pagada"] == 1000.0


def test_patch_update_multiple_fields():
    """EDIT-6: PATCH with multiple fields at once."""
    _, _, appointment_id = _create_test_client_and_appointment()

    resp = client.patch(
        f"/appointments/{appointment_id}",
        json={
            "metodo_pago_sena": "Efectivo",
            "precio_historico_cobrado": 3500.0,
            "comprobante_verificado_manual": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["metodo_pago_sena"] == "Efectivo"
    assert data["precio_historico_cobrado"] == 3500.0
    assert data["comprobante_verificado_manual"] is True


# ---- STRICT TDD: schedule endpoint tests (RED phase) ----
# Tests written BEFORE implementing HorarioSemanal / ExcepcionHorario


def test_get_weekly_schedule_returns_7_records():
    """HOR-001: GET /schedule/weekly returns 7 records after seed."""
    r = client.get("/schedule/weekly")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 7
    for day in data:
        assert "dia_semana" in day
        assert "activo" in day
        assert "hora_apertura" in day
        assert "hora_cierre" in day


def test_put_weekly_schedule_updates_records():
    """HOR-001/008: PUT /schedule/weekly updates and validates."""
    schedule = [
        {"dia_semana": i, "activo": True, "hora_apertura": "09:00", "hora_cierre": "18:00"}
        for i in range(7)
    ]
    schedule[0]["hora_apertura"] = "10:00"
    schedule[0]["hora_cierre"] = "16:00"
    r = client.put("/schedule/weekly", json=schedule)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 7
    domingo = next(d for d in data if d["dia_semana"] == 0)
    assert domingo["hora_apertura"] == "10:00"
    assert domingo["hora_cierre"] == "16:00"
    assert domingo["activo"] is True


def test_put_weekly_schedule_rejects_bad_hours():
    """HOR-008: apertura >= cierre returns 422."""
    schedule = [
        {"dia_semana": i, "activo": True, "hora_apertura": "18:00", "hora_cierre": "09:00"}
        for i in range(7)
    ]
    r = client.put("/schedule/weekly", json=schedule)
    assert r.status_code == 422


def test_create_and_list_exception():
    """HOR-002/003: POST /schedule/exceptions creates exception, GET lists it."""
    exception_payload = {
        "fecha": "2026-12-25",
        "cerrado": False,
        "hora_apertura": "10:00",
        "hora_cierre": "15:00",
    }
    r = client.post("/schedule/exceptions", json=exception_payload)
    assert r.status_code == 200
    data = r.json()
    assert data["fecha"] == "2026-12-25"
    assert data["cerrado"] is False

    # GET lists exceptions
    r2 = client.get("/schedule/exceptions")
    assert r2.status_code == 200
    exceptions = r2.json()
    assert len(exceptions) >= 1
    assert any(e["fecha"] == "2026-12-25" for e in exceptions)


def test_create_duplicate_exception_returns_409():
    """HOR-009: POST /schedule/exceptions with same fecha returns 409."""
    payload = {
        "fecha": "2026-12-31",
        "cerrado": True,
    }
    r1 = client.post("/schedule/exceptions", json=payload)
    assert r1.status_code == 200

    r2 = client.post("/schedule/exceptions", json=payload)
    assert r2.status_code == 409


def test_delete_exception():
    """DELETE /schedule/exceptions/{id} removes exception."""
    payload = {
        "fecha": "2026-11-15",
        "cerrado": True,
    }
    r = client.post("/schedule/exceptions", json=payload)
    assert r.status_code == 200
    exc_id = r.json()["id"]

    r2 = client.delete(f"/schedule/exceptions/{exc_id}")
    assert r2.status_code == 200
    assert r2.json() == {"ok": True}

    # Verify deleted
    r3 = client.get("/schedule/exceptions")
    assert all(e["id"] != exc_id for e in r3.json())


def test_delete_nonexistent_exception_returns_404():
    """DELETE /schedule/exceptions with invalid id returns 404."""
    r = client.delete("/schedule/exceptions/99999")
    assert r.status_code == 404


def test_effective_hours_uses_weekly_when_no_exception():
    """HOR-001/004: GET /schedule/effective uses weekly when no exception."""
    # Set up Monday active 09:00-18:00
    schedule = [
        {"dia_semana": i, "activo": True, "hora_apertura": "09:00", "hora_cierre": "18:00"}
        for i in range(7)
    ]
    client.put("/schedule/weekly", json=schedule)

    # 2026-06-22 is Monday
    r = client.get("/schedule/effective", params={"date": "2026-06-22"})
    assert r.status_code == 200
    data = r.json()
    assert data["abierto"] is True
    assert data["hora_apertura"] == "09:00"
    assert data["hora_cierre"] == "18:00"


def test_effective_hours_closed_when_day_inactive():
    """HOR-004: Sunday inactive returns closed."""
    schedule = [
        {"dia_semana": i, "activo": i != 0, "hora_apertura": "09:00", "hora_cierre": "18:00"}
        for i in range(7)
    ]
    client.put("/schedule/weekly", json=schedule)

    # 2026-06-21 is Sunday (dia_semana=0)
    r = client.get("/schedule/effective", params={"date": "2026-06-21"})
    assert r.status_code == 200
    data = r.json()
    assert data["abierto"] is False


def test_effective_hours_with_closed_exception():
    """HOR-003: Exception with cerrado=true overrides weekly."""
    client.post("/schedule/exceptions", json={
        "fecha": "2026-06-22",
        "cerrado": True,
    })
    r = client.get("/schedule/effective", params={"date": "2026-06-22"})
    assert r.status_code == 200
    data = r.json()
    assert data["abierto"] is False


def test_effective_hours_with_open_exception():
    """HOR-002: Exception with custom hours overrides weekly."""
    # First delete any existing exception for this date
    existing = client.get("/schedule/exceptions").json()
    for exc in existing:
        if exc["fecha"] == "2026-06-23":
            client.delete(f"/schedule/exceptions/{exc['id']}")

    client.post("/schedule/exceptions", json={
        "fecha": "2026-06-23",
        "cerrado": False,
        "hora_apertura": "10:00",
        "hora_cierre": "15:00",
    })
    r = client.get("/schedule/effective", params={"date": "2026-06-23"})
    assert r.status_code == 200
    data = r.json()
    assert data["abierto"] is True
    assert data["hora_apertura"] == "10:00"
    assert data["hora_cierre"] == "15:00"


def test_effective_hours_invalid_date_returns_400():
    """HOR-007: Invalid date format returns 400."""
    r = client.get("/schedule/effective", params={"date": "2026-99-99"})
    assert r.status_code == 400


def test_create_exception_with_invalid_hours_returns_422():
    """POST /schedule/exceptions with apertura >= cierre returns 422."""
    r = client.post("/schedule/exceptions", json={
        "fecha": "2026-10-10",
        "cerrado": False,
        "hora_apertura": "18:00",
        "hora_cierre": "09:00",
    })
    assert r.status_code == 422


def test_create_exception_requires_hours_when_not_cerrado():
    """POST /schedule/exceptions with cerrado=false but missing hours returns 422."""
    r = client.post("/schedule/exceptions", json={
        "fecha": "2026-10-11",
        "cerrado": False,
    })
    assert r.status_code == 422


# ---- CLIENT UNIQUENESS: tests for find-or-create (REQ-CLI-004) ----


def test_create_new_client_returns_201():
    """REQ-CLI-004: New client creation returns 201."""
    payload = {"nombre": "Nueva", "apellido": "Cliente", "dni": "90000001", "telefono": "540000000001"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Nueva"
    assert data["dni"] == "90000001"


def test_find_or_create_phone_match_returns_200():
    """REQ-CLI-004: Phone match returns existing client with 200."""
    # Use unique values to avoid cross-test collisions
    shared_phone = _unique_phone()
    dni1 = _unique_dni()
    dni2 = _unique_dni()

    # Create first client
    payload1 = {"nombre": "Ana", "apellido": "Phone", "dni": dni1, "telefono": shared_phone}
    r1 = client.post("/clients", json=payload1)
    assert r1.status_code == 201
    client1_id = r1.json()["id"]

    # Same phone, different DNI → should return existing (phone wins)
    payload2 = {"nombre": "Ana", "apellido": "Phone", "dni": dni2, "telefono": shared_phone}
    r2 = client.post("/clients", json=payload2)
    assert r2.status_code == 200
    assert r2.json()["id"] == client1_id


def test_find_or_create_dni_match_returns_200():
    """REQ-CLI-004: DNI match (different phone) returns existing client with 200."""
    shared_dni = _unique_dni()
    phone1 = _unique_phone()
    phone2 = _unique_phone()

    # Create first client
    payload1 = {"nombre": "Beto", "apellido": "Dni", "dni": shared_dni, "telefono": phone1}
    r1 = client.post("/clients", json=payload1)
    assert r1.status_code == 201
    client1_id = r1.json()["id"]

    # Same DNI, different phone → DNI match returns existing
    payload2 = {"nombre": "Beto", "apellido": "Dni", "dni": shared_dni, "telefono": phone2}
    r2 = client.post("/clients", json=payload2)
    assert r2.status_code == 200
    assert r2.json()["id"] == client1_id


def test_find_or_create_dni_priority_over_phone():
    """DNI match takes priority over phone match."""
    phone_a = _unique_phone()
    phone_b = _unique_phone()
    dni_a = _unique_dni()
    dni_b = _unique_dni()

    # Client A
    payload_a = {"nombre": "Alice", "apellido": "A", "dni": dni_a, "telefono": phone_a}
    r_a = client.post("/clients", json=payload_a)
    assert r_a.status_code == 201
    client_b_id = None

    # Client B
    payload_b = {"nombre": "Bob", "apellido": "B", "dni": dni_b, "telefono": phone_b}
    r_b = client.post("/clients", json=payload_b)
    assert r_b.status_code == 201
    client_b_id = r_b.json()["id"]

    # Incoming: phone of A + DNI of B → should return B (DNI wins)
    payload_incoming = {"nombre": "Intruder", "apellido": "X", "dni": dni_b, "telefono": phone_a}
    r_in = client.post("/clients", json=payload_incoming)
    assert r_in.status_code == 200
    assert r_in.json()["id"] == client_b_id


# ---- CLIENT UNIQUENESS: tests for required fields (REQ-CLI-001, REQ-CLI-005) ----


def test_create_client_missing_dni_returns_422():
    """REQ-CLI-001: Missing dni returns 422."""
    payload = {"nombre": "No", "apellido": "Dni", "telefono": "541111111111"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 422


def test_create_client_missing_nombre_returns_422():
    """REQ-CLI-005: Missing nombre returns 422."""
    payload = {"apellido": "NoName", "dni": "91000001", "telefono": "541111111111"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 422


def test_create_client_missing_apellido_returns_422():
    """REQ-CLI-005: Missing apellido returns 422."""
    payload = {"nombre": "NoApellido", "dni": "91000002", "telefono": "541111111111"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 422


def test_create_client_missing_telefono_returns_422():
    """REQ-CLI-005: Missing telefono returns 422."""
    payload = {"nombre": "NoTel", "apellido": "NoTel", "dni": "91000003"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 422


# ---- CLIENT UNIQUENESS: tests for phone validation (REQ-CLI-002, REQ-CLI-003) ----


def test_create_client_with_invalid_phone_returns_422():
    """REQ-CLI-002: Letters in phone rejected with 422."""
    payload = {"nombre": "Val", "apellido": "Test", "dni": "12345678", "telefono": "11-ABCD-5678"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 422


def test_create_client_short_phone_returns_422():
    """REQ-CLI-002: Fewer than 7 digits rejected with 422."""
    payload = {"nombre": "Val", "apellido": "Test", "dni": "12345678", "telefono": "123-456"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 422


def test_create_client_normalizes_phone():
    """REQ-CLI-003: Phone normalizes to digits-only before storage."""
    payload = {"nombre": "Val", "apellido": "Test", "dni": "87654321", "telefono": "+54 11 1234-5678"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert len(data["telefonos"]) == 1
    assert data["telefonos"][0]["telefono"] == "541112345678"
    assert data["telefonos"][0]["es_principal"] is True


def test_find_or_create_normalized_search():
    """REQ-CLI-003: Search normalization — formatted phone finds stored normalized phone."""
    raw_phone = _unique_phone()
    formatted = f"{raw_phone[:4]}-{raw_phone[4:8]} {raw_phone[8:]}"
    dni = _unique_dni()

    # Create with clean phone
    payload_create = {"nombre": "Busca", "apellido": "Normalizado", "dni": dni, "telefono": raw_phone}
    r_create = client.post("/clients", json=payload_create)
    assert r_create.status_code == 201
    client_id = r_create.json()["id"]

    # Search with formatted version of same phone (spaces/dashes/punctuation removed by normalize_phone)
    payload_search = {"nombre": "Otro", "apellido": "Nombre", "dni": _unique_dni(), "telefono": formatted}
    r_search = client.post("/clients", json=payload_search)
    assert r_search.status_code == 200
    assert r_search.json()["id"] == client_id


# ---- SEARCH: tests for client search endpoint (T3.1) ----


def test_search_clients_by_nombre():
    """CMC-001: Search by partial nombre returns matching clients."""
    # Create a client with a distinct name
    payload = {"nombre": "Maria", "apellido": "Garcia", "dni": _unique_dni(), "telefono": "3415550101"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201
    client_id = r.json()["id"]

    # Search by "mar"
    r = client.get("/clients/search", params={"q": "mar"})
    assert r.status_code == 200
    data = r.json()
    assert any(c["nombre"] == "Maria" for c in data)
    assert len(data) <= 10


def test_search_clients_by_telefono():
    """CMC-001: Search by partial telefono returns matching clients."""
    phone = _unique_phone()
    payload = {"nombre": "Lucia", "apellido": "Perez", "dni": _unique_dni(), "telefono": phone}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201

    # Search by phone suffix (unique portion)
    r = client.get("/clients/search", params={"q": phone[-8:]})
    assert r.status_code == 200
    data = r.json()
    assert any(phone in [p["telefono"] for p in c["telefonos"]] for c in data)


def test_search_clients_no_results():
    """CMC-001: Search with non-matching query returns empty list."""
    r = client.get("/clients/search", params={"q": "xyz"})
    assert r.status_code == 200
    assert r.json() == []


def test_search_clients_short_query():
    """CMC-001: Search with < 2 chars returns empty list."""
    r = client.get("/clients/search", params={"q": "a"})
    assert r.status_code == 200
    assert r.json() == []


def test_search_clients_partial_apellido():
    """CMC-001: Search by partial apellido returns matching clients."""
    payload = {"nombre": "Ana", "apellido": "Rodriguez", "dni": _unique_dni(), "telefono": "3416660202"}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201

    r = client.get("/clients/search", params={"q": "rodr"})
    assert r.status_code == 200
    data = r.json()
    assert any(c["apellido"] == "Rodriguez" for c in data)


# ---- MANUAL CREATION: tests for estado_cita in create appointment (T3.2) ----


def test_create_appointment_with_confirmado():
    """CMC-002: POST with estado_cita: Confirmado creates confirmed appointment."""
    # Use helper that creates client + service
    client_id, service_id, _ = _new_test_client_service()

    appointment_time = _BASE_TEST_DATE + timedelta(days=200, minutes=0)
    payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": appointment_time.isoformat(),
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "estado_cita": "Confirmado",
        "servicios": [
            {
                "servicio_id": service_id,
                "duracion_minutos": 60,
                "precio_unitario": 2500.0,
                "subtotal": 2500.0,
            }
        ]
    }
    r = client.post("/appointments", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["estado_cita"] == "Confirmado"


def test_create_appointment_default_pendiente():
    """CMC-002: POST without estado_cita creates appointment with Pendiente."""
    client_id, service_id, _ = _new_test_client_service()

    appointment_time = _BASE_TEST_DATE + timedelta(days=201, minutes=0)
    payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": appointment_time.isoformat(),
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "servicios": [
            {
                "servicio_id": service_id,
                "duracion_minutos": 60,
                "precio_unitario": 2500.0,
                "subtotal": 2500.0,
            }
        ]
    }
    r = client.post("/appointments", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["estado_cita"] == "Pendiente"


def test_create_appointment_efectivo():
    """CMC-002: POST with metodo_pago_sena: Efectivo sets payment method."""
    client_id, service_id, _ = _new_test_client_service()

    appointment_time = _BASE_TEST_DATE + timedelta(days=202, minutes=0)
    payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": appointment_time.isoformat(),
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "metodo_pago_sena": "Efectivo",
        "servicios": [
            {
                "servicio_id": service_id,
                "duracion_minutos": 60,
                "precio_unitario": 2500.0,
                "subtotal": 2500.0,
            }
        ]
    }
    r = client.post("/appointments", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["metodo_pago_sena"] == "Efectivo"


def _new_test_client_service():
    """Helper to create a test client and service, return (client_id, service_id, None).
    Avoids creating an appointment so we don't consume counter slots."""
    global _test_counter
    _test_counter += 1

    client_payload = {"nombre": "Clara", "apellido": "Diaz", "dni": _unique_dni(), "telefono": _unique_phone()}
    client_resp = client.post("/clients", json=client_payload)
    assert client_resp.status_code == 201
    client_id = client_resp.json()["id"]

    service_payload = {
        "nombre_servicio": "Manicura",
        "duracion_minutos": 60,
        "precio_actual": 2500.0,
        "monto_sena_actual": 500.0,
        "descripcion": "Manicura Spa",
        "activo": True,
    }
    service_resp = client.post("/services", json=service_payload)
    assert service_resp.status_code == 200
    service_id = service_resp.json()["id"]

    return client_id, service_id, None


def test_config_persists_cbu_fields():
    """Config model persists new cbu_alias and cbu_number fields."""
    # GET /config returns defaults
    r = client.get("/config")
    assert r.status_code == 200
    data = r.json()
    assert data["cbu_alias"] == ""
    assert data["cbu_number"] == ""

    # PUT /config with new fields
    payload = {"cbu_alias": "mi.alias.mp", "cbu_number": "0000003100000000000001"}
    r = client.put("/config", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["cbu_alias"] == "mi.alias.mp"
    assert data["cbu_number"] == "0000003100000000000001"

    # GET /config returns persisted values
    r = client.get("/config")
    assert r.status_code == 200
    data = r.json()
    assert data["cbu_alias"] == "mi.alias.mp"
    assert data["cbu_number"] == "0000003100000000000001"


def test_config_put_only_cbu_fields():
    """PUT /config with only cbu fields preserves other fields."""
    # Reset config first
    client.put("/config", json={"cbu_alias": "", "cbu_number": ""})

    r = client.put("/config", json={"cbu_alias": "alias.test"})
    assert r.status_code == 200
    data = r.json()
    assert data["cbu_alias"] == "alias.test"
    assert data["cbu_number"] == ""
    assert data["business_name"] == "Nails Studio"


# ---- ADMIN CLIENT MANAGEMENT: Multi-phone CRUD (REQ-CLI-006) ----


def test_get_client_with_phones():
    """REQ-CLI-006: GET /clients/{id} returns client with telefonos array."""
    phone = _unique_phone()
    payload = {"nombre": "Multi", "apellido": "Phone", "dni": _unique_dni(), "telefono": phone}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201
    client_id = r.json()["id"]

    r2 = client.get(f"/clients/{client_id}")
    assert r2.status_code == 200
    data = r2.json()
    assert len(data["telefonos"]) == 1
    assert data["telefonos"][0]["telefono"] == phone
    assert data["telefonos"][0]["es_principal"] is True


def test_add_phone_to_client():
    """REQ-CLI-006: POST /clients/{id}/phones adds a phone with normalization."""
    payload = {"nombre": "AddPhone", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]

    r2 = client.post(f"/clients/{client_id}/phones", json={"telefono": "+54 11 5678-1234"})
    assert r2.status_code == 201
    data = r2.json()
    assert data["telefono"] == "541156781234"
    assert data["es_principal"] is False  # second phone, not principal


def test_add_phone_with_label():
    """REQ-CLI-010: POST with etiqueta stores it."""
    payload = {"nombre": "Label", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]

    r2 = client.post(f"/clients/{client_id}/phones", json={"telefono": "541111111111", "etiqueta": "Trabajo"})
    assert r2.status_code == 201
    assert r2.json()["etiqueta"] == "Trabajo"


def test_add_phone_without_label():
    """REQ-CLI-010: POST without etiqueta stores null."""
    payload = {"nombre": "NoLabel", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]

    r2 = client.post(f"/clients/{client_id}/phones", json={"telefono": "542222222222"})
    assert r2.status_code == 201
    assert r2.json()["etiqueta"] is None


def test_update_phone_label():
    """REQ-CLI-006: PATCH /clients/{id}/phones/{phone_id} updates label."""
    payload = {"nombre": "UpdLabel", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    phone_id = r.json()["telefonos"][0]["id"]

    r2 = client.patch(f"/clients/{client_id}/phones/{phone_id}", json={"etiqueta": "Casa"})
    assert r2.status_code == 200
    assert r2.json()["etiqueta"] == "Casa"


def test_update_phone_principal_toggle():
    """REQ-CLI-006: Setting principal on one phone unsets principal on others."""
    payload = {"nombre": "Princ", "apellido": "Toggle", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    phone_a_id = r.json()["telefonos"][0]["id"]

    # Add second phone
    r2 = client.post(f"/clients/{client_id}/phones", json={"telefono": _unique_phone()})
    assert r2.status_code == 201
    phone_b_id = r2.json()["id"]

    # Toggle principal to phone B
    r3 = client.patch(f"/clients/{client_id}/phones/{phone_b_id}", json={"es_principal": True})
    assert r3.status_code == 200
    assert r3.json()["es_principal"] is True

    # Verify phone A is no longer principal
    r4 = client.get(f"/clients/{client_id}")
    phones = r4.json()["telefonos"]
    phone_a = next(p for p in phones if p["id"] == phone_a_id)
    assert phone_a["es_principal"] is False


def test_delete_non_principal_phone():
    """REQ-CLI-006: DELETE /clients/{id}/phones/{phone_id} removes non-principal phone."""
    payload = {"nombre": "DelPhone", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]

    # Add second phone
    r2 = client.post(f"/clients/{client_id}/phones", json={"telefono": _unique_phone()})
    phone_b_id = r2.json()["id"]

    # Delete second phone
    r3 = client.delete(f"/clients/{client_id}/phones/{phone_b_id}")
    assert r3.status_code == 204

    # Verify gone
    r4 = client.get(f"/clients/{client_id}")
    assert len(r4.json()["telefonos"]) == 1


def test_delete_last_phone_returns_422():
    """REQ-CLI-006: Cannot delete the only remaining phone."""
    payload = {"nombre": "LastPh", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    phone_id = r.json()["telefonos"][0]["id"]

    r2 = client.delete(f"/clients/{client_id}/phones/{phone_id}")
    assert r2.status_code == 422


def test_delete_phone_404():
    """DELETE phone with wrong client or phone returns 404."""
    r = client.delete("/clients/99999/phones/99999")
    assert r.status_code == 404


# ---- SOFT DELETE / REACTIVATE (REQ-CLI-009) ----


def test_soft_delete_client():
    """REQ-CLI-009: DELETE /clients/{id} sets activo=False, returns 204."""
    payload = {"nombre": "SoftDel", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    assert r.json()["activo"] is True

    r2 = client.delete(f"/clients/{client_id}")
    assert r2.status_code == 204

    r3 = client.get(f"/clients/{client_id}")
    assert r3.json()["activo"] is False


def test_reactivate_client():
    """REQ-CLI-009: POST /clients/{id}/reactivate sets activo=True."""
    payload = {"nombre": "React", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    client.delete(f"/clients/{client_id}")

    r2 = client.post(f"/clients/{client_id}/reactivate")
    assert r2.status_code == 200
    assert r2.json()["activo"] is True


def test_inactive_client_hidden_by_default():
    """REQ-CLI-009: Inactive client not in default GET /clients."""
    payload = {"nombre": "Hidden", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    client.delete(f"/clients/{client_id}")

    r2 = client.get("/clients")
    clients = r2.json()
    assert all(c["activo"] is True for c in clients)


def test_inactive_client_visible_with_incluir_inactivos():
    """REQ-CLI-009: GET /clients?incluir_inactivos=true includes inactive."""
    payload = {"nombre": "Visible", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    client.delete(f"/clients/{client_id}")

    r2 = client.get("/clients", params={"incluir_inactivos": True})
    clients = r2.json()
    assert any(c["id"] == client_id and c["activo"] is False for c in clients)


def test_get_client_404():
    """GET /clients/{id} with bad id returns 404."""
    r = client.get("/clients/99999")
    assert r.status_code == 404


def test_patch_client_updates_fields():
    """PATCH /clients/{id} updates nombre, apellido, dni."""
    payload = {"nombre": "OldName", "apellido": "OldLast", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]

    r2 = client.patch(f"/clients/{client_id}", json={"nombre": "NewName", "apellido": "NewLast"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["nombre"] == "NewName"
    assert data["apellido"] == "NewLast"


def test_patch_client_404():
    """PATCH /clients/{id} with bad id returns 404."""
    r = client.patch("/clients/99999", json={"nombre": "X"})
    assert r.status_code == 404


def test_delete_client_404():
    """DELETE /clients/{id} with bad id returns 404."""
    r = client.delete("/clients/99999")
    assert r.status_code == 404


def test_reactivate_client_404():
    """POST /clients/{id}/reactivate with bad id returns 404."""
    r = client.post("/clients/99999/reactivate")
    assert r.status_code == 404


# ---- FIND-OR-CREATE VIA CLIENTETELEFONO (REQ-CLI-007) ----


def test_find_or_create_ct_phone_match():
    """REQ-CLI-007: Phone match via ClienteTelefono returns existing with 200."""
    phone = _unique_phone()
    dni1 = _unique_dni()
    dni2 = _unique_dni()

    # Create first client
    r1 = client.post("/clients", json={"nombre": "First", "apellido": "CT", "dni": dni1, "telefono": phone})
    assert r1.status_code == 201
    client1_id = r1.json()["id"]

    # Same phone, different DNI → phone match via CT
    r2 = client.post("/clients", json={"nombre": "Second", "apellido": "CT", "dni": dni2, "telefono": phone})
    assert r2.status_code == 200
    assert r2.json()["id"] == client1_id


def test_find_or_create_dni_match_when_phone_new():
    """REQ-CLI-007: DNI match when phone is new returns existing with 200."""
    dni = _unique_dni()
    phone1 = _unique_phone()
    phone2 = _unique_phone()

    # Create with phone1
    r1 = client.post("/clients", json={"nombre": "DniCT", "apellido": "Test", "dni": dni, "telefono": phone1})
    assert r1.status_code == 201
    client_id = r1.json()["id"]

    # Same DNI, different phone2 → DNI match
    r2 = client.post("/clients", json={"nombre": "DniCT2", "apellido": "Test", "dni": dni, "telefono": phone2})
    assert r2.status_code == 200
    assert r2.json()["id"] == client_id


# ---- SEARCH ACROSS CLIENTETELEFONO (REQ-CLI-007) ----


def test_search_by_phone_fragment_via_ct():
    """REQ-CLI-007: Search across ClienteTelefono finds by phone fragment."""
    phone = _unique_phone()
    payload = {"nombre": "SearchCT", "apellido": "Test", "dni": _unique_dni(), "telefono": phone}
    r = client.post("/clients", json=payload)
    assert r.status_code == 201

    r2 = client.get("/clients/search", params={"q": phone[-8:]})
    assert r2.status_code == 200
    data = r2.json()
    assert any(phone in [p["telefono"] for p in c["telefonos"]] for c in data)


def test_search_incluir_inactivos_param():
    """REQ-CLI-009: Search respects incluir_inactivos."""
    payload = {"nombre": "SearchInact", "apellido": "Test", "dni": _unique_dni(), "telefono": _unique_phone()}
    r = client.post("/clients", json=payload)
    client_id = r.json()["id"]
    client.delete(f"/clients/{client_id}")

    # Without flag → not in results
    r2 = client.get("/clients/search", params={"q": "SearchInact"})
    assert r2.status_code == 200
    assert not any(c["id"] == client_id for c in r2.json())

    # With flag → in results
    r3 = client.get("/clients/search", params={"q": "SearchInact", "incluir_inactivos": True})
    assert r3.status_code == 200
    assert any(c["id"] == client_id for c in r3.json())


# ---- APPOINTMENT HISTORY ----


def test_get_client_appointments():
    """GET /clients/{id}/appointments returns appointments ordered by date desc."""
    client_id, _, _ = _create_test_client_and_appointment()

    r = client.get(f"/clients/{client_id}/appointments")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert all(a["id_cliente"] == client_id for a in data)
    # Verify descending order
    dates = [a["fecha_hora_cita"] for a in data]
    assert dates == sorted(dates, reverse=True)


def test_get_client_appointments_404():
    """GET /clients/{id}/appointments with bad id returns 404."""
    r = client.get("/clients/99999/appointments")
    assert r.status_code == 404


# ---- LIST WITH INCLUIR_INACTIVOS (REQ-CLI-008) ----


def test_list_clients_default_active_only():
    """GET /clients returns only active clients by default."""
    r = client.get("/clients")
    assert r.status_code == 200
    assert all(c["activo"] is True for c in r.json())


def test_list_clients_with_incluir_inactivos():
    """GET /clients?incluir_inactivos=true includes inactive clients."""
    r = client.get("/clients", params={"incluir_inactivos": True})
    assert r.status_code == 200
    data = r.json()
    # At least one client exists (from other tests); activo can be True or False
    assert len(data) > 0


def test_busy_slots_and_conflict_detection():
    # Reset counter to a known position for this standalone test
    global _test_counter
    _test_counter = 100  # far enough to avoid collision with dynamic tests
    days_offset, minutes_offset = _unique_date_offset()
    # Derive the expected date string from the offset
    appt_dt = _BASE_TEST_DATE + timedelta(days=days_offset, minutes=minutes_offset)
    appt_date_str = appt_dt.strftime("%Y-%m-%d")
    conflicting_time = (appt_dt + timedelta(minutes=30)).isoformat()

    client_payload = {"nombre": "Lucia", "apellido": "Perez", "dni": _unique_dni(), "telefono": _unique_phone()}
    client_resp = client.post("/clients", json=client_payload)
    assert client_resp.status_code == 201
    client_id = client_resp.json()["id"]

    service_payload = {
        "nombre_servicio": "Manicura",
        "duracion_minutos": 60,
        "precio_actual": 2500.0,
        "monto_sena_actual": 500.0,
        "descripcion": "Manicura Spa",
        "activo": True,
    }
    service_resp = client.post("/services", json=service_payload)
    assert service_resp.status_code == 200
    service_id = service_resp.json()["id"]

    appointment_payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": appt_dt.isoformat(),
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "servicios": [
            {
                "servicio_id": service_id,
                "duracion_minutos": 60,
                "precio_unitario": 2500.0,
                "subtotal": 2500.0,
            }
        ]
    }
    appt_resp = client.post("/appointments", json=appointment_payload)
    assert appt_resp.status_code == 200

    busy_resp = client.get("/busy_slots", params={"date_str": appt_date_str})
    assert busy_resp.status_code == 200
    busy_slots = busy_resp.json()
    assert len(busy_slots) == 1

    conflicting_payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": conflicting_time,
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "servicios": [
            {
                "servicio_id": service_id,
                "duracion_minutos": 60,
                "precio_unitario": 2500.0,
                "subtotal": 2500.0,
            }
        ]
    }
    conflict_resp = client.post("/appointments", json=conflicting_payload)
    assert conflict_resp.status_code == 409
    assert "ocupado" in conflict_resp.json()["detail"]
