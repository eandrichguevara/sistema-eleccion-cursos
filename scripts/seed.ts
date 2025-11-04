import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";

async function seedDatabase() {
	try {
		console.log("🌱 Iniciando seed de la base de datos...\n");

		// Crear usuario de prueba
		console.log("👤 Creando usuario de prueba...");
		const hashedPassword = await hashPassword("password123");

		const user = await prisma.students.upsert({
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
			await prisma.courses
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
					const existing = await prisma.courses.findFirst({
						where: {
							name: course.name,
							parallel: course.parallel,
						},
					});

					if (!existing) {
						await prisma.courses.create({ data: course });
					}
				});
		}

		const totalCourses = await prisma.courses.count();
		console.log(`✅ Cursos en BD: ${totalCourses}`);

		// 3. Crear varios estudiantes adicionales y sus selecciones ficticias
		console.log(
			"\n👥 Creando estudiantes de prueba adicionales y sus selecciones..."
		);
		const extraStudentsCount = 30; // número de estudiantes ficticios a crear
		const createdStudents = [];
		for (let i = 1; i <= extraStudentsCount; i++) {
			const email = `student${i}@institucion.edu`;
			const level = Math.random() < 0.5 ? 3 : 4; // 50/50 entre 3ro y 4to
			const is_neurodivergent = Math.random() < 0.12; // ~12% neurodivergentes

			const student = await prisma.students.upsert({
				where: { email },
				update: {},
				create: {
					email,
					password: hashedPassword,
					level,
					is_neurodivergent,
					previous_electives: [],
					role: "student",
				},
			});

			createdStudents.push(student);
		}

		// Obtener cursos guardados para asignar selecciones
		const savedCourses = await prisma.courses.findMany();

		// Función ayuda: elegir un curso aleatorio por paralelo
		function pickRandomCourse(parallel: number) {
			const options = savedCourses.filter((c) => c.parallel === parallel);
			return options[Math.floor(Math.random() * options.length)];
		}

		let totalSelections = 0;
		for (let idx = 0; idx < createdStudents.length; idx++) {
			const student = createdStudents[idx];

			// Elegir un curso por cada paralelo
			const chosen = [1, 2, 3].map((p) => pickRandomCourse(p));

			// Generar 3 preferencias distintas (valores únicos entre 1..4)
			const prefPool = [1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);

			for (let j = 0; j < chosen.length; j++) {
				const course = chosen[j];
				const preference_order = prefPool[j];
				await prisma.selections.create({
					data: {
						student_id: student.id,
						course_id: course.id,
						preference_order,
					},
				});
				totalSelections++;
			}

			if ((idx + 1) % 10 === 0) {
				console.log(
					`   ✓ Selecciones generadas para ${idx + 1}/${
						createdStudents.length
					} estudiantes...`
				);
			}
		}

		console.log(
			`   ✓ ${createdStudents.length} estudiantes creados con ${totalSelections} selecciones en total`
		);

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
