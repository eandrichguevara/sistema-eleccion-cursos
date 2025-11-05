import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPartialSelections() {
  try {
    // Obtener estudiantes con selecciones parciales (1 o 2 selecciones)
    const allStudents = await prisma.students.findMany({
      where: {
        role: 'student'
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

    // Filtrar estudiantes con 1 o 2 selecciones
    const partialStudents = allStudents.filter(s => s.selections.length > 0 && s.selections.length < 3);

    console.log(`\n📊 Encontrados ${partialStudents.length} estudiantes con selecciones parciales (1 o 2)\n`);
    
    // Mostrar los primeros 10
    for (const student of partialStudents.slice(0, 10)) {
      console.log(`Email: ${student.email}`);
      console.log(`Selecciones (${student.selections.length}):`);
      
      student.selections.forEach((sel, idx) => {
        console.log(`  ${idx + 1}. Prioridad ${sel.preference_order} - ${sel.courses.name} (Paralelo ${sel.courses.parallel})`);
      });
      
      // Verificar si las prioridades son correctas
      const priorities = student.selections.map(s => s.preference_order).sort((a, b) => a - b);
      const expectedPriorities = student.selections.map((_, i) => i + 1);
      const isCorrect = JSON.stringify(priorities) === JSON.stringify(expectedPriorities);
      
      console.log(`  ${isCorrect ? '✅' : '❌'} Prioridades ${isCorrect ? 'correctas' : 'INCORRECTAS'}: [${priorities.join(', ')}] (esperado: [${expectedPriorities.join(', ')}])`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPartialSelections();
