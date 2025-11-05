import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCourses() {
  try {
    const courses = await prisma.courses.findMany({
      orderBy: [
        { parallel: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('\n📚 Cursos en la base de datos:\n');
    
    let currentParallel = 0;
    courses.forEach(course => {
      if (course.parallel !== currentParallel) {
        currentParallel = course.parallel;
        console.log(`\n📖 Paralelo ${currentParallel}:`);
      }
      console.log(`  • ${course.name} (ID: ${course.id.substring(0, 8)}...)`);
    });
    console.log('');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCourses();
