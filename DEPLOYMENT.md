# Despliegue a Google Cloud - Evolution Evento

## Configuración de Producción

### URLs de Producción
- **Dominio**: evento.encuentra-facil.com
- **API Evolution**: https://evento.encuentra-facil.com
- **Puerto**: 8080

### Especificaciones de la VM
- **Nombre**: evolution-evento
- **RAM**: 2GB
- **Zona**: us-east4-a
- **Proyecto**: encuentra-facil-5501a

## Pre-requisitos

1. **Google Cloud SDK instalado**
   ```bash
   gcloud --version
   ```

2. **Autenticación con GCloud**
   ```bash
   gcloud auth login
   gcloud config set project encuentra-facil
   ```

3. **Acceso SSH a la VM**
   ```bash
   gcloud compute ssh encuentrafacil@evolution-evento --zone=us-central1-a
   ```

4. **PM2 instalado en la VM**
   ```bash
   # En la VM
   npm install -g pm2
   pm2 startup
   ```

5. **PostgreSQL configurado en la VM**
   - Actualizar `DATABASE_CONNECTION_URI` en `.env.production` con las credenciales correctas

## Configuración Inicial en la VM

### Primera vez (solo una vez)

1. **Conectarse a la VM**
   ```bash
   gcloud compute ssh encuentrafacil@evolution-evento --zone=us-central1-a
   ```

2. **Clonar el repositorio**
   ```bash
   cd ~
   git clone https://github.com/tu-usuario/evento-whatsapp.git
   cd evento-whatsapp
   ```

3. **Crear directorio de logs**
   ```bash
   mkdir -p ~/logs
   ```

4. **Configurar variables de entorno**
   ```bash
   cp .env.production .env
   # Editar .env con las credenciales correctas de PostgreSQL
   nano .env
   ```

5. **Instalar dependencias**
   ```bash
   export NODE_OPTIONS='--max-old-space-size=1536'
   npm ci
   ```

6. **Ejecutar migraciones de base de datos**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

7. **Compilar el proyecto**
   ```bash
   npm run build
   ```

8. **Iniciar con PM2**
   ```bash
   pm2 start ecosystem.config.json
   pm2 save
   ```

## Despliegue (actualizaciones)

### Desde tu máquina local

```bash
# Asegúrate de estar en el directorio del proyecto
cd /Users/encuentrafacil/Documents/evento-whatsapp

# Ejecutar el script de despliegue
./deploy-gcloud.sh
```

El script automáticamente:
1. ✅ Verifica el directorio local
2. ✅ Commitea cambios pendientes
3. ✅ Sube cambios al repositorio
4. ✅ Detiene servicios en la VM
5. ✅ Actualiza el código en la VM
6. ✅ Configura variables de entorno de producción
7. ✅ Instala dependencias y compila
8. ✅ Reinicia servicios con PM2

### Manualmente en la VM

Si prefieres desplegar manualmente:

```bash
# Conectarse a la VM
gcloud compute ssh encuentrafacil@evolution-evento --zone=us-central1-a

# Ir al directorio del proyecto
cd ~/evento-whatsapp

# Detener servicios
pm2 stop evolution-evento

# Actualizar código
git pull origin main

# Copiar configuración de producción
cp .env.production .env

# Instalar dependencias y compilar
export NODE_OPTIONS='--max-old-space-size=1536'
npm ci
npm run build

# Reiniciar servicios
pm2 restart evolution-evento
pm2 save

# Ver logs
pm2 logs evolution-evento
```

## Comandos Útiles

### En la VM

```bash
# Ver estado de los servicios
pm2 status

# Ver logs en tiempo real
pm2 logs evolution-evento

# Ver logs recientes (últimas 100 líneas)
pm2 logs evolution-evento --lines 100

# Reiniciar servicio
pm2 restart evolution-evento

# Detener servicio
pm2 stop evolution-evento

# Ver uso de memoria
pm2 monit

# Ver información detallada
pm2 show evolution-evento
```

### Desde tu máquina local

```bash
# Ejecutar comando en la VM
gcloud compute ssh encuentrafacil@evolution-evento \
  --zone=us-central1-a \
  --command="pm2 status"

# Ver logs desde local
gcloud compute ssh encuentrafacil@evolution-evento \
  --zone=us-central1-a \
  --command="pm2 logs evolution-evento --lines 50 --nostream"
```

## Optimizaciones para 2GB RAM

El proyecto está configurado con las siguientes optimizaciones:

1. **Límite de memoria de Node.js**: 1536MB (1.5GB)
   - Deja ~500MB para el sistema operativo y PostgreSQL

2. **PM2 configurado para**:
   - 1 instancia (modo fork, no cluster)
   - Auto-reinicio si excede 1536MB
   - Reinicio automático en caso de crash

3. **Variables de entorno optimizadas**:
   - Logs reducidos (solo ERROR, WARN, INFO)
   - Telemetría deshabilitada
   - Cache local habilitado (no Redis)

## Solución de Problemas

### La aplicación se queda sin memoria

```bash
# Ver uso de memoria
pm2 monit

# Si es necesario, reducir el límite de memoria
# Editar ecosystem.config.json y cambiar max_memory_restart a "1024M"
```

### Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar credenciales en .env
cat .env | grep DATABASE_CONNECTION_URI
```

### La aplicación no inicia

```bash
# Ver logs de error
pm2 logs evolution-evento --err --lines 100

# Verificar que el build se completó
ls -la dist/src/main.js

# Recompilar si es necesario
npm run build
```

## Configuración de Nginx (si aplica)

Si estás usando Nginx como proxy reverso:

```nginx
server {
    listen 80;
    server_name evento.encuentra-facil.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Notas Importantes

⚠️ **Antes del primer despliegue**:
1. Actualiza las credenciales de PostgreSQL en `.env.production`
2. Verifica la zona y proyecto de GCloud en `deploy-gcloud.sh`
3. Asegúrate de que el dominio `evento.encuentra-facil.com` apunta a la IP de la VM

⚠️ **Seguridad**:
- Nunca commitees el archivo `.env` con credenciales reales
- El archivo `.env.production` debe ser editado directamente en la VM
- Mantén `AUTHENTICATION_API_KEY` seguro

⚠️ **Base de datos**:
- Las migraciones se deben ejecutar manualmente en producción
- Haz backup de la base de datos antes de migraciones importantes
