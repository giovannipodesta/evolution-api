import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRegistro() {
  try {
    const registros = await prisma.eventoRegistro.findMany({
      where: {
        telefono: {
          endsWith: '377'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      include: {
        Instance: true
      }
    });

    console.log('Registros encontrados:', registros.length);
    registros.forEach(r => {
      console.log({
        telefono: r.telefono,
        mensajeEnviado: r.mensajeEnviado,
        qrEnviado: r.qrEnviado,
        createdAt: r.createdAt,
        instance: r.Instance.name
      });
    });

    // También buscar en envíos programados
    const envios = await prisma.eventoEnvioProgramado.findMany({
      where: {
        telefono: {
          endsWith: '377'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      include: {
        Instance: true
      }
    });

    console.log('\nEnvíos programados encontrados:', envios.length);
    envios.forEach(e => {
      console.log({
        id: e.id,
        telefono: e.telefono,
        url: e.url,
        timestampEnvio: Number(e.timestampEnvio),
        estado: e.estado,
        intentos: e.intentos,
        ultimoError: e.ultimoError,
        enviadoAt: e.enviadoAt,
        createdAt: e.createdAt,
        instance: e.Instance.name
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRegistro();
