import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function retryEnvio() {
  try {
    const apiKey = process.env.AUTHENTICATION_API_KEY || process.env.API_KEY;
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';

    console.log('🔄 Reintentando envío al 593954815377...\n');

    // 1. Obtener el envío fallido
    const envio = await prisma.eventoEnvioProgramado.findFirst({
      where: {
        telefono: '593954815377'
      },
      include: {
        Instance: true
      }
    });

    if (!envio) {
      console.log('❌ No se encontró el envío');
      return;
    }

    console.log('📋 Envío encontrado:', {
      id: envio.id,
      telefono: envio.telefono,
      estado: envio.estado,
      instanceName: envio.Instance.name
    });

    // 2. Marcar como pendiente para que se reintente
    console.log('\n🔄 Marcando envío como pendiente...');
    await prisma.eventoEnvioProgramado.update({
      where: { id: envio.id },
      data: {
        estado: 'pendiente',
        intentos: 0,
        ultimoError: null,
        // Programar para dentro de 5 segundos
        timestampEnvio: BigInt(Date.now() + 5000)
      }
    });

    console.log('✅ Envío marcado como pendiente. Se ejecutará en 5 segundos...');
    console.log('\n⏳ Esperando 10 segundos para ver el resultado...');

    // Esperar 10 segundos
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 3. Verificar el resultado
    const resultado = await prisma.eventoEnvioProgramado.findUnique({
      where: { id: envio.id }
    });

    console.log('\n📊 Resultado del reintento:');
    console.log({
      estado: resultado?.estado,
      intentos: resultado?.intentos,
      ultimoError: resultado?.ultimoError,
      enviadoAt: resultado?.enviadoAt,
      mensajeKey: resultado?.mensajeKey
    });

    if (resultado?.estado === 'enviado') {
      console.log('\n✅ ¡Envío exitoso!');
    } else if (resultado?.estado === 'error') {
      console.log('\n❌ Error en el envío:');
      console.log(resultado.ultimoError);
    } else {
      console.log('\n⚠️ Estado:', resultado?.estado);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

retryEnvio();
