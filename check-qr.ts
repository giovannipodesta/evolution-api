import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQRStatus() {
  try {
    const telefono = '593962888416';

    console.log(`🔍 Buscando información para el teléfono: ${telefono}\n`);

    // 1. Buscar en EventoRegistro (donde se guarda el estado del QR)
    const registro = await prisma.eventoRegistro.findFirst({
      where: {
        telefono: {
          contains: '962888416'
        }
      },
      include: {
        Instance: true
      }
    });

    if (registro) {
      console.log('✅ Registro encontrado en EventoRegistro:');
      console.log({
        id: registro.id,
        telefono: registro.telefono,
        mensajeEnviado: registro.mensajeEnviado,
        qrEnviado: registro.qrEnviado,
        qrCodigo: registro.qrCodigo,
        qrLeido: registro.qrLeido,
        createdAt: registro.createdAt,
        updatedAt: registro.updatedAt,
        instance: registro.Instance.name
      });
    } else {
      console.log('❌ No se encontró registro en EventoRegistro');
    }

    // 2. Buscar en logs o errores recientes (si hubiera una tabla de logs)

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkQRStatus();
