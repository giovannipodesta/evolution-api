import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteInstance() {
  try {
    const result = await prisma.instance.deleteMany({
      where: { name: 'evento-ef' },
    });
    console.log(`Instancia eliminada: ${result.count} registros`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteInstance();
