import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearEventoDB() {
  try {
    console.log('⚠️ INICIANDO LIMPIEZA DE BASE DE DATOS DEL EVENTO ⚠️');
    console.log('Esto borrará TODOS los registros de "EventoRegistro" y "EventoEnvioProgramado".');
    console.log('NO se borrarán las instancias ni las sesiones.\n');

    // 1. Borrar EventoEnvioProgramado
    const deletedEnvios = await prisma.eventoEnvioProgramado.deleteMany({});
    console.log(`✅ Borrados ${deletedEnvios.count} registros de EventoEnvioProgramado`);

    // 2. Borrar EventoRegistro
    const deletedRegistros = await prisma.eventoRegistro.deleteMany({});
    console.log(`✅ Borrados ${deletedRegistros.count} registros de EventoRegistro`);

    console.log('\n🎉 Limpieza completada exitosamente.');

  } catch (error) {
    console.error('❌ Error al limpiar la base de datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearEventoDB();
