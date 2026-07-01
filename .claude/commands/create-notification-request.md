# Create Notification Request

Crea una solicitud de notificación certificada en Notification Manager, añade uno o varios receptores y la envía.

Dos modos de uso:

- **Guiado** (por defecto): solo pasas el asunto y el contenido, te pregunta el resto paso a paso con confirmación final
- **Rápido**: pasas todos los flags y ejecuta directamente

## Uso

```
/create-notification-request <asunto> <contenido> --to "email:Nombre" [--to "email2:Nombre2" ...] [--provider SMTP|NOTICEMAN|NOTICEMAN_AND_WHATSAPP] [--send]
```

**Ejemplos:**
```
# Modo guiado
/create-notification-request "Contrato pendiente de revisión" "<p>Adjuntamos el contrato para su revisión.</p>"

# Modo rápido
/create-notification-request "Aviso de vencimiento" "<p>Su póliza vence el 15 de julio.</p>" --to "ana@cliente.com:Ana Pérez" --provider NOTICEMAN --send
```

## Instrucciones

Los argumentos son: $ARGUMENTS

---

### PASO 0 — Detectar modo y parsear argumentos

Extrae del string de argumentos:
- `subject`: primer argumento posicional (el asunto)
- `content`: segundo argumento posicional (el contenido, HTML permitido: `<p>`, `<strong>`, `<em>`, `<ul>/<li>`, `<ol>/<li>` únicamente)
- `receivers`: uno o más `--to "email:Nombre"` (puede repetirse)
- `provider`: valor de `--provider` si existe (`SMTP` / `NOTICEMAN` / `NOTICEMAN_AND_WHATSAPP`)
- `sendNow`: `true` si aparece el flag `--send`

**Modo rápido**: si están presentes `subject`, `content`, al menos un `--to` Y `--provider` → salta al PASO 3.

**Modo guiado**: si falta cualquiera de los anteriores → ejecuta el flujo interactivo (PASO 1 y PASO 2).

---

### PASO 1 — Validar contenido

El contenido DEBE ser HTML válido dentro del subconjunto soportado (`<p>`, `<strong>`, `<em>`, `<ul>/<li>`, `<ol>/<li>`). Si el usuario escribió texto plano sin etiquetas, envuélvelo automáticamente en `<p>...</p>` antes de continuar.

---

### PASO 2 — Recopilación guiada (solo en modo guiado)

Haz las preguntas **de una en una**, esperando respuesta del usuario antes de pasar a la siguiente.

**2a. Receptores** (solo si no se pasó ningún `--to`):

> ¿A quién quieres notificar? Indica uno o varios `email:Nombre` separados por comas.
> Ejemplo: `ana@cliente.com:Ana Pérez, juan@cliente.com:Juan López`

**2b. Canal de entrega** (solo si no se pasó `--provider`):

> ¿Qué canal de entrega quieres usar?
> **1. SMTP** — email estándar, no certificado
> **2. NOTICEMAN** — canal certificado propio (entrega electrónica cualificada)
> **3. NOTICEMAN + WhatsApp** — canal certificado más copia por WhatsApp

**2c. Enviar ahora** (solo si no se pasó `--send`):

> ¿Quieres enviarla ahora, o dejarla en borrador para revisarla antes?
> (sí = enviar ahora / no = dejar en borrador)

---

### PASO 3 — Resumen y confirmación

Antes de ejecutar, muestra siempre este resumen y pide confirmación:

```
📋 Resumen de la notificación a crear
────────────────────────────────────
✉️  Asunto:      <subject>
👥 Receptores:  <lista "Nombre <email>", uno por línea>
📡 Canal:       <provider>
📤 Envío:       <"Inmediato" o "Guardar como borrador">
────────────────────────────────────
¿Procedemos? (sí/no)
```

Si el usuario responde **no** → cancela:
```
❌ Notificación cancelada.
```

---

### PASO 4 — Crear la solicitud

Llama a `notification_request_create` con:
- `subject`: asunto confirmado
- `content`: contenido HTML validado en PASO 1
- `language`: `"es_ES"` (o `"en_GB"` si el usuario escribió en inglés)

Guarda el `requestId` devuelto — lo necesitas en todos los pasos siguientes.

---

### PASO 5 — Añadir receptores

Para cada receptor de la lista, llama a `notification_receiver_add` con:
- `requestId`: el de PASO 4
- `receivers`: un array con un objeto por receptor, cada uno con `provider` (el canal elegido en PASO 2b) y los campos que ese canal requiera (`address`/`name`, y `type` si el canal es `NOTICEMAN`)

Puedes añadir todos los receptores en una sola llamada (el array acepta varios).

---

### PASO 6 — Enviar (solo si `sendNow` es verdadero)

Llama a `notification_request_send` con:
- `requestId`: el de PASO 4

Esta llamada corre como una Task (puede tardar según el número de receptores) — espera a que termine antes de mostrar el resultado.

---

### PASO 7 — Mostrar resultado

**Si se envió (PASO 6 ejecutado):**

```
╔══════════════════════════════════════════════════════════════╗
║              NOTIFICACIÓN CERTIFICADA ENVIADA                ║
║                    Notification Manager                      ║
╚══════════════════════════════════════════════════════════════╝

  ─────────────────────────────────────────────────────────────
  ✉️  Asunto:      <subject>
  🆔 Request ID:  <requestId>
  👥 Receptores:  <cantidad> — <lista "Nombre <email>: <estado>">
  📡 Canal:       <provider>
  ─────────────────────────────────────────────────────────────
  Consulta el estado en cualquier momento con notification_request_status.
╚══════════════════════════════════════════════════════════════╝
```

**Si se dejó en borrador (PASO 6 omitido):**

```
📝 Notificación guardada como borrador.
   Request ID: <requestId>
   Añade más receptores/documentos, o envíala cuando estés listo con notification_request_send.
```

**Error:**
```
❌ Error al crear/enviar la notificación

Paso fallido: <indicar qué paso falló>
Mensaje: <mensaje de error>

💡 Sugerencia: <consejo según el tipo de error>
```

**Errores comunes:**
- `Validation error en content` → El contenido debe ser HTML válido dentro del subconjunto soportado; revisa que no haya etiquetas no permitidas
- `Request not found` → El `requestId` no existe o pertenece a otra sesión; vuelve a crear la solicitud
- `All notifications with this requestId not in DRAFT status` → La solicitud ya fue enviada; usa `notification_request_status` para consultar su estado en lugar de añadir más receptores
