import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎲 SORTEOS EJECUTADOS:\n');
  
  const lotteries = await prisma.lotteries.findMany({
    include: {
      lottery_results: {
        orderBy: {
          won: 'desc'
        }
      }
    },
    orderBy: {
      course_name: 'asc'
    }
  });

  for (const lottery of lotteries) {
    const winners = lottery.lottery_results.filter(r => r.won);
    const losers = lottery.lottery_results.filter(r => !r.won);
    
    console.log(`📊 ${lottery.course_name} (Paralelo ${lottery.parallel}, Preferencia ${lottery.preference})`);
    console.log(`   👥 Candidatos: ${lottery.candidates}`);
    console.log(`   🎫 Cupos disponibles: ${lottery.available_spots}`);
    console.log(`   ✅ Ganadores: ${winners.length}`);
    console.log(`   ❌ No seleccionados: ${losers.length}`);
    console.log(`   📧 Algunos ganadores: ${winners.slice(0, 3).map(w => w.student_email.split('@')[0]).join(', ')}${winners.length > 3 ? '...' : ''}`);
    console.log();
  }

  // Estadísticas generales
  const assignments = await prisma.assignments.findMany();
  const totalByPreference = {};
  assignments.forEach(a => {
    const pref = a.preference_order === 99 ? 'disponibilidad' : `${a.preference_order}ª`;
    totalByPreference[pref] = (totalByPreference[pref] || 0) + 1;
  });

  console.log('\n📈 DISTRIBUCIÓN DE PREFERENCIAS ASIGNADAS:');
  Object.entries(totalByPreference).sort((a, b) => {
    if (a[0] === 'disponibilidad') return 1;
    if (b[0] === 'disponibilidad') return -1;
    return a[0].localeCompare(b[0]);
  }).forEach(([pref, count]) => {
    const percent = ((count / assignments.length) * 100).toFixed(1);
    console.log(`   ${pref.padEnd(15)}: ${count.toString().padStart(3)} asignaciones (${percent}%)`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
