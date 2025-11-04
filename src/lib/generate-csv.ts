import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function generateCSV() {
	console.log("📊 GENERANDO ARCHIVO CSV DE ASIGNACIONES\n");
	console.log("=".repeat(80));

	try {
		// 1. Obtener todas las asignaciones
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
		});

		if (assignments.length === 0) {
			console.log("⚠️  No hay asignaciones para exportar");
			return;
		}

		console.log(`\n✓ Encontradas ${assignments.length} asignaciones`);

		// 2. Generar el contenido CSV
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

		const csvRows = assignments.map((assignment: any) => {
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

			return [
				assignment.students.email,
				assignment.students.level,
				assignment.students.is_neurodivergent ? "Sí" : "No",
				`"${assignment.courses.name}"`,
				assignment.courses.parallel,
				tipoAsignacion,
				assignment.preference_order === 99
					? "N/A"
					: assignment.preference_order,
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
		});

		const csvContent = [csvHeader, ...csvRows].join("\n");

		// 3. Guardar el archivo
		const totalEstudiantes = new Set(assignments.map((a: any) => a.student_id))
			.size;
		const timestamp = new Date().toISOString().split("T")[0];
		const filename = `asignaciones_${timestamp}_${totalEstudiantes}estudiantes.csv`;
		const filepath = path.join(process.cwd(), filename);

		fs.writeFileSync(filepath, csvContent, "utf-8");

		console.log(`\n✅ Archivo CSV generado exitosamente!`);
		console.log(`\n📁 Ubicación: ${filepath}`);
		console.log(`📄 Nombre: ${filename}`);
		console.log(`📊 Total de registros: ${assignments.length}`);
		console.log(`👥 Estudiantes únicos: ${totalEstudiantes}`);

		// 4. Estadísticas
		const priorityCount = assignments.filter((a) => a.is_priority).length;
		const firstPref = assignments.filter(
			(a) => a.preference_order === 1
		).length;
		const secondPref = assignments.filter(
			(a) => a.preference_order === 2
		).length;
		const thirdPref = assignments.filter(
			(a) => a.preference_order === 3
		).length;
		const availability = assignments.filter(
			(a) => a.preference_order === 99
		).length;

		console.log("\n📈 ESTADÍSTICAS:");
		console.log(
			`   • Asignaciones prioritarias: ${priorityCount} (${(
				(priorityCount / assignments.length) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`   • 1ª Preferencia: ${firstPref} (${(
				(firstPref / assignments.length) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`   • 2ª Preferencia: ${secondPref} (${(
				(secondPref / assignments.length) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`   • 3ª Preferencia: ${thirdPref} (${(
				(thirdPref / assignments.length) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`   • Por disponibilidad: ${availability} (${(
				(availability / assignments.length) *
				100
			).toFixed(1)}%)`
		);

		console.log("\n" + "=".repeat(80));
		console.log(
			"\n💡 Ahora puedes abrir el archivo en Excel o Google Sheets\n"
		);
	} catch (error) {
		console.error("❌ Error al generar CSV:", error);
	} finally {
		await prisma.$disconnect();
	}
}

generateCSV();
