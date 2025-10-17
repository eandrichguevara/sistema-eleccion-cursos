import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Nombres de ejemplo para generar estudiantes
const firstNames = [
	"Juan",
	"María",
	"Carlos",
	"Ana",
	"Pedro",
	"Sofía",
	"Diego",
	"Laura",
	"Miguel",
	"Carmen",
	"José",
	"Elena",
	"Luis",
	"Isabel",
	"Antonio",
	"Patricia",
	"Francisco",
	"Rosa",
	"Manuel",
	"Teresa",
	"Javier",
	"Lucía",
	"Rafael",
	"Marta",
	"Daniel",
	"Paula",
	"Alejandro",
	"Cristina",
	"Fernando",
	"Sandra",
];

const lastNames = [
	"García",
	"Rodríguez",
	"González",
	"Fernández",
	"López",
	"Martínez",
	"Sánchez",
	"Pérez",
	"Gómez",
	"Martín",
	"Jiménez",
	"Ruiz",
	"Hernández",
	"Díaz",
	"Moreno",
	"Muñoz",
	"Álvarez",
	"Romero",
	"Alonso",
	"Gutiérrez",
	"Navarro",
	"Torres",
	"Domínguez",
	"Vázquez",
	"Ramos",
	"Gil",
	"Ramírez",
	"Serrano",
	"Blanco",
	"Molina",
];

// Nombres de cursos por paralelo
const coursesByParallel = {
	1: [
		"Matemáticas Avanzadas",
		"Física Cuántica",
		"Química Orgánica",
		"Programación I",
	],
	2: [
		"Literatura Contemporánea",
		"Historia del Arte",
		"Biología Molecular",
		"Inglés Avanzado",
	],
	3: ["Economía", "Filosofía", "Ciencias Políticas", "Psicología"],
};

/**
 * Genera un email único basado en nombre y apellido
 */
function generateEmail(
	firstName: string,
	lastName: string,
	index: number
): string {
	const normalized = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}`;
	return `${normalized}@institucion.edu`;
}

/**
 * Genera selecciones para un estudiante
 * Con sesgo hacia cursos populares para crear sobrecupo
 * Esto forzará asignaciones a 2da, 3ra preferencia y desempate aleatorio
 */
function generateSelections(
	courses: Array<{ id: string; parallel: number; name: string }>,
	studentIndex: number
): Array<{
	course_id: string;
	preference_order: number;
}> {
	const selections: Array<{ course_id: string; preference_order: number }> = [];

	// Cursos "populares" que tendrán más demanda
	const popularCourses = [
		"Programación I",
		"Psicología",
		"Literatura Contemporánea",
	];

	// Cursos "moderados" con demanda media
	const moderateCourses = ["Física Cuántica", "Historia del Arte", "Economía"];

	// Determinar probabilidad de elegir curso popular basado en índice del estudiante
	// Los primeros 60% de estudiantes preferirán cursos populares
	const prefersPopular = studentIndex < 180; // 60% de 300

	// Obtener un curso de cada paralelo
	for (let parallel = 1; parallel <= 3; parallel++) {
		const parallelCourses = courses.filter((c) => c.parallel === parallel);
		let selectedCourse;

		if (prefersPopular) {
			// Intentar seleccionar un curso popular del paralelo
			const popularInParallel = parallelCourses.filter((c) =>
				popularCourses.includes(c.name)
			);
			const moderateInParallel = parallelCourses.filter((c) =>
				moderateCourses.includes(c.name)
			);

			// 70% popular, 20% moderado, 10% aleatorio
			const rand = Math.random();
			if (rand < 0.7 && popularInParallel.length > 0) {
				selectedCourse =
					popularInParallel[
						Math.floor(Math.random() * popularInParallel.length)
					];
			} else if (rand < 0.9 && moderateInParallel.length > 0) {
				selectedCourse =
					moderateInParallel[
						Math.floor(Math.random() * moderateInParallel.length)
					];
			} else {
				selectedCourse =
					parallelCourses[Math.floor(Math.random() * parallelCourses.length)];
			}
		} else {
			// Estudiantes que prefieren cursos menos populares (más variedad)
			const unpopularInParallel = parallelCourses.filter(
				(c) =>
					!popularCourses.includes(c.name) && !moderateCourses.includes(c.name)
			);

			if (unpopularInParallel.length > 0 && Math.random() < 0.6) {
				selectedCourse =
					unpopularInParallel[
						Math.floor(Math.random() * unpopularInParallel.length)
					];
			} else {
				selectedCourse =
					parallelCourses[Math.floor(Math.random() * parallelCourses.length)];
			}
		}

		selections.push({
			course_id: selectedCourse.id,
			preference_order: parallel,
		});
	}

	// Mezclar las preferencias (shuffle)
	for (let i = selections.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = selections[i].preference_order;
		selections[i].preference_order = selections[j].preference_order;
		selections[j].preference_order = temp;
	}

	return selections;
}

async function main() {
	console.log("🌱 Iniciando seed de la base de datos...\n");

	// Limpiar datos existentes (excepto admin)
	console.log("🗑️  Limpiando datos existentes...");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await (prisma as any).assignment.deleteMany({});
	await prisma.selection.deleteMany({});
	await prisma.course.deleteMany({});
	await prisma.student.deleteMany({
		where: {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			role: "student" as any,
		},
	});

	// 1. Crear cursos (12 cursos, 4 por paralelo)
	console.log("\n📚 Creando 12 cursos...");
	const courses = [];

	for (const [parallel, courseNames] of Object.entries(coursesByParallel)) {
		for (const courseName of courseNames) {
			const course = await prisma.course.create({
				data: {
					name: courseName,
					parallel: parseInt(parallel),
					capacity: 42, // Capacidad estándar por curso
				},
			});
			courses.push(course);
			console.log(`   ✓ ${courseName} (Paralelo ${parallel}) - Capacidad: 42`);
		}
	}

	// 2. Crear 300 estudiantes
	// 2. Crear 168 estudiantes (divididos en 3ro A, 3ro B, 4to A, 4to B)
	console.log("\n👥 Creando 168 estudiantes...");
	const hashedPassword = await bcrypt.hash("estudiante123", 10);
	const students = [];

	// Distribución realista:
	// - 42 estudiantes de 3ro medio A (algunos neurodivergentes = prioritarios)
	// - 42 estudiantes de 3ro medio B (algunos neurodivergentes = prioritarios)
	// - 42 estudiantes de 4to medio A (prioritarios)
	// - 42 estudiantes de 4to medio B (prioritarios)

	const groups = [
		{ level: 3, section: "A", count: 42, neurodivergentRate: 0.15 }, // 3ro A - ~6 neurodivergentes
		{ level: 3, section: "B", count: 42, neurodivergentRate: 0.15 }, // 3ro B - ~6 neurodivergentes
		{ level: 4, section: "A", count: 42, neurodivergentRate: 0 }, // 4to A - todos prioritarios
		{ level: 4, section: "B", count: 42, neurodivergentRate: 0 }, // 4to B - todos prioritarios
	];

	let studentIndex = 1;

	for (const group of groups) {
		console.log(
			`\n   Creando ${group.count} estudiantes de ${group.level}° medio ${group.section}...`
		);

		for (let i = 0; i < group.count; i++) {
			const firstName =
				firstNames[Math.floor(Math.random() * firstNames.length)];
			const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
			const email = generateEmail(firstName, lastName, studentIndex);

			const isNeurodivergent =
				group.level === 3 && Math.random() < group.neurodivergentRate;

			// Electivos previos aleatorios (solo para 3ro y 4to)
			const previousElectives: string[] = [];
			if (group.level >= 3) {
				const numPrevious = Math.floor(Math.random() * 2) + 1; // 1-2 electivos previos
				const availableCourses = courses.filter(() => Math.random() > 0.6);
				for (let j = 0; j < numPrevious && j < availableCourses.length; j++) {
					previousElectives.push(availableCourses[j].id);
				}
			}

			const student = await prisma.student.create({
				data: {
					email,
					password: hashedPassword,
					level: group.level,
					is_neurodivergent: isNeurodivergent,
					previous_electives: previousElectives,
					role: "student",
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			});

			students.push(student);
			studentIndex++;
		}
	}

	console.log(`   ✓ 168 estudiantes creados exitosamente`);
	console.log(
		`   • 84 estudiantes de 3ro medio (~12 neurodivergentes prioritarios)`
	);
	console.log(`   • 84 estudiantes de 4to medio (todos prioritarios)`);

	// 3. Crear selecciones para cada estudiante (con sesgo hacia cursos populares)
	console.log("\n🎯 Generando selecciones para estudiantes...");
	console.log(
		"   (Aplicando sesgo hacia cursos populares para crear sobrecupo)"
	);
	let totalSelections = 0;

	for (let i = 0; i < students.length; i++) {
		const student = students[i];
		const selections = generateSelections(courses, i);

		for (const selection of selections) {
			await prisma.selection.create({
				data: {
					student_id: student.id,
					course_id: selection.course_id,
					preference_order: selection.preference_order,
				},
			});
			totalSelections++;
		}

		if ((i + 1) % 42 === 0) {
			console.log(
				`   ✓ Selecciones generadas para ${i + 1}/168 estudiantes...`
			);
		}
	}

	console.log(`   ✓ ${totalSelections} selecciones creadas exitosamente`);

	// 4. Estadísticas finales
	console.log("\n📊 Estadísticas de datos generados:");

	const priorityStudents = students.filter(
		(s) => s.level === 4 || (s.level === 3 && s.is_neurodivergent)
	);
	const regularStudents = students.filter(
		(s) => !(s.level === 4 || (s.level === 3 && s.is_neurodivergent))
	);

	console.log(`   • Total de estudiantes: ${students.length}`);
	console.log(`   • Estudiantes prioritarios: ${priorityStudents.length}`);
	console.log(
		`     - 4to medio: ${students.filter((s) => s.level === 4).length}`
	);
	console.log(
		`     - 3ro neurodivergentes: ${
			students.filter((s) => s.level === 3 && s.is_neurodivergent).length
		}`
	);
	console.log(`   • Estudiantes regulares: ${regularStudents.length}`);
	console.log(`   • Total de cursos: ${courses.length} (4 por paralelo)`);
	console.log(`   • Capacidad total: ${courses.length * 42} cupos`);
	console.log(`   • Total de selecciones: ${totalSelections}`);

	// Análisis de demanda por curso
	console.log("\n📈 Demanda por curso:");
	for (const course of courses) {
		const selectionsCount = await prisma.selection.count({
			where: { course_id: course.id },
		});
		const demandPercent = Math.round((selectionsCount / course.capacity) * 100);
		const status = selectionsCount > course.capacity ? "⚠️ SOBRECUPO" : "✓ OK";
		console.log(
			`   ${status} ${course.name} (P${course.parallel}): ${selectionsCount}/${course.capacity} (${demandPercent}%)`
		);
	}

	console.log("\n✅ Seed completado exitosamente!");
	console.log("\n💡 Credenciales de prueba:");
	console.log("   • Admin: admin@institucion.edu / admin123");
	console.log(
		"   • Estudiantes: [nombre].[apellido][número]@institucion.edu / estudiante123"
	);
	console.log("   • Ejemplo: juan.garcia1@institucion.edu / estudiante123");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("❌ Error en seed:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
