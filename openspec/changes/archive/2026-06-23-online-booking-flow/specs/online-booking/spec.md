# Online Booking Specification

**Domain**: `online-booking`
**Status**: Active (new)

---

## Purpose

Flujo público de reserva online en 4 pasos: selección de servicio, datos personales con DNI, confirmación con resumen, y pantalla de pago con envío de comprobante por WhatsApp. El calendario público protege la privacidad mostrando "Ocupado" en slots no disponibles.

---

## Requirements

### REQ-BKG-001 — CBU/Alias en Configuración (MUST)

El modelo `Configuracion` DEBE incluir `cbu_alias: str` y `cbu_number: str`. Los schemas `ConfiguracionUpdate` y `ConfiguracionRead` DEBEN exponerlos. El panel admin DEBE permitir visualizarlos y editarlos. Si ambos están vacíos, la pantalla de pago DEBE mostrar "Consultá por WhatsApp".

#### Scenario: Admin configura CBU/Alias
- DADO el admin en el panel de configuración
- CUANDO completa CBU/Alias y guarda
- THEN el sistema persiste los valores
- Y la pantalla de pago los muestra correctamente

#### Scenario: CBU/Alias vacíos
- DADO que la configuración tiene CBU y alias vacíos
- CUANDO una clienta llega a la pantalla de pago
- THEN se muestra "Consultá por WhatsApp"

### REQ-BKG-002 — Flujo Multi-Step (MUST)

La reserva DEBE tener 4 pasos secuenciales: (1) selección de servicio, (2) datos del cliente (nombre, apellido, teléfono, DNI) + calendario, (3) resumen con servicio, total, seña y datos ingresados + botón "Confirmar turno", (4) pantalla de pago con CBU/Alias y monto de seña.

#### Scenario: Flujo completo
- DADO una clienta en /reservar
- CUANDO selecciona servicio, completa datos con DNI, elige fecha/hora y confirma resumen
- THEN el sistema crea cliente y cita (estado Pendiente)
- Y la clienta ve pantalla de pago con CBU/Alias y monto de seña

#### Scenario: DNI faltante en paso 2
- DADO una clienta en paso 2
- CUANDO intenta avanzar sin DNI
- THEN el formulario muestra error "DNI es obligatorio"

#### Scenario: Servicio no seleccionado
- DADO una clienta sin servicio seleccionado
- CUANDO intenta confirmar
- THEN el sistema muestra "Seleccioná un servicio antes de continuar"

### REQ-BKG-003 — WhatsApp Payment Receipt (MUST)

La pantalla de pago DEBE incluir botón WhatsApp con mensaje pre-redactado. El link DEBE abrir `https://wa.me/{whatsapp_number}` con mensaje codificado incluyendo nombre, fecha/hora, servicio y monto de seña. Si `whatsapp_number` está vacío, el botón DEBE ocultarse y mostrar "Contactanos por WhatsApp para enviar el comprobante."

#### Scenario: Botón abre WhatsApp con datos de la cita
- DADA cita creada para "María" el "25/12 14:00" servicio "Esmaltado" seña "$2000"
- CUANDO la clienta hace click en el botón
- THEN se abre `https://wa.me/3411234567?text=...`
- Y el mensaje contiene "María", "25/12", "14:00", "Esmaltado", "$2000"

#### Scenario: WhatsApp no configurado
- DADO que `whatsapp_number` está vacío
- CUANDO la clienta está en pantalla de pago
- THEN el botón WhatsApp NO se muestra
- Y se muestra texto alternativo de contacto

### REQ-BKG-004 — DNI en Formulario (MUST)

El formulario de reserva DEBE incluir campo `dni` obligatorio en paso 2. El payload a `POST /clients` DEBE incluirlo (el backend ya lo exige). `POST /clients` continúa usando find-or-create por teléfono, pero ahora `dni` también es requerido.

#### Scenario: DNI incluido al crear cliente
- DADO el formulario de datos completo con DNI
- CUANDO se envía el formulario
- THEN `POST /clients` recibe `dni` y crea/encuentra el cliente

#### Scenario: DNI ausente
- DADO el formulario sin DNI
- CUANDO la clienta intenta enviar
- THEN el frontend rechaza con validación local: "DNI es obligatorio"

### REQ-BKG-005 — Privacy Labels (MUST)

Los slots ocupados en el calendario público DEBEN mostrar el texto "Ocupado" en lugar de la hora. El calendario DEBE incluir un mensaje explicativo de privacidad.

#### Scenario: Slot ocupado muestra "Ocupado"
- DADO un slot de 10:00-11:00 ocupado
- CUANDO la clienta ve el calendario
- THEN el slot muestra "Ocupado"
- Y no se puede seleccionar

#### Scenario: Mensaje de privacidad visible
- DADA la clienta en el calendario
- CUANDO visualiza horarios
- THEN ve un mensaje sobre protección de datos personales
