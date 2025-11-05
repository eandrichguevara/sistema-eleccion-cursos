import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showExamples() {
  try {
    const students = await prisma.students.findMany({
      where: {
        role: 'student'
      },
      include: {
        selections: {
          include: {
            courses: true
          },
          orderBy: [
            { courses: { parallel: 'asc' } },
            { preference_order: 'asc' }
          ]
        }
      },
      take: 5
    });

    console.log('\n📋 Ejemplos de selecciones de estudiantes:\n');
    
    for (const student of students) {
      if (student.selections.length === 0) continue;
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Email: ${student.email}`);
      console.log(`Total de selecciones: ${student.selections.length}`);
      
      // Agrupar por paralelo
      const byParallel = {};
      student.selections.forEach(sel => {
        if (!byParallel[sel.courses.parallel]) {
          byParallel[sel.courses.parallel] = [];
        }
        byParallel[sel.courses.parallel].push(sel);
      });

      for (const [parallel, sels] of Object.entries(byParallel).sort()) {
        console.log(`\n  📚 Paralelo ${parallel}:`);
        sels.forEach(sel => {
          console.log(`    ${sel.preference_order}° - ${sel.courses.name}`);
        });
      }
    }
    console.log(`\n${'='.repeat(70)}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showExamples();
