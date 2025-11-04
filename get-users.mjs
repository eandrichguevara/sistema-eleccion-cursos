import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Obtener admin
  const admin = await prisma.students.findFirst({
    where: { role: 'admin' }
  });

  // Obtener 5 estudiantes de ejemplo
  const students = await prisma.students.findMany({
    where: { role: 'student' },
    take: 5,
    orderBy: { email: 'asc' }
  });

  console.log('🔐 CREDENCIALES DE ACCESO:\n');
  
  if (admin) {
    console.log('👨‍💼 ADMINISTRADOR:');
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   🔑 Contraseña: admin123`);
    console.log();
  }

  console.log('👨‍🎓 ESTUDIANTES (5 ejemplos):');
  students.forEach((student, i) => {
    const priority = student.is_neurodivergent ? '⭐ Neurodivergente' : '';
    const level = `${student.level}° medio`;
    console.log(`   ${i + 1}. 📧 ${student.email}`);
    console.log(`      🔑 Contraseña: estudiante123`);
    console.log(`      📚 Nivel: ${level} ${priority}`);
    console.log();
  });

  await prisma.$disconnect();
}

main().catch(console.error);
