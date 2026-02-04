#!/bin/bash

# Script para limpiar la base de datos de eventos en GCloud VM

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración - AJUSTA ESTOS VALORES
VM_NAME="evolution-evento"
VM_ZONE="us-east4-a"
PROJECT_ID="encuentra-facil-5501a"
REMOTE_USER="encuentrafacil"
REMOTE_DIR="/home/${REMOTE_USER}/evento-whatsapp"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Limpiando Base de Datos en GCloud VM              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}⚠️  ADVERTENCIA: Esto borrará TODOS los registros de eventos${NC}"
echo -e "${YELLOW}    en la base de datos de producción en GCloud.${NC}"
echo -e "\n${RED}¿Estás seguro? (escribe 'SI' para continuar)${NC}"
read -r confirmation

if [ "$confirmation" != "SI" ]; then
    echo -e "${YELLOW}Operación cancelada.${NC}"
    exit 0
fi

echo -e "\n${YELLOW}Ejecutando script de limpieza en la VM...${NC}"

# Ejecutar el script de limpieza en la VM
gcloud compute ssh ${REMOTE_USER}@${VM_NAME} \
    --zone=${VM_ZONE} \
    --project=${PROJECT_ID} \
    --command="cd ${REMOTE_DIR} && npx tsx clear-evento-db.ts"

echo -e "\n${GREEN}✅ Base de datos limpiada exitosamente en GCloud${NC}"
