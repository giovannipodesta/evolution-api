-- CreateEnum
CREATE TYPE "EventoEnvioEstado" AS ENUM ('pendiente', 'procesando', 'enviado', 'error', 'cancelado');

-- CreateTable
CREATE TABLE "EventoEnvioProgramado" (
    "id" TEXT NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "timestampEnvio" BIGINT NOT NULL,
    "estado" "EventoEnvioEstado" NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "mensajeKey" VARCHAR(100),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "enviadoAt" TIMESTAMP,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "EventoEnvioProgramado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoEnvioProgramado_telefono_idx" ON "EventoEnvioProgramado"("telefono");

-- CreateIndex
CREATE INDEX "EventoEnvioProgramado_instanceId_idx" ON "EventoEnvioProgramado"("instanceId");

-- CreateIndex
CREATE INDEX "EventoEnvioProgramado_estado_idx" ON "EventoEnvioProgramado"("estado");

-- CreateIndex
CREATE INDEX "EventoEnvioProgramado_timestampEnvio_idx" ON "EventoEnvioProgramado"("timestampEnvio");

-- CreateIndex
CREATE UNIQUE INDEX "EventoEnvioProgramado_telefono_timestampEnvio_instanceId_key" ON "EventoEnvioProgramado"("telefono", "timestampEnvio", "instanceId");

-- AddForeignKey
ALTER TABLE "EventoEnvioProgramado" ADD CONSTRAINT "EventoEnvioProgramado_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
