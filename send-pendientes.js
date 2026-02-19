const { PrismaClient } = require('.prisma/client');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:8080';
const API_KEY = 'evento2025secret';
const INSTANCE = 'evento-prod';
const TEXTO = 'Los esperamos a todos el día de mañana en el evento';
const DELAY_ENTRE_MS = 6000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendImage(phone) {
  const imgPath = path.join(__dirname, 'public/evento/location.jpeg');
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');
  const res = await fetch(`${API_URL}/message/sendMedia/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({ number: phone, mediatype: 'image', media: imgBase64, caption: '📍 Cómo llegar al evento' }),
  });
  const d = await res.json();
  if (!d.key) throw new Error(JSON.stringify(d));
  return d.key.id;
}

async function sendText(phone) {
  const res = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({ number: phone, text: TEXTO }),
  });
  const d = await res.json();
  if (!d.key) throw new Error(JSON.stringify(d));
  return d.key.id;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const pendientes = await prisma.eventoRegistro.findMany({
      where: { qrEnviado: true, locationEnviada: false },
    });

    console.log(`\nPendientes (QR=si, location=no): ${pendientes.length}`);
    if (!pendientes.length) {
      console.log('Nada que enviar.');
      return;
    }

    let ok = 0, err = 0;
    for (let i = 0; i < pendientes.length; i++) {
      const r = pendientes[i];
      console.log(`\n[${i + 1}/${pendientes.length}] ${r.telefono}`);
      try {
        await sendImage(r.telefono);
        console.log('  imagen OK');
        await sleep(2500);
        await sendText(r.telefono);
        console.log('  texto OK');
        await prisma.eventoRegistro.update({ where: { id: r.id }, data: { locationEnviada: true } });
        ok++;
      } catch (e) {
        console.log('  ERROR:', e.message);
        err++;
      }
      if (i < pendientes.length - 1) {
        console.log(`  esperando ${DELAY_ENTRE_MS / 1000}s...`);
        await sleep(DELAY_ENTRE_MS);
      }
    }
    console.log(`\nCompletado: ${ok} OK, ${err} errores`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
