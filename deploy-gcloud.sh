#!/bin/bash

# Script de despliegue a Google Cloud VM - Evolution Evento
# VM: evolution-evento
# Specs: 2GB RAM
# URL: evento.encuentra-facil.com

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
VM_NAME="evolution-evento"
VM_ZONE="us-east4-a"  # Ajusta según tu zona
PROJECT_ID="encuentra-facil-5501a"  # Ajusta según tu proyecto
REMOTE_USER="encuentrafacil"
REMOTE_DIR="/home/${REMOTE_USER}/evento-whatsapp"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Desplegando a GCloud VM: ${VM_NAME}              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# Función para ejecutar comandos en la VM
run_remote() {
    gcloud compute ssh ${REMOTE_USER}@${VM_NAME} \
        --zone=${VM_ZONE} \
        --project=${PROJECT_ID} \
        --command="$1"
}

# 1. Verificar que estamos en el directorio correcto
echo -e "\n${YELLOW}[1/8] Verificando directorio local...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: No se encuentra package.json. Ejecuta este script desde la raíz del proyecto.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Directorio correcto${NC}"

# 2. Verificar que hay cambios para commitear
echo -e "\n${YELLOW}[2/8] Verificando estado de Git...${NC}"
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}Hay cambios sin commitear. Commiteando...${NC}"
    git add .
    git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || true
fi
echo -e "${GREEN}✓ Git actualizado${NC}"

# 3. Push a repositorio
echo -e "\n${YELLOW}[3/8] Subiendo cambios al repositorio...${NC}"
git push origin main || git push origin master || {
    echo -e "${RED}Error: No se pudo hacer push. Verifica tu conexión y permisos.${NC}"
    exit 1
}
echo -e "${GREEN}✓ Cambios subidos${NC}"

# 4. Detener servicios en la VM
echo -e "\n${YELLOW}[4/8] Deteniendo servicios en la VM...${NC}"
run_remote "cd ${REMOTE_DIR} && pkill -f 'node.*dist/src/main.js' || true"
run_remote "cd ${REMOTE_DIR} && pkill -f 'npm.*run.*start' || true"
sleep 2
echo -e "${GREEN}✓ Servicios detenidos${NC}"

# 5. Actualizar código en la VM
echo -e "\n${YELLOW}[5/8] Actualizando código en la VM...${NC}"
run_remote "cd ${REMOTE_DIR} && git pull origin main || git pull origin master"
echo -e "${GREEN}✓ Código actualizado${NC}"

# 6. Copiar archivo .env de producción
echo -e "\n${YELLOW}[6/8] Configurando variables de entorno de producción...${NC}"
run_remote "cd ${REMOTE_DIR} && cp .env.production .env"
echo -e "${GREEN}✓ Variables de entorno configuradas${NC}"

# 7. Instalar dependencias y compilar (optimizado para 2GB RAM)
echo -e "\n${YELLOW}[7/8] Instalando dependencias y compilando...${NC}"
run_remote "cd ${REMOTE_DIR} && export NODE_OPTIONS='--max-old-space-size=1536' && npm ci --production=false"
run_remote "cd ${REMOTE_DIR} && export NODE_OPTIONS='--max-old-space-size=1536' && npm run build"
echo -e "${GREEN}✓ Dependencias instaladas y código compilado${NC}"

# 8. Iniciar servicios con PM2
echo -e "\n${YELLOW}[8/8] Iniciando servicios con PM2...${NC}"
run_remote "cd ${REMOTE_DIR} && pm2 delete evolution-evento || true"
run_remote "cd ${REMOTE_DIR} && pm2 start npm --name 'evolution-evento' -- start -- --max-old-space-size=1536"
run_remote "pm2 save"
echo -e "${GREEN}✓ Servicios iniciados${NC}"

# Verificar estado
echo -e "\n${YELLOW}Verificando estado de los servicios...${NC}"
run_remote "pm2 status"

# Mostrar logs recientes
echo -e "\n${YELLOW}Últimas líneas de logs:${NC}"
run_remote "pm2 logs evolution-evento --lines 20 --nostream"

echo -e "\n${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              DESPLIEGUE COMPLETADO                     ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  URL: ${GREEN}https://evento.encuentra-facil.com${NC}            ${BLUE}║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Comandos útiles:                                     ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  - Ver logs:   ${YELLOW}pm2 logs evolution-evento${NC}            ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  - Reiniciar:  ${YELLOW}pm2 restart evolution-evento${NC}         ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  - Detener:    ${YELLOW}pm2 stop evolution-evento${NC}            ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  - Estado:     ${YELLOW}pm2 status${NC}                           ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
