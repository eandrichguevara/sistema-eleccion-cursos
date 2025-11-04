import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAssignmentResults() {
	console.log("🔍 VERIFICANDO RESULTADOS DE LA ÚLTIMA ASIGNACIÓN\n");
	console.log("=".repeat(80));

	try {
		// 1. Verificar el último assignment_run
		const lastRun = await prisma.$queryRaw`
      SELECT * FROM assignment_runs 
      ORDER BY executed_at DESC 
      LIMIT 1
    `;

		if (lastRun && lastRun.length > 0) {
			const run = lastRun[0];
			console.log("\n📋 ÚLTIMO RUN:");
			console.log(`   ID: ${run.id}`);
			console.log(`   Status: ${run.metadata?.status || "unknown"}`);
			console.log(`   Ejecutado: ${run.executed_at}`);
			console.log(`   Metadata:`, JSON.stringify(run.metadata, null, 2));
		}

		// 2. Verificar assignment_logs de problemas
		const problemLogs = await prisma.$queryRaw`
      SELECT * FROM assignment_logs 
      WHERE event_type = 'assignment_conflict'
      ORDER BY created_at DESC
      LIMIT 10
    `;

		if (problemLogs && problemLogs.length > 0) {
			console.log(`\n⚠️  PROBLEMAS DETECTADOS (${problemLogs.length}):`);
			problemLogs.forEach((log, i) => {
				console.log(
					`\n   ${i + 1}. Estudiante: ${log.student_email || log.student_id}`
				);
				console.log(`      Detalles:`, JSON.stringify(log.details, null, 2));
			});
		}

		// 3. Verificar estudiantes sin 3 asignaciones
		const studentAssignments = await prisma.$queryRaw`
      SELECT 
        s.id,
        s.email,
        s.level,
        s.is_neurodivergent,
        COUNT(a.id)::int as assignment_count,
        json_agg(json_build_object(
          'course', c.name,
          'parallel', c.parallel,
          'preference', a.preference_order
        )) as assignments
      FROM students s
      LEFT JOIN assignments a ON a.student_id = s.id
      LEFT JOIN courses c ON c.id = a.course_id
      WHERE s.role = 'student'
      GROUP BY s.id, s.email, s.level, s.is_neurodivergent
      HAVING COUNT(a.id) < 3
      ORDER BY s.email
    `;

		if (studentAssignments && studentAssignments.length > 0) {
			console.log(
				`\n❌ ESTUDIANTES SIN 3 CURSOS (${studentAssignments.length}):`
			);
			studentAssignments.slice(0, 10).forEach((s, i) => {
				console.log(`\n   ${i + 1}. ${s.email}`);
				console.log(`      Level: ${s.level}, Neuro: ${s.is_neurodivergent}`);
				console.log(`      Cursos asignados: ${s.assignment_count}/3`);
				console.log(
					`      Asignaciones:`,
					JSON.stringify(s.assignments, null, 2)
				);
			});
		} else {
			console.log("\n✅ TODOS LOS ESTUDIANTES TIENEN 3 CURSOS");
		}

		// 4. Verificar capacidades de cursos
		const courseCapacities = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.name,
        c.parallel,
        c.capacity,
        COUNT(a.id)::int as assigned_count,
        (c.capacity - COUNT(a.id)::int) as available
      FROM courses c
      LEFT JOIN assignments a ON a.course_id = c.id
      GROUP BY c.id, c.name, c.parallel, c.capacity
      ORDER BY c.parallel, c.name
    `;

		console.log("\n📊 CAPACIDADES DE CURSOS:");
		[1, 2, 3].forEach((parallel) => {
			console.log(`\n   PARALELO ${parallel}:`);
			courseCapacities
				.filter((c) => c.parallel === parallel)
				.forEach((c) => {
					const utilization = Math.round((c.assigned_count / c.capacity) * 100);
					const status =
						c.assigned_count > c.capacity
							? "⚠️ SOBRECUPO"
							: c.available === 0
							? "🔴 LLENO"
							: c.available < 5
							? "🟡 CASI LLENO"
							: "🟢 DISPONIBLE";
					console.log(
						`      ${status} ${c.name}: ${c.assigned_count}/${c.capacity} (${utilization}%) - Libres: ${c.available}`
					);
				});
		});

		// 5. Verificar sorteos ejecutados
		const lotteriesCount = await prisma.lotteries.count();
		console.log(`\n🎲 SORTEOS EJECUTADOS: ${lotteriesCount}`);

		if (lotteriesCount > 0) {
			const lotteries = await prisma.lotteries.findMany({
				take: 5,
				orderBy: { executed_at: "desc" },
				include: {
					lottery_results: {
						select: {
							student_email: true,
							won: true,
						},
					},
				},
			});

			console.log("\n   Últimos 5 sorteos:");
			lotteries.forEach((l, i) => {
				const winners = l.lottery_results.filter((r) => r.won).length;
				const losers = l.lottery_results.filter((r) => !r.won).length;
				console.log(
					`   ${i + 1}. ${l.course_name} (P${l.parallel}, Pref ${l.preference})`
				);
				console.log(
					`      Candidatos: ${l.candidates}, Cupos: ${l.available_spots}`
				);
				console.log(`      Ganadores: ${winners}, Perdedores: ${losers}`);
			});
		}
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

checkAssignmentResults();
