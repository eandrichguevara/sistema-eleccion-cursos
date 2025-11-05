import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStudent() {
  try {
    const student = await prisma.students.findUnique({
      where: {
        email: 'daniel.gil164@institucion.edu'
      },
      include: {
        selections: {
          include: {
            courses: true
          },
          orderBy: {
            preference_order: 'asc'
          }
        }
      }
    });

    if (!student) {
      console.log('❌ Estudiante no encontrado');
      return;
    }

    console.log(`\nEmail: ${student.email}`);
    console.log(`Nivel: ${student.level}° medio`);
    console.log(`\nSelecciones (${student.selections.length}):\n`);
    
    student.selections.forEach((sel, idx) => {
      console.log(`  ${idx + 1}. Prioridad ${sel.preference_order} - ${sel.courses.name} (Paralelo ${sel.courses.parallel})`);
    });

    // Agrupar por paralelo
    console.log('\n📊 Por paralelo:');
    const byParallel = {};
    student.selections.forEach(sel => {
      if (!byParallel[sel.courses.parallel]) {
        byParallel[sel.courses.parallel] = [];
      }
      byParallel[sel.courses.parallel].push(sel);
    });

    for (const [parallel, sels] of Object.entries(byParallel)) {
      console.log(`\n  Paralelo ${parallel} (${sels.length} selección/es):`);
      sels.forEach(sel => {
        console.log(`    - Prioridad ${sel.preference_order}: ${sel.courses.name}`);
      });
      
      // Verificar si las prioridades son correctas para este paralelo
      const priorities = sels.map(s => s.preference_order).sort((a, b) => a - b);
      const expectedPriorities = sels.map((_, i) => i + 1);
      const isCorrect = JSON.stringify(priorities) === JSON.stringify(expectedPriorities);
      console.log(`    ${isCorrect ? '✅' : '❌'} Prioridades ${isCorrect ? 'correctas' : 'INCORRECTAS'}: [${priorities.join(', ')}] (esperado: [${expectedPriorities.join(', ')}])`);
    }
    console.log('');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudent();
