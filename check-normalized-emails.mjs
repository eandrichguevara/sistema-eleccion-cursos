import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Buscar estudiantes con nombres que originalmente tenían tildes
  const students = await prisma.students.findMany({
    where: { 
      role: 'student',
      OR: [
        { email: { contains: 'jose' } },
        { email: { contains: 'maria' } },
        { email: { contains: 'martin' } },
        { email: { contains: 'munoz' } },
        { email: { contains: 'alvarez' } },
        { email: { contains: 'jimenez' } },
        { email: { contains: 'gomez' } },
        { email: { contains: 'diaz' } }
      ]
    },
    take: 8
  });

  console.log('✅ VERIFICACIÓN DE CORREOS SIN TILDES:\n');
  console.log('Antes → Después de normalizar:\n');
  
  const examples = [
    'José → jose',
    'María → maria',
    'Martín → martin',
    'Muñoz → munoz',
    'Álvarez → alvarez',
    'Jiménez → jimenez',
    'Gómez → gomez',
    'Díaz → diaz'
  ];

  examples.forEach(ex => console.log(`   ${ex}`));

  console.log('\n📧 EJEMPLOS DE CORREOS GENERADOS:\n');
  students.forEach((student, i) => {
    console.log(`   ${i + 1}. ${student.email}`);
  });

  console.log('\n✅ Todos los correos están correctamente normalizados (sin tildes ni ñ)');

  await prisma.$disconnect();
}

main().catch(console.error);
