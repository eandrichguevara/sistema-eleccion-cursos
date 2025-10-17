import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	// Verificar estudiante
	const student = await prisma.student.findUnique({
		where: { email: "estudiante@institucion.edu" },
	});

	console.log("📚 Estado de la base de datos:");
	console.log("================================");

	if (student) {
		console.log("✅ Estudiante de prueba: EXISTE");
		console.log(`   Email: ${student.email}`);
		console.log(`   ID: ${student.id}`);

		// Verificar selecciones
		const selections = await prisma.selection.findMany({
			where: { student_id: student.id },
			include: { course: true },
			orderBy: { preference_order: "asc" },
		});

		console.log(`\n📋 Selecciones guardadas: ${selections.length}`);
		if (selections.length > 0) {
			selections.forEach((sel) => {
				console.log(
					`   ${sel.preference_order}° opción: ${sel.course.name} (Paralelo ${sel.course.parallel})`
				);
			});
		}
	} else {
		console.log("❌ Estudiante de prueba: NO EXISTE");
		console.log("   Necesitas crear el estudiante primero");
	}

	// Verificar cursos
	const courses = await prisma.course.findMany({
		orderBy: { parallel: "asc" },
	});
	console.log(`\n📚 Cursos en la base de datos: ${courses.length}`);
	console.log("\nLista de cursos:");
	courses.forEach((course) => {
		console.log(
			`   ID: ${course.id} | ${course.name} (Paralelo ${course.parallel})`
		);
	});

	console.log("\n================================");
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
