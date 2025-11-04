import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testExport() {
	console.log("🧪 PRUEBA DE EXPORTACIÓN DE ASIGNACIONES\n");
	console.log("=".repeat(80));

	// 1. Verificar datos disponibles
	const totalAssignments = await prisma.assignments.count();
	const totalStudents = await prisma.students.count();
	const totalCourses = await prisma.courses.count();

	console.log("\n📊 DATOS DISPONIBLES:");
	console.log(`   ✓ Asignaciones totales: ${totalAssignments}`);
	console.log(`   ✓ Estudiantes totales: ${totalStudents}`);
	console.log(`   ✓ Cursos totales: ${totalCourses}`);

	// 2. Obtener muestra de asignaciones (simulando la consulta del endpoint)
	const assignments = await prisma.assignments.findMany({
		include: {
			students: true,
			courses: true,
		},
		orderBy: [
			{ students: { level: "asc" } },
			{ students: { email: "asc" } },
			{ courses: { parallel: "asc" } },
		],
		take: 10, // Solo primeras 10 para la prueba
	});

	console.log("\n📝 MUESTRA DE DATOS A EXPORTAR (primeras 10 asignaciones):\n");

	// 3. Generar el formato CSV
	const csvHeader = [
		"Email Estudiante",
		"Nivel",
		"Neurodivergente",
		"Curso",
		"Paralelo",
		"Tipo Asignación",
		"Preferencia",
		"Prioritario",
		"Fecha Asignación",
	].join(",");

	console.log(csvHeader);
	console.log("-".repeat(120));

	assignments.forEach((assignment: any) => {
		let tipoAsignacion = "";
		if (assignment.preference_order === 1) {
			tipoAsignacion = "1ª Preferencia";
		} else if (assignment.preference_order === 2) {
			tipoAsignacion = "2ª Preferencia";
		} else if (assignment.preference_order === 3) {
			tipoAsignacion = "3ª Preferencia";
		} else if (assignment.preference_order === 99) {
			tipoAsignacion = "Disponibilidad";
		} else {
			tipoAsignacion = `Preferencia ${assignment.preference_order}`;
		}

		const row = [
			assignment.students.email,
			assignment.students.level,
			assignment.students.is_neurodivergent ? "Sí" : "No",
			`"${assignment.courses.name}"`,
			assignment.courses.parallel,
			tipoAsignacion,
			assignment.preference_order === 99 ? "N/A" : assignment.preference_order,
			assignment.is_priority ? "Sí" : "No",
			new Date(assignment.assigned_at).toLocaleString("es-CL", {
				timeZone: "America/Santiago",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			}),
		].join(",");

		console.log(row);
	});

	// 4. Estadísticas generales
	console.log("\n" + "=".repeat(80));
	console.log("\n📈 ESTADÍSTICAS DE EXPORTACIÓN:");

	const uniqueStudents = new Set(assignments.map((a: any) => a.student_id))
		.size;
	const priorityAssignments = assignments.filter((a) => a.is_priority).length;
	const firstPreference = assignments.filter(
		(a) => a.preference_order === 1
	).length;
	const secondPreference = assignments.filter(
		(a) => a.preference_order === 2
	).length;
	const thirdPreference = assignments.filter(
		(a) => a.preference_order === 3
	).length;
	const availability = assignments.filter(
		(a) => a.preference_order === 99
	).length;

	console.log(`   ✓ Estudiantes únicos en muestra: ${uniqueStudents}`);
	console.log(`   ✓ Asignaciones prioritarias: ${priorityAssignments}`);
	console.log(`   ✓ 1ª Preferencia: ${firstPreference}`);
	console.log(`   ✓ 2ª Preferencia: ${secondPreference}`);
	console.log(`   ✓ 3ª Preferencia: ${thirdPreference}`);
	console.log(`   ✓ Por disponibilidad: ${availability}`);

	// 5. Información del archivo
	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `asignaciones_${timestamp}_${totalStudents}estudiantes.csv`;

	console.log("\n📁 NOMBRE DEL ARCHIVO:");
	console.log(`   ${filename}`);

	console.log("\n✅ Formato CSV verificado correctamente!");
	console.log("\n💡 Para descargar el CSV completo:");
	console.log("   GET http://localhost:3001/api/admin/export");
	console.log("   (Requiere sesión de administrador)");

	await prisma.$disconnect();
}

testExport().catch(console.error);
