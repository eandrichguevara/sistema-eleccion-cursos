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
 * Normaliza caracteres especiales (tildes, ñ, etc.)
 */
function generateEmail(
	firstName: string,
	lastName: string,
	index: number
): string {
	// Función para normalizar caracteres con tildes y ñ
	const normalizeText = (text: string): string => {
		return text
			.normalize("NFD") // Descompone caracteres con tildes
			.replace(/[\u0300-\u036f]/g, "") // Elimina los diacríticos (tildes)
			.replace(/ñ/g, "n")
			.replace(/Ñ/g, "n")
			.toLowerCase();
	};

	const normalizedFirstName = normalizeText(firstName);
	const normalizedLastName = normalizeText(lastName);
	const normalized = `${normalizedFirstName}.${normalizedLastName}${index}`;
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
	await prisma.assignments.deleteMany({});
	await prisma.lotteries.deleteMany({});
	await prisma.selections.deleteMany({});
	await prisma.courses.deleteMany({});
	await prisma.students.deleteMany({
		where: {
			role: "student",
		},
	});

	// 1. Crear cursos (12 cursos, 4 por paralelo)
	console.log("\n📚 Creando 12 cursos...");
	const courses = [];

	for (const [parallel, courseNames] of Object.entries(coursesByParallel)) {
		for (const courseName of courseNames) {
			const course = await prisma.courses.create({
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
		{ level: 4, section: "A", count: 42, neurodivergentRate: 0.13 }, // 4to A - ~5-6 neurodivergentes
		{ level: 4, section: "B", count: 42, neurodivergentRate: 0.13 }, // 4to B - ~5-6 neurodivergentes
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

			// Ahora tanto 3ro como 4to pueden ser neurodivergentes
			const isNeurodivergent = Math.random() < group.neurodivergentRate;

			// Electivos previos aleatorios (solo para 3ro y 4to)
			const previousElectives: string[] = [];
			if (group.level >= 3) {
				const numPrevious = Math.floor(Math.random() * 2) + 1; // 1-2 electivos previos
				const availableCourses = courses.filter(() => Math.random() > 0.6);
				for (let j = 0; j < numPrevious && j < availableCourses.length; j++) {
					previousElectives.push(availableCourses[j].id);
				}
			}

			const student = await prisma.students.create({
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
		`   • 84 estudiantes de 3ro medio (~13 neurodivergentes prioritarios)`
	);
	console.log(
		`   • 84 estudiantes de 4to medio (~11 neurodivergentes, máxima prioridad)`
	);

	// 3. Crear selecciones para cada estudiante (con sesgo hacia cursos populares)
	console.log("\n🎯 Generando selecciones para estudiantes...");
	console.log(
		"   (Aplicando sesgo hacia cursos populares para crear sobrecupo)"
	);
	let totalSelections = 0;

	// Queremos simular estudiantes en distintos estados:
	// - Algunos sin ninguna preferencia
	// - Algunos con preferencias parciales (1 o 2 paralelos)
	// - La mayoría con las 3 preferencias
	// counters are not needed here because we compute accurate values from DB below

	for (let i = 0; i < students.length; i++) {
		const student = students[i];

		// Probabilidades (ajustables):
		// 10% -> sin selecciones
		// 15% -> parciales (1 o 2 paralelos)
		// 75% -> completos (3 paralelos)
		const rnd = Math.random();
		let selectionsToCreate: Array<{
			course_id: string;
			preference_order: number;
		}> = [];

		if (rnd < 0.1) {
			// Ninguna selección
			selectionsToCreate = [];
		} else if (rnd < 0.25) {
			// Parciales: tomar 1 o 2 preferencias aleatorias
			const full = generateSelections(courses, i);
			const take = Math.random() < 0.6 ? 2 : 1; // 60% de parciales tendrán 2, 40% tendrán 1
			selectionsToCreate = full.slice(0, take);
		} else {
			// Completas
			selectionsToCreate = generateSelections(courses, i);
		}

		for (const selection of selectionsToCreate) {
			await prisma.selections.create({
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
				`   ✓ Selecciones (parciales/incompletas/ninguna incluidas) generadas para ${
					i + 1
				}/168 estudiantes...`
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
		`     - 4to medio neurodivergentes: ${
			students.filter((s) => s.level === 4 && s.is_neurodivergent).length
		}`
	);
	console.log(
		`     - 3ro medio neurodivergentes: ${
			students.filter((s) => s.level === 3 && s.is_neurodivergent).length
		}`
	);
	console.log(
		`     - 4to medio regulares: ${
			students.filter((s) => s.level === 4 && !s.is_neurodivergent).length
		}`
	);
	console.log(`   • Estudiantes regulares (3ro): ${regularStudents.length}`);
	console.log(`   • Total de cursos: ${courses.length} (4 por paralelo)`);
	console.log(`   • Capacidad total: ${courses.length * 42} cupos`);
	console.log(`   • Total de selecciones: ${totalSelections}`);

	// Mostrar cuántos estudiantes quedaron sin selecciones y parciales
	// (leer desde la BD para ser preciso)
	const studentsNoSelRes: Array<{ count: bigint }> = await prisma.$queryRaw`
		SELECT COUNT(*)::bigint as count FROM students s
		LEFT JOIN selections sel ON sel.student_id = s.id
		WHERE s.role = 'student'
		GROUP BY s.id
		HAVING COUNT(sel.*) = 0
	`;
	const studentsNoSel = Number(
		studentsNoSelRes.length ? studentsNoSelRes.length : 0
	);

	// Parciales: tengan 1 o 2 selecciones
	const studentsPartialRes: Array<{ count: bigint }> = await prisma.$queryRaw`
		SELECT COUNT(*)::bigint as count FROM (
			SELECT s.id, COUNT(sel.*) as cnt
			FROM students s
			LEFT JOIN selections sel ON sel.student_id = s.id
			WHERE s.role = 'student'
			GROUP BY s.id
		) t WHERE t.cnt > 0 AND t.cnt < 3
	`;
	const studentsPartial = Number(studentsPartialRes[0]?.count ?? 0);

	console.log(`   • Estudiantes sin selecciones: ${studentsNoSel}`);
	console.log(
		`   • Estudiantes con selecciones parciales (1 o 2): ${studentsPartial}`
	);

	// Análisis de demanda por curso
	console.log("\n📈 Demanda por curso:");
	for (const course of courses) {
		const selectionsCount = await prisma.selections.count({
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
