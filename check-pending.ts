import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPending() {
  try {
    const envios = await prisma.eventoEnvioProgramado.findMany({
      where: {
        telefono: {
          contains: '962888416'
        }
      },
      include: {
        Instance: true
      }
    });

    console.log('Envíos programados encontrados:', envios.length);
    envios.forEach(e => {
      console.log({
        id: e.id,
        telefono: e.telefono,
        estado: e.estado,
        error: e.ultimoError,
        timestamp: new Date(Number(e.timestampEnvio)).toISOString()
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPending();
