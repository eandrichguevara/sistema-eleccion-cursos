import { PrismaClient } from "@prisma/client";
import { executeAssignmentAlgorithm } from "../src/lib/assignment-runner";

const prisma = new PrismaClient();

async function main() {
	console.log("🚀 Ejecutando algoritmo de asignación...\n");

	// Obtener todos los cursos
	const courses = await prisma.courses.findMany({
		select: {
			id: true,
			name: true,
			capacity: true,
			parallel: true,
		},
	});

	// Obtener todos los estudiantes (incluyendo los que no tienen selecciones)
	const students = await prisma.students.findMany({
		where: { role: "student" },
		include: {
			selections: {
				include: {
					courses: {
						select: {
							id: true,
							name: true,
							parallel: true,
						},
					},
				},
				orderBy: {
					preference_order: "asc",
				},
			},
		},
	});

	console.log(`📊 Datos cargados:`);
	console.log(`   - ${students.length} estudiantes`);
	console.log(`   - ${courses.length} cursos\n`);

	// Contar estudiantes sin selecciones
	const withoutSelections = students.filter(
		(s) => s.selections.length === 0
	).length;
	console.log(`📋 Estudiantes sin selecciones: ${withoutSelections}\n`);

	// Preparar datos para el algoritmo
	const coursesForAlgo = courses.map((c) => ({
		courseId: c.id,
		courseName: c.name,
		parallel: c.parallel,
		capacity: c.capacity,
		assignedCount: 0,
	}));

	const studentsForAlgo = students.map((s) => ({
		id: s.id,
		email: s.email,
		is_neurodivergent: s.is_neurodivergent,
		level: s.level,
		selections: s.selections.map((sel) => ({
			course_id: sel.course_id,
			preference_order: sel.preference_order,
			courses: {
				id: sel.courses.id,
				name: sel.courses.name,
				parallel: sel.courses.parallel,
			},
		})),
	}));

	// Ejecutar el algoritmo
	console.log("⚙️  Ejecutando algoritmo...\n");
	const result = await executeAssignmentAlgorithm({
		students: studentsForAlgo,
		courses: coursesForAlgo,
		requestIp: "127.0.0.1",
		userAgent: "test-script",
	});

	console.log("\n✅ Algoritmo completado!\n");
	console.log("📊 RESUMEN:");
	console.log(JSON.stringify(result.summary, null, 2));

	if (result.problems.length > 0) {
		console.log("\n⚠️  PROBLEMAS DETECTADOS:");
		console.log(JSON.stringify(result.problems, null, 2));
	}

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error("❌ Error:", e);
	await prisma.$disconnect();
	process.exit(1);
});
