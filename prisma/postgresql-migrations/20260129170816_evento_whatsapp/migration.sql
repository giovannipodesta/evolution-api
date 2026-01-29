-- CreateTable
CREATE TABLE "EventoRegistro" (
    "id" TEXT NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "mensajeEnviado" BOOLEAN NOT NULL DEFAULT false,
    "mensajeRecibido" BOOLEAN NOT NULL DEFAULT false,
    "mensajeLeido" BOOLEAN NOT NULL DEFAULT false,
    "qrEnviado" BOOLEAN NOT NULL DEFAULT false,
    "qrLeido" BOOLEAN NOT NULL DEFAULT false,
    "qrCodigo" VARCHAR(100),
    "mensajeKey" VARCHAR(100),
    "qrKey" VARCHAR(100),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "EventoRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoRegistro_telefono_idx" ON "EventoRegistro"("telefono");

-- CreateIndex
CREATE INDEX "EventoRegistro_instanceId_idx" ON "EventoRegistro"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoRegistro_telefono_instanceId_key" ON "EventoRegistro"("telefono", "instanceId");

-- AddForeignKey
ALTER TABLE "EventoRegistro" ADD CONSTRAINT "EventoRegistro_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
