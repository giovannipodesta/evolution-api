# Documentación de Integración: Notificaciones WhatsApp (Evolution API)

Esta guía detalla los endpoints necesarios para implementar el subsistema de notificaciones utilizando la instancia `evento-ef` de Evolution API.

## 1. Configuración General

*   **Base URL**: `http://100.64.85.17:8080`
*   **Instance Name**: `evento-ef`
*   **API Key**: `evento2025secret` (Header: `apikey`)
*   **Content-Type**: `application/json`

---

## 2. Enviar Mensaje de Texto

Este endpoint envía un mensaje simple a un número de WhatsApp. Es **CRÍTICO** guardar el `id` de la respuesta si se planea editar el mensaje posteriormente.

*   **Endpoint**: `POST /message/sendText/{instance}`
*   **URL Completa**: `http://100.64.85.17:8080/message/sendText/evento-ef`

### Payload (Ejemplo)

Nota: El número debe incluir el código de país (ej. `593` para Ecuador).

```json
{
  "number": "593978616977",
  "text": "Oye, la gente se está registrando"
}
```

### Respuesta Exitosa (Extracto)

Debes capturar `key.id` para futuras ediciones.

```json
{
  "key": {
    "remoteJid": "593978616977@s.whatsapp.net",
    "fromMe": true,
    "id": "3EB0F81A31A62A5E0B0A2C"  // <--- GUARDAR ESTE ID
  },
  "status": "PENDING",
  "message": { ... }
}
```

---

## 3. Editar Mensaje

Permite corregir un mensaje enviado.

**⚠️ Restricciones Importantes:**
*   Solo es posible editar mensajes dentro de los primeros **15 minutos** de haber sido enviados.
*   Debes tener el `id` original del mensaje (obtenido en la respuesta del envío).

*   **Endpoint**: `POST /chat/updateMessage/{instance}`
*   **URL Completa**: `http://100.64.85.17:8080/chat/updateMessage/evento-ef`

### Payload (Ejemplo)

```json
{
  "number": "593978616977",
  "text": "LOCO, te digo que la gente se está registrando, si me llegó",
  "key": {
    "id": "3EB0F81A31A62A5E0B0A2C",        // ID original del mensaje
    "remoteJid": "593978616977@s.whatsapp.net", // JID del destinatario
    "fromMe": true                        // Siempre true para mensajes enviados por ti
  }
}
```

### Respuesta Exitosa

```json
{
  "key": { ... },
  "message": {
    "protocolMessage": {
      "type": "MESSAGE_EDIT",
      "editedMessage": {
        "extendedTextMessage": {
          "text": "LOCO, te digo que la gente se está registrando, si me llegó"
        }
      }
    }
  },
  "status": "PENDING"
}
```

---

## 4. Ejemplos Curl Rápidos

**Enviar:**
```bash
curl -X POST "http://100.64.85.17:8080/message/sendText/evento-ef" \
  -H "Content-Type: application/json" \
  -H "apikey: evento2025secret" \
  -d '{"number": "593978616977", "text": "Hola mundo"}'
```

**Editar:**
```bash
curl -X POST "http://100.64.85.17:8080/chat/updateMessage/evento-ef" \
  -H "Content-Type: application/json" \
  -H "apikey: evento2025secret" \
  -d '{"number": "593978616977", "text": "Hola mundo editado", "key": {"id": "ID_DEL_MENSAJE", "remoteJid": "593978616977@s.whatsapp.net", "fromMe": true}}'
```

---

## 5. Enviar Mensaje con Botones

Envía un mensaje interactivo que puede contener botones de respuesta, enlaces o acciones.

*   **Endpoint**: `POST /message/sendButtons/{instance}`
*   **URL Completa**: `http://100.64.85.17:8080/message/sendButtons/evento-ef`

### Payload (Ejemplo Botón URL)

```json
{
  "number": "593978616977",
  "title": "¡Hola!",
  "description": "Prueba de botones interactivos",
  "footer": "Evento Whatsapp", // Opcional
  "buttons": [
    {
      "type": "url",
      "displayText": "Ver ahora",
      "url": "https://google.com"
    }
  ]
}
```


### ⚠️ Advertencia Importante sobre Botones
Los botones nativos (especialmente tipo `url`) pueden **no mostrarse** en algunos dispositivos (especialmente iOS) si no se utilizan plantillas oficiales de WhatsApp Business.

**Recomendación:** Si la entrega es crítica, **envía el enlace dentro del texto**. WhatsApp generará una vista previa automáticamente.

```bash
# Alternativa Segura (Texto + Link)
curl -X POST "http://100.64.85.17:8080/message/sendText/evento-ef" \
  -H "Content-Type: application/json" \
  -H "apikey: evento2025secret" \
  -d '{
    "number": "593978616977",
    "text": "Loco, tienes que ver esto: https://google.com"
  }'
```

### Tipos de Botones Soportados (Experimental)

1.  **url**: Abre un enlace web (Alta probabilidad de fallo visual).
2.  **reply**: Envía una respuesta de texto predefinida (Más estable).
3.  **call**: Inicia una llamada.


### Ejemplo Curl con Botón

```bash
curl -X POST "http://100.64.85.17:8080/message/sendButtons/evento-ef" \
  -H "Content-Type: application/json" \
  -H "apikey: evento2025secret" \
  -d '{
    "number": "593978616977",
    "title": "Verifica esto",
    "description": "Haz clic abajo para ir a Google",
    "buttons": [
      {
        "type": "url",
        "displayText": "Ir a Google",
        "url": "https://google.com"
      }
    ]
  }'
```
