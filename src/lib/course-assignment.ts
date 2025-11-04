import { prisma } from "./prisma";

/**
 * SISTEMA DE ASIGNACIÓN DE CURSOS ELECTIVOS
 * ========================================
 *
 * Este archivo implementa el algoritmo principal para asignar cursos electivos a estudiantes
 * basado en un sistema de prioridades de tres niveles:
 *
 * 1. PRIMERA PRIORIDAD: Estudiantes neurodivergentes
 * 2. SEGUNDA PRIORIDAD: Estudiantes de 4to medio
 * 3. TERCERA PRIORIDAD: Estudiantes de 3ro medio
 *
 * FUNCIONAMIENTO GENERAL:
 * - Cada estudiante debe ser asignado a exactamente 3 cursos (uno por paralelo: 1, 2, 3)
 * - Se procesa grupo por grupo según prioridad
 * - Dentro de cada grupo, se respetan las preferencias del estudiante (1ª, 2ª, 3ª, 4ª)
 * - Si un curso tiene más candidatos que cupos, se realiza un sorteo aleatorio
 * - Si no hay selecciones disponibles, se asignan cursos con disponibilidad automáticamente
 */

// Enum para clasificar los tipos de estudiantes según su prioridad
enum StudentType {
	NEURODIVERGENT = "NEURODIVERGENT", // Máxima prioridad
	FOURTH_YEAR = "FOURTH_YEAR", // Prioridad media
	THIRD_YEAR = "THIRD_YEAR", // Prioridad baja
}

// ============================================================================
// INTERFACES Y TIPOS DE DATOS
// ============================================================================

// Representa un estudiante con sus selecciones de cursos
interface Student {
	id: string;
	email: string;
	level: number; // Nivel académico (3 = 3ro medio, 4 = 4to medio)
	is_neurodivergent: boolean; // Determina si tiene prioridad máxima
	selections: Selection[]; // Lista de cursos que seleccionó
}

// Representa la selección de un curso por parte de un estudiante
interface Selection {
	id: string;
	course_id: string;
	preference_order: number; // Orden de preferencia (1=más deseado, 4=menos deseado)
	courses: {
		id: string;
		name: string;
		parallel: number; // Paralelo del curso (1, 2, o 3)
		capacity: number; // Capacidad máxima del curso
	};
}

// Representa una asignación final de curso a estudiante
interface Assignment {
	student_id: string;
	course_id: string;
	preference_order: number; // 99 = asignado por disponibilidad (no fue preferencia)
	is_priority: boolean; // true si es estudiante neurodivergente o 4to medio
}

// Seguimiento de la capacidad actual de cada curso
interface CourseCapacity {
	courseId: string;
	courseName: string;
	parallel: number;
	capacity: number; // Capacidad total del curso
	assignedCount: number; // Cuántos estudiantes ya están asignados
}

// Registro de un sorteo ejecutado cuando hay más candidatos que cupos
interface LotteryRecord {
	course_id: string;
	course_name: string;
	parallel: number;
	preference: number; // En qué preferencia se hizo el sorteo
	candidates: number; // Total de candidatos al sorteo
	available_spots: number; // Cupos disponibles
	winners: string[]; // IDs de estudiantes que ganaron
	losers: string[]; // IDs de estudiantes que perdieron
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Determina el tipo de estudiante para establecer su prioridad en el algoritmo
 * @param student - El estudiante a clasificar
 * @returns El tipo de estudiante según su prioridad
 */
function getStudentType(student: Student): StudentType {
	if (student.is_neurodivergent) {
		return StudentType.NEURODIVERGENT; // Máxima prioridad
	}
	if (student.level === 4) {
		return StudentType.FOURTH_YEAR; // Prioridad media
	}
	return StudentType.THIRD_YEAR; // Prioridad baja
}

void getStudentType; // Función no utilizada actualmente pero disponible

/**
 * Implementa el algoritmo de Fisher-Yates para mezclar aleatoriamente un array
 * Esto garantiza una distribución uniforme y justa en los sorteos
 * @param array - Array a mezclar
 * @returns Nuevo array con elementos mezclados aleatoriamente
 */
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	// Algoritmo Fisher-Yates: recorre desde el final hacia el inicio
	for (let i = shuffled.length - 1; i > 0; i--) {
		// Selecciona un índice aleatorio entre 0 e i
		const j = Math.floor(Math.random() * (i + 1));
		// Intercambia los elementos en las posiciones i y j
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Ejecuta un sorteo justo cuando hay más candidatos que cupos disponibles
 * @param candidates - Lista de estudiantes candidatos al curso
 * @param availableSpots - Número de cupos disponibles
 * @returns Objeto con ganadores y perdedores del sorteo
 */
function performLottery(
	candidates: Student[],
	availableSpots: number
): { winners: Student[]; losers: Student[] } {
	console.log(`      🎲 EJECUTANDO SORTEO:`);
	console.log(`         Candidatos totales: ${candidates.length}`);
	console.log(`         Cupos disponibles: ${availableSpots}`);
	console.log(
		`         Candidatos: ${candidates.map((s) => s.email).join(", ")}`
	);

	// Mezcla aleatoriamente a los candidatos para garantizar justicia
	const shuffled = shuffleArray(candidates);

	// Los primeros N estudiantes son los ganadores
	const winners = shuffled.slice(0, availableSpots);

	// El resto son los perdedores
	const losers = shuffled.slice(availableSpots);

	console.log(
		`         ✅ GANADORES (${winners.length}): ${winners
			.map((s) => s.email)
			.join(", ")}`
	);
	console.log(
		`         ❌ PERDEDORES (${losers.length}): ${losers
			.map((s) => s.email)
			.join(", ")}`
	);

	return { winners, losers };
}

/**
 * FUNCIÓN PRINCIPAL DE ASIGNACIÓN POR GRUPO DE ESTUDIANTES
 * =========================================================
 *
 * Esta función procesa un grupo completo de estudiantes (ej: neurodivergentes, 4to medio, 3ro medio)
 * y les asigna cursos según sus preferencias y disponibilidad.
 *
 * ALGORITMO POR PARALELO:
 * 1. Para cada paralelo (1, 2, 3):
 *    - Para cada preferencia (1ª, 2ª, 3ª, 4ª):
 *      - Agrupa estudiantes por curso deseado
 *      - Si hay más candidatos que cupos → SORTEO
 *      - Si hay cupos suficientes → ASIGNACIÓN DIRECTA
 *    - Asigna cursos con disponibilidad a estudiantes sin asignación
 *
 * @param students - Lista de estudiantes del grupo a procesar
 * @param courseCapacities - Mapa con la capacidad actual de cada curso
 * @param studentAssignments - Seguimiento de qué paralelos tiene asignado cada estudiante
 * @param allAssignments - Array donde se acumulan todas las asignaciones
 * @param lotteryRecords - Array donde se registran todos los sorteos ejecutados
 * @param groupName - Nombre del grupo para logs (ej: "Estudiantes Neurodivergentes")
 * @param isPriority - Si este grupo tiene prioridad (neurodivergentes y 4to medio = true)
 * @returns Número total de asignaciones realizadas para este grupo
 */
async function assignCoursesToStudentGroup(
	students: Student[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	lotteryRecords: LotteryRecord[],
	groupName: string,
	isPriority: boolean
): Promise<number> {
	console.log(`Procesando ${groupName} (${students.length} estudiantes)`);

	let assignmentsCount = 0;

	// Cada estudiante debe tener exactamente un curso en cada paralelo
	const parallels = [1, 2, 3];

	// PROCESAMIENTO POR PARALELO
	// Cada paralelo se procesa independientemente para garantizar que cada estudiante
	// termine con exactamente un curso por paralelo
	for (const parallel of parallels) {
		console.log(`  Paralelo ${parallel}:`);

		// PROCESAMIENTO POR PREFERENCIA
		// Se procesan las preferencias en orden: 1ª preferencia tiene prioridad sobre 2ª, etc.
		for (let preference = 1; preference <= 4; preference++) {
			console.log(`    Preferencia ${preference}:`);

			// Agrupa estudiantes por el curso que desean en esta preferencia
			const courseGroups = new Map<string, Student[]>();

			students.forEach((student) => {
				// Verifica si el estudiante ya tiene un curso asignado en este paralelo
				const assignedParallels = studentAssignments.get(student.id);
				if (assignedParallels && assignedParallels.has(parallel)) {
					console.log(
						`      📝 ${student.email}: YA TIENE CURSO en paralelo ${parallel}`
					);
					return; // Este estudiante ya tiene curso en este paralelo, saltar
				}

				// Busca si el estudiante seleccionó algún curso para este paralelo en esta preferencia
				const selection = student.selections.find(
					(s) =>
						s.courses.parallel === parallel && s.preference_order === preference
				);

				if (selection) {
					console.log(
						`      📋 ${student.email}: QUIERE "${selection.courses.name}" (paralelo ${parallel})`
					);
					// Agrupa al estudiante con otros que quieren el mismo curso
					if (!courseGroups.has(selection.course_id)) {
						courseGroups.set(selection.course_id, []);
					}
					courseGroups.get(selection.course_id)!.push(student);
				} else {
					console.log(
						`      📋 ${student.email}: NO tiene preferencia ${preference} para paralelo ${parallel}`
					);
				}
			});

			// PROCESAMIENTO POR CURSO
			// Para cada curso que fue seleccionado por estudiantes en esta preferencia
			for (const [courseId, candidateStudents] of courseGroups.entries()) {
				const capacity = courseCapacities.get(courseId);
				if (!capacity) {
					console.log(`      ⚠️  CURSO NO ENCONTRADO: ${courseId}`);
					continue; // El curso no existe, saltar
				}

				// Calcula cuántos cupos quedan disponibles en este curso
				const availableSpots = capacity.capacity - capacity.assignedCount;
				console.log(
					`      📊 CURSO: "${capacity.courseName}" (Paralelo ${capacity.parallel})`
				);
				console.log(`         Capacidad total: ${capacity.capacity}`);
				console.log(`         Ya asignados: ${capacity.assignedCount}`);
				console.log(`         Cupos disponibles: ${availableSpots}`);
				console.log(`         Candidatos: ${candidateStudents.length}`);

				if (availableSpots <= 0) {
					console.log(`      ❌ Sin cupos en ${capacity.courseName}`);
					continue; // No hay cupos disponibles, saltar
				}

				let studentsToAssign: Student[];

				// Filtra solo estudiantes que aún no tienen curso en este paralelo
				const eligibleStudents = candidateStudents.filter((s) => {
					const assigned = studentAssignments.get(s.id);
					return !assigned || !assigned.has(parallel);
				});

				if (eligibleStudents.length === 0) continue; // No hay estudiantes elegibles

				// DECISIÓN: ¿ASIGNACIÓN DIRECTA O SORTEO?
				if (eligibleStudents.length > availableSpots) {
					// HAY MÁS CANDIDATOS QUE CUPOS → EJECUTAR SORTEO
					console.log(
						`      SORTEO: ${capacity.courseName} - ${eligibleStudents.length} candidatos, ${availableSpots} cupos`
					);

					const { winners, losers } = performLottery(
						eligibleStudents,
						availableSpots
					);
					studentsToAssign = winners;

					// Registra el sorteo para auditoria y transparencia
					lotteryRecords.push({
						course_id: courseId,
						course_name: capacity.courseName,
						parallel: parallel,
						preference: preference,
						candidates: eligibleStudents.length,
						available_spots: availableSpots,
						winners: winners.map((s) => s.id),
						losers: losers.map((s) => s.id),
					});
				} else {
					// HAY CUPOS SUFICIENTES → ASIGNACIÓN DIRECTA
					studentsToAssign = eligibleStudents;
				}

				// EJECUTAR LAS ASIGNACIONES
				console.log(
					`      ✅ ASIGNANDO ${studentsToAssign.length} ESTUDIANTES:`
				);
				studentsToAssign.forEach((student, index) => {
					// Crear la asignación oficial
					allAssignments.push({
						student_id: student.id,
						course_id: courseId,
						preference_order: preference,
						is_priority: isPriority,
					});

					// Actualizar contadores y seguimiento
					capacity.assignedCount++; // Incrementa cupos ocupados del curso
					assignmentsCount++; // Incrementa total de asignaciones del grupo

					// Marca que este estudiante ya tiene curso en este paralelo
					if (!studentAssignments.has(student.id)) {
						studentAssignments.set(student.id, new Set());
					}
					studentAssignments.get(student.id)!.add(parallel);

					console.log(
						`         ${index + 1}. ${student.email} → "${
							capacity.courseName
						}" (Preferencia ${preference})`
					);
				});

				console.log(
					`      📈 ACTUALIZADO: "${capacity.courseName}" ahora tiene ${capacity.assignedCount}/${capacity.capacity} cupos ocupados`
				);
				console.log(`      ==========================================`);
			}
		}

		// ASIGNACIÓN POR DISPONIBILIDAD
		// Después de procesar todas las preferencias, algunos estudiantes pueden
		// no tener curso asignado en este paralelo. Se les asigna cualquier curso disponible.
		const studentsNeedingParallel = students.filter((s) => {
			const assigned = studentAssignments.get(s.id);
			return !assigned || !assigned.has(parallel);
		});

		if (studentsNeedingParallel.length > 0) {
			console.log(`    🔄 ASIGNACIÓN POR DISPONIBILIDAD:`);
			console.log(
				`    Estudiantes sin curso en paralelo ${parallel}: ${studentsNeedingParallel.length}`
			);
			console.log(
				`    Estudiantes: ${studentsNeedingParallel
					.map((s) => s.email)
					.join(", ")}`
			);

			studentsNeedingParallel.forEach((student, index) => {
				// Busca cualquier curso de este paralelo que tenga cupos disponibles
				const availableCourses = Array.from(courseCapacities.values()).filter(
					(cap) => cap.parallel === parallel && cap.assignedCount < cap.capacity
				);

				console.log(`      ${index + 1}. ${student.email}:`);
				console.log(
					`         Cursos disponibles en paralelo ${parallel}: ${availableCourses.length}`
				);

				if (availableCourses.length > 0) {
					console.log(
						`         Opciones: ${availableCourses
							.map(
								(c) => `"${c.courseName}" (${c.assignedCount}/${c.capacity})`
							)
							.join(", ")}`
					);

					// Selecciona un curso disponible aleatoriamente
					const targetCourse =
						availableCourses[
							Math.floor(Math.random() * availableCourses.length)
						];

					// Asigna el curso con preference_order = 99 (indica asignación por disponibilidad)
					allAssignments.push({
						student_id: student.id,
						course_id: targetCourse.courseId,
						preference_order: 99, // Código especial para "asignado por disponibilidad"
						is_priority: isPriority,
					});

					// Actualiza contadores
					targetCourse.assignedCount++;
					assignmentsCount++;

					// Marca el paralelo como asignado para este estudiante
					if (!studentAssignments.has(student.id)) {
						studentAssignments.set(student.id, new Set());
					}
					studentAssignments.get(student.id)!.add(parallel);

					console.log(
						`         ✅ ASIGNADO → "${targetCourse.courseName}" (por disponibilidad)`
					);
					console.log(
						`         📈 "${targetCourse.courseName}" ahora: ${targetCourse.assignedCount}/${targetCourse.capacity}`
					);
				} else {
					console.log(
						`         ❌ NO HAY CURSOS DISPONIBLES en paralelo ${parallel}`
					);
				}
			});
		} else {
			console.log(
				`    ✅ Todos los estudiantes tienen curso asignado en paralelo ${parallel}`
			);
		}
	}

	// RESUMEN FINAL DEL GRUPO
	console.log(`📊 RESUMEN ${groupName}:`);
	console.log(`   Total asignaciones: ${assignmentsCount}`);
	console.log(`   Estudiantes procesados: ${students.length}`);

	// Analiza cuántos estudiantes tienen 0, 1, 2, o 3 cursos
	const assignmentStats = {
		with0Courses: 0,
		with1Course: 0,
		with2Courses: 0,
		with3Courses: 0,
	};

	students.forEach((student) => {
		const assigned = studentAssignments.get(student.id);
		const courseCount = assigned ? assigned.size : 0;

		switch (courseCount) {
			case 0:
				assignmentStats.with0Courses++;
				break;
			case 1:
				assignmentStats.with1Course++;
				break;
			case 2:
				assignmentStats.with2Courses++;
				break;
			case 3:
				assignmentStats.with3Courses++;
				break;
		}
	});

	console.log(`   Estudiantes con 0 cursos: ${assignmentStats.with0Courses}`);
	console.log(`   Estudiantes con 1 curso: ${assignmentStats.with1Course}`);
	console.log(`   Estudiantes con 2 cursos: ${assignmentStats.with2Courses}`);
	console.log(`   Estudiantes con 3 cursos: ${assignmentStats.with3Courses}`);
	console.log(`==============================================`);

	return assignmentsCount;
}

/**
 * FUNCIÓN PRINCIPAL DEL ALGORITMO DE ASIGNACIÓN
 * =============================================
 *
 * Esta es la función principal que coordina todo el proceso de asignación de cursos.
 *
 * FLUJO GENERAL:
 * 1. Carga estudiantes y sus selecciones desde la base de datos
 * 2. Clasifica estudiantes en grupos de prioridad
 * 3. Inicializa el seguimiento de capacidades de cursos
 * 4. Limpia asignaciones previas
 * 5. Procesa cada grupo en orden de prioridad:
 *    - Neurodivergentes (prioridad máxima)
 *    - 4to medio (prioridad media)
 *    - 3ro medio (prioridad baja)
 * 6. Guarda todas las asignaciones y sorteos en la base de datos
 * 7. Calcula y retorna estadísticas finales
 *
 * @returns Objeto con resultado del proceso y estadísticas detalladas
 */
export async function executeAssignmentAlgorithm(): Promise<{
	success: boolean;
	message: string;
	stats: {
		totalStudents: number;
		totalAssignments: number;
		neurodivergentAssignments: number;
		fourthYearAssignments: number;
		thirdYearAssignments: number;
		lotteriesExecuted: number;
		studentsFullyAssigned: number;
		studentsPartiallyAssigned: number;
	};
}> {
	console.log("INICIANDO SISTEMA DE ASIGNACIÓN DE CURSOS");

	try {
		// =====================================================================
		// FASE 1: CARGA DE DATOS DESDE LA BASE DE DATOS
		// =====================================================================
		console.log("Cargando estudiantes y selecciones...");
		const students = await prisma.students.findMany({
			where: {
				selections: {
					some: {}, // Solo estudiantes que tienen al menos una selección
				},
			},
			include: {
				selections: {
					include: {
						courses: true, // Incluye información completa del curso
					},
					orderBy: {
						preference_order: "asc", // Ordena por preferencia (1ª, 2ª, 3ª, 4ª)
					},
				},
			},
		});

		if (students.length === 0) {
			throw new Error("No hay estudiantes con selecciones");
		}

		console.log(`${students.length} estudiantes cargados`);

		// Requisito adicional: debe existir al menos UN estudiante que haya elegido
		// sus prioridades para los 3 paralelos (1, 2 y 3). Si no existe ninguno,
		// la ejecución de la asignación no debe permitirse.
		const hasStudentWithAllParallels = students.some((s) => {
			const selectedParallels = new Set<number>(
				s.selections.map((sel: Selection) => sel.courses.parallel)
			);
			return [1, 2, 3].every((p) => selectedParallels.has(p));
		});

		if (!hasStudentWithAllParallels) {
			throw new Error(
				"No hay al menos un alumno que haya elegido sus prioridades para los paralelos 1, 2 y 3"
			);
		}

		// =====================================================================
		// FASE 2: CLASIFICACIÓN DE ESTUDIANTES POR GRUPOS DE PRIORIDAD
		// =====================================================================
		console.log("Clasificando estudiantes por prioridad...");

		// GRUPO 1: Estudiantes neurodivergentes (máxima prioridad)
		const neurodivergentStudents = students.filter((s) => s.is_neurodivergent);

		// GRUPO 2: Estudiantes de 4to medio no neurodivergentes (prioridad media)
		const fourthYearStudents = students.filter(
			(s) => !s.is_neurodivergent && s.level === 4
		);

		// GRUPO 3: Estudiantes de 3ro medio no neurodivergentes (prioridad baja)
		const thirdYearStudents = students.filter(
			(s) => !s.is_neurodivergent && s.level === 3
		);

		console.log(`  Neurodivergentes: ${neurodivergentStudents.length}`);
		console.log(`  4to medio: ${fourthYearStudents.length}`);
		console.log(`  3ro medio: ${thirdYearStudents.length}`);

		// =====================================================================
		// FASE 3: INICIALIZACIÓN DE CAPACIDADES DE CURSOS
		// =====================================================================
		console.log("Inicializando capacidades de cursos...");
		const courses = await prisma.courses.findMany();
		const courseCapacities = new Map<string, CourseCapacity>();

		// Crea un mapa para tracking eficiente de capacidades
		courses.forEach((course) => {
			courseCapacities.set(course.id, {
				courseId: course.id,
				courseName: course.name,
				parallel: course.parallel,
				capacity: course.capacity, // Capacidad máxima del curso
				assignedCount: 0, // Inicia en 0, se incrementa con cada asignación
			});
		});

		console.log(`${courses.length} cursos inicializados`);

		// =====================================================================
		// FASE 4: LIMPIEZA DE DATOS PREVIOS
		// =====================================================================
		console.log("Limpiando asignaciones previas...");
		await prisma.assignments.deleteMany({}); // Elimina asignaciones anteriores
		await prisma.lotteries.deleteMany({}); // Elimina sorteos anteriores
		console.log("Base de datos limpia");

		// =====================================================================
		// FASE 5: INICIALIZACIÓN DE ESTRUCTURAS DE CONTROL
		// =====================================================================
		const allAssignments: Assignment[] = []; // Acumula todas las asignaciones
		const lotteryRecords: LotteryRecord[] = []; // Registra todos los sorteos
		const studentAssignments = new Map<string, Set<number>>(); // Tracking de paralelos por estudiante

		// =====================================================================
		// FASE 6: PROCESAMIENTO SECUENCIAL POR GRUPOS DE PRIORIDAD
		// =====================================================================
		console.log("Asignando cursos por grupos de prioridad...");

		// PROCESAMIENTO GRUPO 1: Estudiantes neurodivergentes (máxima prioridad)
		// Se procesan primero, tienen acceso a todos los cupos disponibles
		const neurodivergentCount = await assignCoursesToStudentGroup(
			neurodivergentStudents,
			courseCapacities,
			studentAssignments,
			allAssignments,
			lotteryRecords,
			"Estudiantes Neurodivergentes",
			true // is_priority = true
		);

		// PROCESAMIENTO GRUPO 2: Estudiantes de 4to medio (prioridad media)
		// Se procesan después de neurodivergentes, acceso a cupos restantes
		const fourthYearCount = await assignCoursesToStudentGroup(
			fourthYearStudents,
			courseCapacities,
			studentAssignments,
			allAssignments,
			lotteryRecords,
			"Estudiantes de 4to Medio",
			true // is_priority = true
		);

		// PROCESAMIENTO GRUPO 3: Estudiantes de 3ro medio (prioridad baja)
		// Se procesan al final, acceso solo a cupos que sobren
		const thirdYearCount = await assignCoursesToStudentGroup(
			thirdYearStudents,
			courseCapacities,
			studentAssignments,
			allAssignments,
			lotteryRecords,
			"Estudiantes de 3ro Medio",
			false // is_priority = false
		);

		// =====================================================================
		// FASE 7: PERSISTENCIA DE ASIGNACIONES EN BASE DE DATOS
		// =====================================================================
		console.log("Guardando asignaciones en base de datos...");

		// Guarda todas las asignaciones de una vez para eficiencia
		await prisma.assignments.createMany({
			data: allAssignments.map((a) => ({
				student_id: a.student_id,
				course_id: a.course_id,
				preference_order: a.preference_order, // 1-4 = preferencia, 99 = disponibilidad
				is_priority: a.is_priority, // true para neurodivergentes y 4to medio
			})),
		});

		console.log(`${allAssignments.length} asignaciones guardadas`);

		// =====================================================================
		// FASE 8: PERSISTENCIA DE SORTEOS EN BASE DE DATOS
		// =====================================================================
		if (lotteryRecords.length > 0) {
			console.log("Guardando sorteos en base de datos...");

			// Guarda cada sorteo con sus ganadores y perdedores para transparencia y auditoria
			for (const lottery of lotteryRecords) {
				await prisma.lotteries.create({
					data: {
						course_id: lottery.course_id,
						course_name: lottery.course_name,
						parallel: lottery.parallel,
						preference: lottery.preference,
						candidates: lottery.candidates,
						available_spots: lottery.available_spots,
						lottery_results: {
							create: [
								// Crea registros para los ganadores del sorteo
								...lottery.winners.map((studentId: string) => {
									const student = students.find((s) => s.id === studentId);
									return {
										student_id: studentId,
										student_email: student?.email || "",
										won: true, // Ganó el sorteo
									};
								}),
								// Crea registros para los perdedores del sorteo
								...lottery.losers.map((studentId: string) => {
									const student = students.find((s) => s.id === studentId);
									return {
										student_id: studentId,
										student_email: student?.email || "",
										won: false, // Perdió el sorteo
									};
								}),
							],
						},
					},
				});
			}
			console.log(`${lotteryRecords.length} sorteos guardados`);
		}

		// =====================================================================
		// MOSTRAR ESTADO FINAL DE CAPACIDADES DE CURSOS
		// =====================================================================
		console.log("📈 ESTADO FINAL DE CAPACIDADES POR CURSO:");
		const coursesByParallel = new Map<number, CourseCapacity[]>();

		Array.from(courseCapacities.values()).forEach((course) => {
			if (!coursesByParallel.has(course.parallel)) {
				coursesByParallel.set(course.parallel, []);
			}
			coursesByParallel.get(course.parallel)!.push(course);
		});

		[1, 2, 3].forEach((parallel) => {
			console.log(`  PARALELO ${parallel}:`);
			const coursesInParallel = coursesByParallel.get(parallel) || [];
			coursesInParallel.forEach((course) => {
				const utilizationPercent = Math.round(
					(course.assignedCount / course.capacity) * 100
				);
				const status =
					course.assignedCount === course.capacity
						? "🔴 LLENO"
						: course.assignedCount > course.capacity * 0.8
						? "🟡 CASI LLENO"
						: "🟢 DISPONIBLE";
				console.log(
					`    "${course.courseName}": ${course.assignedCount}/${course.capacity} (${utilizationPercent}%) ${status}`
				);
			});
		});

		// =====================================================================
		// FASE 9: CÁLCULO DE ESTADÍSTICAS FINALES
		// =====================================================================
		console.log("Calculando estadísticas finales...");

		// Cuenta estudiantes que tienen exactamente 3 cursos (completo)
		const studentsFullyAssigned = students.filter((s) => {
			const assigned = studentAssignments.get(s.id);
			return assigned && assigned.size === 3; // Tiene curso en los 3 paralelos
		}).length;

		// Cuenta estudiantes que tienen 1 o 2 cursos (incompleto)
		const studentsPartiallyAssigned = students.filter((s) => {
			const assigned = studentAssignments.get(s.id);
			return assigned && assigned.size > 0 && assigned.size < 3;
		}).length;

		// Cuenta asignaciones por grupo para análisis de equidad
		const neurodivergentAssignments = allAssignments.filter((a) =>
			neurodivergentStudents.find((s) => s.id === a.student_id)
		).length;

		const fourthYearAssignments = allAssignments.filter((a) =>
			fourthYearStudents.find((s) => s.id === a.student_id)
		).length;

		const thirdYearAssignments = allAssignments.filter((a) =>
			thirdYearStudents.find((s) => s.id === a.student_id)
		).length;

		const stats = {
			totalStudents: students.length,
			totalAssignments: allAssignments.length,
			neurodivergentAssignments,
			fourthYearAssignments,
			thirdYearAssignments,
			lotteriesExecuted: lotteryRecords.length,
			studentsFullyAssigned,
			studentsPartiallyAssigned,
		};

		// =====================================================================
		// ANÁLISIS DETALLADO DE ESTUDIANTES CON ASIGNACIONES PARCIALES
		// =====================================================================
		if (stats.studentsPartiallyAssigned > 0) {
			console.log("⚠️  ESTUDIANTES CON ASIGNACIONES INCOMPLETAS:");
			students.forEach((student) => {
				const assigned = studentAssignments.get(student.id);
				const courseCount = assigned ? assigned.size : 0;
				if (courseCount > 0 && courseCount < 3) {
					const assignedParallels = assigned ? Array.from(assigned).sort() : [];
					const missingParallels = [1, 2, 3].filter(
						(p) => !assignedParallels.includes(p)
					);
					console.log(
						`  ${
							student.email
						}: ${courseCount}/3 cursos (Tiene: paralelo ${assignedParallels.join(
							", "
						)}, Falta: paralelo ${missingParallels.join(", ")})`
					);
				}
			});
		}

		// =====================================================================
		// ANÁLISIS DE SATISFACCIÓN DE PREFERENCIAS
		// =====================================================================
		console.log("📊 ANÁLISIS DE SATISFACCIÓN DE PREFERENCIAS:");
		const preferenceStats = {
			firstChoice: 0,
			secondChoice: 0,
			thirdChoice: 0,
			fourthChoice: 0,
			byAvailability: 0,
		};

		allAssignments.forEach((assignment) => {
			switch (assignment.preference_order) {
				case 1:
					preferenceStats.firstChoice++;
					break;
				case 2:
					preferenceStats.secondChoice++;
					break;
				case 3:
					preferenceStats.thirdChoice++;
					break;
				case 4:
					preferenceStats.fourthChoice++;
					break;
				case 99:
					preferenceStats.byAvailability++;
					break;
			}
		});

		console.log(
			`  1ª Preferencia: ${preferenceStats.firstChoice} (${Math.round(
				(preferenceStats.firstChoice / stats.totalAssignments) * 100
			)}%)`
		);
		console.log(
			`  2ª Preferencia: ${preferenceStats.secondChoice} (${Math.round(
				(preferenceStats.secondChoice / stats.totalAssignments) * 100
			)}%)`
		);
		console.log(
			`  3ª Preferencia: ${preferenceStats.thirdChoice} (${Math.round(
				(preferenceStats.thirdChoice / stats.totalAssignments) * 100
			)}%)`
		);
		console.log(
			`  4ª Preferencia: ${preferenceStats.fourthChoice} (${Math.round(
				(preferenceStats.fourthChoice / stats.totalAssignments) * 100
			)}%)`
		);
		console.log(
			`  Por disponibilidad: ${preferenceStats.byAvailability} (${Math.round(
				(preferenceStats.byAvailability / stats.totalAssignments) * 100
			)}%)`
		);

		console.log("==============================================");
		console.log("🎉 ASIGNACIÓN COMPLETADA EXITOSAMENTE");
		console.log(`  Total estudiantes: ${stats.totalStudents}`);
		console.log(`  Total asignaciones: ${stats.totalAssignments}`);
		console.log(`  Neurodivergentes: ${neurodivergentCount} asignaciones`);
		console.log(`  4to Medio: ${fourthYearCount} asignaciones`);
		console.log(`  3ro Medio: ${thirdYearCount} asignaciones`);
		console.log(`  Sorteos ejecutados: ${stats.lotteriesExecuted}`);
		console.log(`  Estudiantes con 3 cursos: ${stats.studentsFullyAssigned}`);
		console.log(
			`  Estudiantes con cursos parciales: ${stats.studentsPartiallyAssigned}`
		);
		console.log("==============================================");

		return {
			success: true,
			message: "Asignación completada exitosamente",
			stats,
		};
	} catch (error) {
		console.error("ERROR en el proceso de asignación:", error);
		return {
			success: false,
			message: `Error: ${
				error instanceof Error ? error.message : "Error desconocido"
			}`,
			stats: {
				totalStudents: 0,
				totalAssignments: 0,
				neurodivergentAssignments: 0,
				fourthYearAssignments: 0,
				thirdYearAssignments: 0,
				lotteriesExecuted: 0,
				studentsFullyAssigned: 0,
				studentsPartiallyAssigned: 0,
			},
		};
	}
}
