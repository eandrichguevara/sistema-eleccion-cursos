#!/usr/bin/env tsx

/**
 * Script para ejecutar el algoritmo de asignación de cursos
 *
 * Uso:
 *   npm run assign:test
 *   o
 *   npx tsx scripts/run-assignment.ts
 *
 * Este script ejecuta el algoritmo completo de asignación que:
 * 1. Prioriza estudiantes neurodivergentes
 * 2. Luego estudiantes de 4to medio
 * 3. Finalmente estudiantes de 3ro medio
 *
 * Para cada grupo asigna por paralelo con sorteos automáticos
 */

import { executeAssignmentAlgorithm } from "../src/lib/course-assignment";

async function main() {
	console.log("\n🚀 INICIANDO ASIGNACIÓN DE CURSOS\n");
	console.log("═══════════════════════════════════════\n");

	try {
		const result = await executeAssignmentAlgorithm();

		if (result.success) {
			console.log("\n\n═══════════════════════════════════════");
			console.log("✅ ASIGNACIÓN COMPLETADA CON ÉXITO");
			console.log("═══════════════════════════════════════\n");

			console.log("📊 ESTADÍSTICAS FINALES:\n");
			console.log(`📚 Total de estudiantes: ${result.stats.totalStudents}`);
			console.log(`✅ Total de asignaciones: ${result.stats.totalAssignments}`);
			console.log(
				`   • Neurodivergentes: ${result.stats.neurodivergentAssignments} cursos`
			);
			console.log(
				`   • 4to medio: ${result.stats.fourthYearAssignments} cursos`
			);
			console.log(
				`   • 3ro medio: ${result.stats.thirdYearAssignments} cursos`
			);
			console.log(`\n🎲 Sorteos ejecutados: ${result.stats.lotteriesExecuted}`);
			console.log(
				`\n👥 Estudiantes completamente asignados: ${result.stats.studentsFullyAssigned}/${result.stats.totalStudents}`
			);
			console.log(
				`   Parcialmente asignados: ${result.stats.studentsPartiallyAssigned}`
			);
			console.log(
				`   Sin asignar: ${
					result.stats.totalStudents -
					result.stats.studentsFullyAssigned -
					result.stats.studentsPartiallyAssigned
				}`
			);

			const completionRate = Math.round(
				(result.stats.studentsFullyAssigned / result.stats.totalStudents) * 100
			);
			console.log(`\n📈 Tasa de asignación completa: ${completionRate}%`);

			if (completionRate < 100) {
				console.log(
					"\n⚠️  ADVERTENCIA: No todos los estudiantes fueron asignados completamente."
				);
				console.log(
					"   Verifica la capacidad de los cursos y las selecciones de los estudiantes."
				);
			}

			process.exit(0);
		} else {
			console.error("\n❌ ERROR EN LA ASIGNACIÓN\n");
			console.error(`Mensaje: ${result.message}`);
			process.exit(1);
		}
	} catch (error) {
		console.error("\n\n═══════════════════════════════════════");
		console.error("💥 ERROR FATAL");
		console.error("═══════════════════════════════════════\n");
		console.error(error);
		process.exit(1);
	}
}

main();
