import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAnaRamirez() {
  try {
    // Buscar estudiantes con ana.ramirez en su email
    const students = await prisma.students.findMany({
      where: {
        email: {
          contains: 'ana.ramirez'
        }
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

    console.log('\n📧 Estudiantes encontrados con "ana.ramirez":\n');
    
    for (const student of students) {
      console.log(`Email: ${student.email}`);
      console.log(`Nivel: ${student.level}° medio`);
      console.log(`Neurodivergente: ${student.is_neurodivergent ? 'Sí' : 'No'}`);
      console.log(`\nSelecciones (${student.selections.length}):`);
      
      if (student.selections.length === 0) {
        console.log('  ❌ Sin selecciones');
      } else {
        student.selections.forEach((sel, idx) => {
          console.log(`  ${idx + 1}. Prioridad ${sel.preference_order} - ${sel.courses.name} (Paralelo ${sel.courses.parallel})`);
        });
      }
      console.log('\n' + '='.repeat(60) + '\n');
    }

    if (students.length === 0) {
      console.log('❌ No se encontró ningún estudiante con "ana.ramirez" en el email\n');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAnaRamirez();
