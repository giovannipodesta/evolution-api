#!/bin/bash

# Script para levantar Evolution API + Evento API sin Docker
# Usa: ./start-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVOLUTION_DIR="$SCRIPT_DIR"
EVENTO_API_DIR="$SCRIPT_DIR/evento-api"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Iniciando Evolution API + Evento API               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# Función para matar procesos existentes
cleanup() {
    echo -e "\n${YELLOW}Deteniendo servicios...${NC}"
    pkill -f "tsx.*main.ts" 2>/dev/null || true
    pkill -f "node.*evento-api" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}Servicios detenidos${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 1. Verificar PostgreSQL (usa lsof ya que pg_isready puede no estar en PATH)
echo -e "\n${YELLOW}[1/4] Verificando PostgreSQL...${NC}"
if lsof -i :5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL está corriendo en puerto 5432${NC}"
else
    echo -e "${RED}✗ PostgreSQL no está corriendo en puerto 5432${NC}"
    echo -e "${YELLOW}Inicia PostgreSQL manualmente: brew services start postgresql@17${NC}"
    exit 1
fi

# 2. Matar procesos existentes en los puertos
echo -e "\n${YELLOW}[2/4] Liberando puertos...${NC}"
lsof -ti:8080 | xargs kill -9 2>/dev/null && echo "Puerto 8080 liberado" || true
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "Puerto 3001 liberado" || true
echo -e "${GREEN}✓ Puertos listos${NC}"

# 3. Iniciar Evolution API (puerto 8080)
echo -e "\n${YELLOW}[3/4] Iniciando Evolution API (puerto 8080)...${NC}"
cd "$EVOLUTION_DIR"
export DATABASE_PROVIDER=postgresql
npm run dev:server > /tmp/evolution-api.log 2>&1 &
EVOLUTION_PID=$!
echo -e "${GREEN}✓ Evolution API iniciado (PID: $EVOLUTION_PID)${NC}"

# Esperar a que Evolution API esté listo
echo -n "Esperando que Evolution API responda"
for i in {1..30}; do
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "\n${GREEN}✓ Evolution API listo en http://localhost:8080${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# 4. Iniciar Evento API (puerto 3001)
echo -e "\n${YELLOW}[4/4] Iniciando Evento API (puerto 3001)...${NC}"
cd "$EVENTO_API_DIR"
npm run dev > /tmp/evento-api.log 2>&1 &
EVENTO_PID=$!
echo -e "${GREEN}✓ Evento API iniciado (PID: $EVENTO_PID)${NC}"

sleep 2

# Resumen
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    SERVICIOS ACTIVOS                   ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Evolution API: ${GREEN}http://localhost:8080${NC}               ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Evento API:    ${GREEN}http://localhost:3001${NC}               ${BLUE}║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Logs Evolution: ${YELLOW}tail -f /tmp/evolution-api.log${NC}    ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Logs Evento:    ${YELLOW}tail -f /tmp/evento-api.log${NC}       ${BLUE}║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Presiona ${RED}Ctrl+C${NC} para detener ambos servicios        ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# Mantener el script corriendo y mostrar logs
wait
