import axios from 'axios';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function manualSend() {
  try {
    const apiKey = process.env.AUTHENTICATION_API_KEY || process.env.API_KEY;
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';

    console.log('📤 Intentando enviar mensaje directamente vía API...\n');
    console.log('Server URL:', serverUrl);
    console.log('API Key:', apiKey ? '***' + apiKey.slice(-4) : 'NO CONFIGURADA');

    // Intentar enviar un mensaje de texto directamente
    const response = await axios.post(
      `${serverUrl}/message/sendText/evento-ef`,
      {
        number: '593954815377',
        text: 'Prueba de mensaje desde script de diagnóstico'
      },
      {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Respuesta exitosa:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('\n❌ Error en la petición:');
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Message:', error.message);

      if (error.response?.data) {
        console.log('\n🔍 Detalles del error:');
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.log('\n❌ Error desconocido:', error);
    }
  }
}

manualSend();
