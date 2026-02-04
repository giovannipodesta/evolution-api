# Integración de Foto de Perfil con Click Tracking

## Descripción General

Esta funcionalidad extiende el webhook de click tracking para incluir automáticamente la foto de perfil del contacto cuando hace click en el enlace de seguimiento.

## Flujo de Funcionamiento

```
1. Usuario recibe enlace de tracking → /evento/click/{envioId}
2. Usuario hace click en el enlace
3. Sistema registra el click (clickedAt timestamp)
4. Sistema obtiene foto de perfil usando Evolution API
5. Sistema envía webhook a serverRegister con:
   - envioId
   - telefono
   - timestamp
   - profilePictureUrl (si está disponible)
6. Usuario es redirigido a la URL original
```

## Endpoint de Evolution API Utilizado

```bash
POST /chat/fetchProfilePictureUrl/{instance}
Content-Type: application/json
apikey: <api-key>

{
  "number": "5939XXXXXXXX"
}
```

### Respuesta
```json
{
  "wuid": "5939XXXXXXXX@s.whatsapp.net",
  "profilePictureUrl": "https://pps.whatsapp.net/v/t61.2..."
}
```

## Variables de Entorno Requeridas

Agregar al archivo `.env`:

```bash
# URL del servidor que recibirá los webhooks de click tracking
SERVER_REGISTER_URL=https://tu-servidor-registro.com

# URL de la API de Evolution (opcional, por defecto: http://localhost:8080)
EVOLUTION_API_URL=https://tu-evolution-api.com

# API Key de Evolution API (requerido para obtener fotos de perfil)
EVOLUTION_API_KEY=tu-api-key-aqui
```

## Estructura del Webhook Enviado

### Payload enviado a `{SERVER_REGISTER_URL}/api/webhook/click`

```typescript
{
  envioId: string;          // ID del envío programado
  telefono: string;         // Número de teléfono (formato: 593XXXXXXXXX)
  timestamp: number;        // Timestamp del click (milisegundos)
  profilePictureUrl?: string; // URL de la foto de perfil (opcional)
}
```

**Nota:** `profilePictureUrl` solo se incluye si:
- Evolution API devuelve una URL válida
- El contacto tiene foto de perfil configurada
- No hay errores en la obtención

## Características de Seguridad y Confiabilidad

### 1. **Fire and Forget**
- El webhook se dispara de forma asíncrona
- No bloquea la redirección del usuario

### 2. **Manejo de Errores Graceful**
```typescript
// Si falla la obtención de la foto:
// ✅ El webhook SE ENVÍA de todas formas (sin foto)
// ✅ El usuario es redirigido correctamente
// ⚠️ Se registra un warning en los logs
```

### 3. **Timeout Protection**
- Máximo 5 segundos para obtener la foto
- Evita bloqueos en caso de API lenta

### 4. **Rate Limiting Natural**
- Solo se ejecuta cuando el usuario hace click
- No hay solicitudes masivas automáticas
- Cumple con las mejores prácticas anti-baneo

### 5. **Validación de Configuración**
```typescript
// Si falta EVOLUTION_API_KEY:
// ⚠️ Se omite la obtención de foto
// ✅ El webhook se envía sin foto
// ℹ️ Se registra warning informativo
```

## Logs Generados

### Caso Exitoso (con foto)
```
📸 Obteniendo foto de perfil para 5939XXXXXXXX...
✅ Foto de perfil obtenida para 5939XXXXXXXX
📤 Webhook enviado a serverRegister para abc123 (con foto de perfil)
```

### Caso Exitoso (sin foto)
```
📸 Obteniendo foto de perfil para 5939XXXXXXXX...
ℹ️ No hay foto de perfil disponible para 5939XXXXXXXX
📤 Webhook enviado a serverRegister para abc123
```

### Caso con Error
```
📸 Obteniendo foto de perfil para 5939XXXXXXXX...
⚠️ Error obteniendo foto de perfil: Request timeout
⚠️ No se pudo obtener foto de perfil para 5939XXXXXXXX: Request timeout
📤 Webhook enviado a serverRegister para abc123
```

## Ejemplo de Implementación del Receptor (serverRegister)

```typescript
// En tu servidor receptor
app.post('/api/webhook/click', async (req, res) => {
  const { envioId, telefono, timestamp, profilePictureUrl } = req.body;

  console.log(`Click detectado: ${telefono} en ${new Date(timestamp).toISOString()}`);

  if (profilePictureUrl) {
    // Opción 1: Guardar URL directamente
    await db.contacts.update({
      where: { phone: telefono },
      data: { 
        profilePicture: profilePictureUrl,
        lastClickTimestamp: timestamp
      }
    });

    // Opción 2: Descargar y almacenar como base64 (opcional)
    try {
      const response = await fetch(profilePictureUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      
      await db.contacts.update({
        where: { phone: telefono },
        data: { profilePictureBase64: base64 }
      });
    } catch (error) {
      console.error('Error descargando foto:', error);
    }
  } else {
    console.log('No hay foto de perfil disponible para este contacto');
  }

  res.json({ success: true });
});
```

## Consideraciones Importantes

### ✅ Ventajas
1. **URL Directa**: Evolution API devuelve URLs HTTP estándar (JPG/PNG)
2. **No Requiere Bucket**: No necesitas S3/MinIO para fotos de perfil
3. **Desencriptación Automática**: Evolution API maneja archivos `.enc` internamente
4. **Rate Limiting Natural**: Solo se ejecuta en clicks reales
5. **No Bloquea el Flujo**: La obtención de foto es secundaria y no crítica

### ⚠️ Limitaciones
1. **URL Temporal**: Las URLs de WhatsApp pueden expirar
   - **Recomendación**: Descarga y almacena la imagen en tu servidor si necesitas permanencia
2. **Disponibilidad**: No todos los números tienen foto de perfil
   - **Solución**: Siempre maneja el caso `profilePictureUrl: undefined`
3. **Privacidad**: Algunas configuraciones de privacidad pueden bloquear la foto
   - **Solución**: Usar foto placeholder/avatar genérico

### 🛡️ Anti-Baneo
Esta implementación es **SEGURA** porque:
- ✅ Solo 1 solicitud por click real (no automatizado)
- ✅ No hay loops ni solicitudes masivas
- ✅ El usuario inicia la acción (no es spam)
- ✅ Timeout de 5 segundos evita stress en la API
- ✅ Errores no reintentan automáticamente

## Testing

### Test Manual
```bash
# 1. Configura las variables de entorno
export SERVER_REGISTER_URL="https://webhook.site/tu-id-unico"
export EVOLUTION_API_KEY="tu-api-key"

# 2. Programa un envío
curl -X POST http://localhost:8080/evento/programar-envio \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "0991234567",
    "url": "https://ejemplo.com",
    "timestamp": 1738800000000
  }'

# 3. Espera a que se envíe el mensaje
# 4. Haz click en el enlace desde WhatsApp
# 5. Verifica el webhook en webhook.site
```

### Verificar Logs
```bash
# Ver logs del servidor
tail -f logs/application.log | grep "foto de perfil"
```

## Troubleshooting

### Problema: No se envía profilePictureUrl
**Posibles causas:**
1. `EVOLUTION_API_KEY` no está configurado
2. El contacto no tiene foto de perfil
3. Configuración de privacidad del contacto
4. Timeout en la API

**Solución:**
```bash
# Verificar variables de entorno
env | grep EVOLUTION

# Probar endpoint manualmente
curl -X POST "http://localhost:8080/chat/fetchProfilePictureUrl/tu-instancia" \
  -H "Content-Type: application/json" \
  -H "apikey: tu-api-key" \
  -d '{"number": "5939XXXXXXXX"}'
```

### Problema: Timeout al obtener foto
**Solución:**
- El sistema está diseñado para esto
- El webhook se envía de todas formas
- Revisa la estabilidad de Evolution API

## Próximos Pasos Sugeridos

1. **Cachear Fotos de Perfil** (Opcional)
   - Almacenar `profilePictureUrl` en DB después del primer click
   - Evitar solicitudes duplicadas

2. **Descarga Automática** (Recomendado)
   - En `serverRegister`, descargar y almacenar fotos
   - Evitar URLs expiradas

3. **Webhook Retry Logic** (Opcional)
   - Implementar reintentos si falla el webhook principal
   - Guardar en cola de pendientes

## Cambios en el Código

**Archivo modificado:**
- `src/api/integrations/evento/services/evento.service.ts`

**Métodos agregados:**
- `fetchProfilePicture()`: Obtiene foto de perfil de Evolution API
  
**Métodos modificados:**
- `notifyServerRegister()`: Ahora incluye foto de perfil en el payload
