import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Obtener estudiante neurodivergente
  const neurodivergent = await prisma.students.findFirst({
    where: { 
      role: 'student',
      is_neurodivergent: true 
    }
  });

  // Obtener estudiante de 4to medio no neurodivergente
  const fourthYear = await prisma.students.findFirst({
    where: { 
      role: 'student',
      level: 4,
      is_neurodivergent: false
    }
  });

  // Obtener estudiante de 3ro medio no neurodivergente
  const thirdYear = await prisma.students.findFirst({
    where: { 
      role: 'student',
      level: 3,
      is_neurodivergent: false
    }
  });

  console.log('🎯 EJEMPLOS POR PRIORIDAD:\n');
  
  if (neurodivergent) {
    console.log('⭐ MÁXIMA PRIORIDAD - Estudiante Neurodivergente:');
    console.log(`   📧 ${neurodivergent.email}`);
    console.log(`   🔑 estudiante123`);
    console.log(`   📚 ${neurodivergent.level}° medio`);
    console.log();
  }

  if (fourthYear) {
    console.log('🥈 PRIORIDAD ALTA - Estudiante 4to Medio:');
    console.log(`   📧 ${fourthYear.email}`);
    console.log(`   🔑 estudiante123`);
    console.log(`   📚 4° medio`);
    console.log();
  }

  if (thirdYear) {
    console.log('🥉 PRIORIDAD NORMAL - Estudiante 3ro Medio:');
    console.log(`   📧 ${thirdYear.email}`);
    console.log(`   🔑 estudiante123`);
    console.log(`   📚 3° medio`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
