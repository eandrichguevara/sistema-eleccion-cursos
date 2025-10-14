import { prisma } from "../src/lib/prisma";

async function createTestCourses() {
	try {
		console.log("📚 Creando cursos de prueba...\n");

		const courses = [
			// Paralelo 1
			{ name: "Matemáticas Avanzadas", parallel: 1, capacity: 42 },
			{ name: "Física Cuántica", parallel: 1, capacity: 42 },
			{ name: "Química Orgánica", parallel: 1, capacity: 42 },
			{ name: "Programación I", parallel: 1, capacity: 42 },

			// Paralelo 2
			{ name: "Literatura Contemporánea", parallel: 2, capacity: 42 },
			{ name: "Historia Universal", parallel: 2, capacity: 42 },
			{ name: "Biología Molecular", parallel: 2, capacity: 42 },
			{ name: "Inglés Avanzado", parallel: 2, capacity: 42 },

			// Paralelo 3
			{ name: "Economía Global", parallel: 3, capacity: 42 },
			{ name: "Estadística Aplicada", parallel: 3, capacity: 42 },
			{ name: "Diseño Digital", parallel: 3, capacity: 42 },
			{ name: "Bases de Datos", parallel: 3, capacity: 42 },
		];

		for (const course of courses) {
			const created = await prisma.course.create({
				data: course,
			});
			console.log(`✅ Creado: ${created.name} (Paralelo ${created.parallel})`);
		}

		console.log("\n🎉 Todos los cursos fueron creados exitosamente!");
		console.log("💡 Ahora puedes verlos en http://localhost:3000/api/courses");
	} catch (error) {
		console.error("❌ Error al crear cursos:", error);
	} finally {
		await prisma.$disconnect();
	}
}

createTestCourses();
