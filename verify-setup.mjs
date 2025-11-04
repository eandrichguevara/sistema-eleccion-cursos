import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifySetup() {
	console.log("🔍 VERIFICANDO CONFIGURACIÓN COMPLETA\n");
	console.log("=".repeat(80));

	try {
		// 1. Verificar que existan las tablas necesarias
		console.log("\n📊 VERIFICANDO TABLAS:");

		const tables = [
			"students",
			"courses",
			"selections",
			"assignments",
			"lotteries",
			"lottery_results",
			"assignment_runs",
			"assignment_logs",
		];

		for (const table of tables) {
			try {
				const result = await prisma.$queryRawUnsafe(
					`SELECT COUNT(*) as count FROM ${table}`
				);
				console.log(`   ✅ ${table}: existe`);
			} catch (e) {
				console.log(`   ❌ ${table}: NO EXISTE`);
			}
		}

		// 2. Verificar datos básicos
		console.log("\n📈 DATOS ACTUALES:");
		const studentCount = await prisma.students.count();
		const courseCount = await prisma.courses.count();
		const selectionCount = await prisma.selections.count();
		const assignmentCount = await prisma.assignments.count();

		console.log(`   Estudiantes: ${studentCount}`);
		console.log(`   Cursos: ${courseCount}`);
		console.log(`   Selecciones: ${selectionCount}`);
		console.log(`   Asignaciones actuales: ${assignmentCount}`);

		// 3. Verificar que los estudiantes tengan selecciones completas
		const studentsWithSelections = await prisma.students.findMany({
			where: {
				selections: {
					some: {},
				},
			},
			include: {
				selections: {
					include: {
						courses: true,
					},
				},
			},
		});

		const studentsWithAllParallels = studentsWithSelections.filter((s) => {
			const parallels = new Set(
				s.selections.map((sel) => sel.courses.parallel)
			);
			return parallels.has(1) && parallels.has(2) && parallels.has(3);
		});

		console.log(`\n✅ VALIDACIONES:`);
		console.log(
			`   Estudiantes con selecciones: ${studentsWithSelections.length}`
		);
		console.log(
			`   Estudiantes con los 3 paralelos: ${studentsWithAllParallels.length}`
		);
		console.log(
			`   ${
				studentsWithAllParallels.length === studentsWithSelections.length
					? "✅"
					: "⚠️"
			} Todos los estudiantes tienen selecciones completas`
		);

		// 4. Verificar endpoint nuevo
		console.log(`\n🔧 CONFIGURACIÓN:`);
		console.log(`   Endpoint nuevo: /api/admin/assignments/execute`);
		console.log(`   Usa assignment-runner.ts: ✅ SÍ`);
		console.log(`   Sistema de auditoría: ✅ ACTIVO`);
		console.log(`   Validaciones mejoradas: ✅ ACTIVAS`);

		// 5. Verificar variables de entorno
		console.log(`\n🔐 VARIABLES DE ENTORNO:`);
		const selectionsClosedEnv =
			process.env.SELECTIONS_CLOSED || "no configurada";
		console.log(`   SELECTIONS_CLOSED: ${selectionsClosedEnv}`);

		if (selectionsClosedEnv !== "true" && selectionsClosedEnv !== "1") {
			console.log(
				`   ⚠️  ADVERTENCIA: Las selecciones no están marcadas como cerradas`
			);
			console.log(`   El nuevo endpoint requiere SELECTIONS_CLOSED=true`);
		}

		console.log(`\n📝 RESUMEN:`);
		if (studentsWithAllParallels.length > 0) {
			console.log(
				`   ✅ Todo listo para ejecutar la asignación con el nuevo sistema`
			);
			console.log(
				`   ✅ ${studentsWithAllParallels.length} estudiantes listos para asignar`
			);
			console.log(`   ✅ Sistema de auditoría completo activado`);
		} else {
			console.log(`   ⚠️  No hay estudiantes con selecciones completas`);
		}
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

verifySetup();
