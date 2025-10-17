import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script para visualizar todos los sorteos registrados
 * Muestra información detallada de cada sorteo realizado durante la asignación
 */
async function viewLotteries() {
	console.log("🎲 REGISTRO DE SORTEOS - AUDITORÍA");
	console.log("=".repeat(80));
	console.log();

	try {
		// Obtener todos los sorteos con sus resultados
		const lotteries = await prisma.lottery.findMany({
			include: {
				lottery_results: {
					orderBy: {
						won: "desc", // Ganadores primero
					},
				},
			},
			orderBy: {
				executed_at: "asc",
			},
		});

		if (lotteries.length === 0) {
			console.log("✅ No se registraron sorteos en la última asignación.");
			console.log(
				"   Esto significa que todos los cursos tenían suficiente capacidad"
			);
			console.log("   para satisfacer la demanda sin necesidad de desempate.");
			console.log();
			return;
		}

		console.log(`📋 Total de sorteos realizados: ${lotteries.length}\n`);

		lotteries.forEach((lottery, index) => {
			const winners = lottery.lottery_results.filter((r) => r.won).length;
			const losers = lottery.lottery_results.filter((r) => !r.won).length;

			console.log(`🎲 SORTEO #${index + 1}`);
			console.log("─".repeat(80));
			console.log(
				`   📚 Curso: ${lottery.course_name} (Paralelo ${lottery.parallel})`
			);
			console.log(`   🎯 Preferencia: ${lottery.preference}ª`);
			console.log(`   👥 Candidatos: ${lottery.candidates}`);
			console.log(`   🎟️  Cupos disponibles: ${lottery.available_spots}`);
			console.log(`   📅 Fecha: ${lottery.executed_at.toLocaleString()}`);
			console.log();

			console.log(`   ✅ Ganadores (${winners}):`);
			const winnersList = lottery.lottery_results
				.filter((r) => r.won)
				.map((r) => r.student_email);

			// Mostrar max 10 ganadores
			const displayWinners = winnersList.slice(0, 10);
			displayWinners.forEach((email) => {
				console.log(`      ✓ ${email}`);
			});
			if (winnersList.length > 10) {
				console.log(`      ... y ${winnersList.length - 10} más`);
			}

			console.log();
			console.log(`   ❌ No seleccionados (${losers}):`);
			const losersList = lottery.lottery_results
				.filter((r) => !r.won)
				.map((r) => r.student_email);

			// Mostrar max 10 perdedores
			const displayLosers = losersList.slice(0, 10);
			displayLosers.forEach((email) => {
				console.log(`      ✗ ${email}`);
			});
			if (losersList.length > 10) {
				console.log(`      ... y ${losersList.length - 10} más`);
			}

			console.log();
			console.log();
		});

		// Estadísticas generales
		console.log("📊 ESTADÍSTICAS DE SORTEOS");
		console.log("=".repeat(80));

		const totalCandidates = lotteries.reduce((sum, l) => sum + l.candidates, 0);
		const totalWinners = lotteries.reduce(
			(sum, l) => sum + l.available_spots,
			0
		);
		const totalLosers = totalCandidates - totalWinners;

		console.log(`   • Total de candidatos en sorteos: ${totalCandidates}`);
		console.log(`   • Total de ganadores: ${totalWinners}`);
		console.log(`   • Total de no seleccionados: ${totalLosers}`);
		console.log(
			`   • Tasa de éxito promedio: ${(
				(totalWinners / totalCandidates) *
				100
			).toFixed(1)}%`
		);
		console.log();

		// Sorteos por curso
		const courseStats = new Map<string, number>();
		lotteries.forEach((l) => {
			const key = `${l.course_name} (P${l.parallel})`;
			courseStats.set(key, (courseStats.get(key) || 0) + 1);
		});

		console.log("   Sorteos por curso:");
		Array.from(courseStats.entries())
			.sort((a, b) => b[1] - a[1])
			.forEach(([course, count]) => {
				console.log(`      • ${course}: ${count} sorteo(s)`);
			});

		console.log();
		console.log("✅ Consulta completada");
	} catch (error) {
		console.error("❌ Error al consultar sorteos:", error);
	} finally {
		await prisma.$disconnect();
	}
}

// Ejecutar el script
viewLotteries();
