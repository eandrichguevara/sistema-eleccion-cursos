import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";

async function seedDatabase() {
	try {
		console.log("🌱 Iniciando seed de la base de datos...\n");

		// Crear usuario de prueba
		console.log("👤 Creando usuario de prueba...");
		const hashedPassword = await hashPassword("password123");

		const user = await prisma.student.upsert({
			where: { email: "estudiante@institucion.edu" },
			update: {},
			create: {
				email: "estudiante@institucion.edu",
				password: hashedPassword,
				level: 1,
				is_neurodivergent: false,
				previous_electives: [],
			},
		});
		console.log("✅ Usuario:", user.email);

		// Crear cursos
		console.log("\n📚 Creando cursos...");
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
			await prisma.course
				.upsert({
					where: {
						// Usamos una combinación única de name y parallel
						id: course.name + "-" + course.parallel,
					},
					update: {},
					create: course,
				})
				.catch(async () => {
					// Si el upsert falla por no encontrar ID, intentamos crear directamente
					const existing = await prisma.course.findFirst({
						where: {
							name: course.name,
							parallel: course.parallel,
						},
					});

					if (!existing) {
						await prisma.course.create({ data: course });
					}
				});
		}

		const totalCourses = await prisma.course.count();
		console.log(`✅ Cursos en BD: ${totalCourses}`);

		console.log("\n🎉 Seed completado exitosamente!");
		console.log("\n📝 Credenciales de prueba:");
		console.log("   Email: estudiante@institucion.edu");
		console.log("   Password: password123");
		console.log("\n🚀 Inicia el servidor con: npm run dev");
		console.log("   Login: http://localhost:3000");
		console.log("   Dashboard: http://localhost:3000/dashboard");
		console.log("   API Courses: http://localhost:3000/api/courses");
	} catch (error) {
		console.error("❌ Error durante el seed:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

seedDatabase();
