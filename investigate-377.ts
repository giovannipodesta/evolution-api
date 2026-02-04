import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function investigateError() {
  try {
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

    console.log('📋 Detalles del envío fallido:');
    console.log({
      id: envio.id,
      telefono: envio.telefono,
      url: envio.url,
      timestampEnvio: new Date(Number(envio.timestampEnvio)).toISOString(),
      estado: envio.estado,
      intentos: envio.intentos,
      ultimoError: envio.ultimoError,
      enviadoAt: envio.enviadoAt,
      createdAt: envio.createdAt,
      instanceName: envio.Instance.name
    });

    // 2. Verificar estado de la instancia
    console.log('\n🔍 Verificando estado de la instancia...');
    try {
      const apiKey = process.env.AUTHENTICATION_API_KEY || process.env.API_KEY;
      const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';

      const response = await axios.get(`${serverUrl}/instance/connectionState/${envio.Instance.name}`, {
        headers: {
          'apikey': apiKey
        }
      });

      console.log('✅ Estado de la instancia:', response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('❌ Error al consultar instancia:', error.response?.data || error.message);
      } else {
        console.log('❌ Error:', error);
      }
    }

    // 3. Verificar si hay registro en EventoRegistro
    console.log('\n🔍 Verificando si existe registro previo...');
    const registro = await prisma.eventoRegistro.findFirst({
      where: {
        telefono: '593954815377'
      }
    });

    if (registro) {
      console.log('✅ Registro encontrado:', {
        telefono: registro.telefono,
        mensajeEnviado: registro.mensajeEnviado,
        qrEnviado: registro.qrEnviado,
        createdAt: registro.createdAt
      });
    } else {
      console.log('⚠️ No hay registro previo para este número');
    }

    // 4. Intentar validar el número
    console.log('\n🔍 Validando formato del número...');
    const phoneRegex = /^593\d{9}$/;
    if (phoneRegex.test(envio.telefono)) {
      console.log('✅ Formato del número es válido');
    } else {
      console.log('❌ Formato del número es inválido');
    }

  } catch (error) {
    console.error('❌ Error en investigación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateError();
