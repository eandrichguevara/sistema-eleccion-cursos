import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPriorities() {
  try {
    const allStudents = await prisma.students.findMany({
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
      }
    });

    console.log('\n🔍 Verificando prioridades de todos los estudiantes...\n');
    
    let totalStudents = 0;
    let correctStudents = 0;
    let incorrectStudents = 0;
    const errors = [];

    for (const student of allStudents) {
      if (student.selections.length === 0) continue;
      
      totalStudents++;
      
      // Agrupar por paralelo
      const byParallel = {};
      student.selections.forEach(sel => {
        if (!byParallel[sel.courses.parallel]) {
          byParallel[sel.courses.parallel] = [];
        }
        byParallel[sel.courses.parallel].push(sel);
      });

      // Verificar que cada paralelo tenga prioridades correctas
      let studentIsCorrect = true;
      for (const [parallel, sels] of Object.entries(byParallel)) {
        const priorities = sels.map(s => s.preference_order).sort((a, b) => a - b);
        const expectedPriorities = sels.map((_, i) => i + 1);
        const isCorrect = JSON.stringify(priorities) === JSON.stringify(expectedPriorities);
        
        if (!isCorrect) {
          studentIsCorrect = false;
          errors.push({
            email: student.email,
            parallel,
            priorities,
            expectedPriorities,
            courses: sels.map(s => s.courses.name)
          });
        }
      }
      
      if (studentIsCorrect) {
        correctStudents++;
      } else {
        incorrectStudents++;
      }
    }

    console.log(`✅ Estudiantes con prioridades correctas: ${correctStudents}/${totalStudents}`);
    console.log(`❌ Estudiantes con prioridades incorrectas: ${incorrectStudents}/${totalStudents}`);

    if (errors.length > 0) {
      console.log('\n⚠️  ERRORES ENCONTRADOS:\n');
      errors.slice(0, 10).forEach(err => {
        console.log(`Email: ${err.email}`);
        console.log(`  Paralelo ${err.parallel}:`);
        console.log(`  Cursos: ${err.courses.join(', ')}`);
        console.log(`  Prioridades: [${err.priorities.join(', ')}] (esperado: [${err.expectedPriorities.join(', ')}])`);
        console.log('');
      });
      if (errors.length > 10) {
        console.log(`... y ${errors.length - 10} errores más\n`);
      }
    } else {
      console.log('\n🎉 ¡Todas las prioridades están correctas!\n');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPriorities();
