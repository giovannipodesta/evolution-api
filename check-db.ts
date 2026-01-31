import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('\n📊 === VERIFICACIÓN DE BASE DE DATOS ===\n');

    // Verificar registros
    const registros = await prisma.eventoRegistro.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { Instance: { select: { name: true } } },
    });

    console.log(`📝 REGISTROS (últimos 5):`);
    console.log(`Total encontrados: ${registros.length}\n`);
    
    registros.forEach((r, i) => {
      console.log(`${i + 1}. Teléfono: ${r.telefono}`);
      console.log(`   Instancia: ${r.Instance.name}`);
      console.log(`   Mensaje enviado: ${r.mensajeEnviado ? '✅' : '❌'}`);
      console.log(`   QR enviado: ${r.qrEnviado ? '✅' : '❌'}`);
      console.log(`   QR código: ${r.qrCodigo || 'N/A'}`);
      console.log(`   Creado: ${r.createdAt}`);
      console.log('');
    });

    // Verificar envíos programados
    const enviosProgramados = await prisma.eventoEnvioProgramado.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { Instance: { select: { name: true } } },
    });

    console.log(`\n⏰ ENVÍOS PROGRAMADOS (últimos 10):`);
    console.log(`Total encontrados: ${enviosProgramados.length}\n`);

    enviosProgramados.forEach((e, i) => {
      console.log(`${i + 1}. Teléfono: ${e.telefono}`);
      console.log(`   Instancia: ${e.Instance.name}`);
      console.log(`   URL: ${e.url}`);
      console.log(`   Estado: ${e.estado}`);
      console.log(`   Programado para: ${new Date(Number(e.timestampEnvio)).toISOString()}`);
      console.log(`   Intentos: ${e.intentos}`);
      if (e.ultimoError) console.log(`   Último error: ${e.ultimoError}`);
      if (e.enviadoAt) console.log(`   Enviado: ${e.enviadoAt}`);
      console.log(`   Creado: ${e.createdAt}`);
      console.log('');
    });

    // Estadísticas de envíos programados
    const stats = {
      pendientes: await prisma.eventoEnvioProgramado.count({ where: { estado: 'pendiente' } }),
      procesando: await prisma.eventoEnvioProgramado.count({ where: { estado: 'procesando' } }),
      enviados: await prisma.eventoEnvioProgramado.count({ where: { estado: 'enviado' } }),
      errores: await prisma.eventoEnvioProgramado.count({ where: { estado: 'error' } }),
      cancelados: await prisma.eventoEnvioProgramado.count({ where: { estado: 'cancelado' } }),
    };

    console.log('\n📈 ESTADÍSTICAS DE ENVÍOS PROGRAMADOS:');
    console.log(`   Pendientes: ${stats.pendientes}`);
    console.log(`   Procesando: ${stats.procesando}`);
    console.log(`   Enviados: ${stats.enviados}`);
    console.log(`   Errores: ${stats.errores}`);
    console.log(`   Cancelados: ${stats.cancelados}`);
    console.log(`   Total: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
