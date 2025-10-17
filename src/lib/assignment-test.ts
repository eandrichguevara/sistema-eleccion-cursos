import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tipos para el proceso de asignación
type StudentWithSelections = {
	id: string;
	email: string;
	level: number;
	is_neurodivergent: boolean;
	previous_electives: string[];
	role?: string;
	selections: Array<{
		id: string;
		course_id: string;
		preference_order: number;
		course: {
			id: string;
			name: string;
			parallel: number;
			capacity: number;
		};
	}>;
};

type CourseCapacity = {
	courseId: string;
	courseName: string;
	assignedCount: number;
	capacity: number;
};

type Assignment = {
	student_id: string;
	course_id: string;
	is_priority: boolean;
	preference_order: number;
};

/**
 * Ejecuta el algoritmo de asignación de cursos
 * Similar a la API Route pero con más logging para depuración
 */
async function runAssignmentTest() {
	console.log("🎯 INICIANDO PRUEBA DE ALGORITMO DE ASIGNACIÓN");
	console.log("=".repeat(80));
	console.log();

	try {
		// 1. Obtener todas las selecciones con datos de estudiantes y cursos
		console.log("📥 PASO 1: Obteniendo datos de la base de datos...");
		const studentsWithSelections = await prisma.student.findMany({
			where: {
				selections: {
					some: {}, // Solo estudiantes con al menos una selección
				},
			},
			include: {
				selections: {
					include: {
						course: true,
					},
					orderBy: {
						preference_order: "asc",
					},
				},
			},
		});

		console.log(
			`   ✓ Estudiantes con selecciones: ${studentsWithSelections.length}`
		);

		if (studentsWithSelections.length === 0) {
			console.log("❌ No hay selecciones para procesar");
			return;
		}

		// 2. Separar alumnos prioritarios
		console.log("\n📊 PASO 2: Clasificando estudiantes...");
		const priorityStudents: StudentWithSelections[] = [];
		const regularStudents: StudentWithSelections[] = [];

		studentsWithSelections.forEach((student) => {
			const isPriority =
				student.level === 4 ||
				(student.level === 3 && student.is_neurodivergent);
			if (isPriority) {
				priorityStudents.push(student);
			} else {
				regularStudents.push(student);
			}
		});

		console.log(`   ✓ Estudiantes prioritarios: ${priorityStudents.length}`);
		console.log(
			`     - 4to medio: ${
				priorityStudents.filter((s) => s.level === 4).length
			}`
		);
		console.log(
			`     - 3ro neurodivergentes: ${
				priorityStudents.filter((s) => s.level === 3 && s.is_neurodivergent)
					.length
			}`
		);
		console.log(`   ✓ Estudiantes regulares: ${regularStudents.length}`);

		// Inicializar capacidades de cursos
		const courseCapacities = new Map<string, CourseCapacity>();
		const allCourses = await prisma.course.findMany();

		allCourses.forEach((course) => {
			courseCapacities.set(course.id, {
				courseId: course.id,
				courseName: course.name,
				assignedCount: 0,
				capacity: course.capacity,
			});
		});

		console.log(`   ✓ Cursos disponibles: ${allCourses.length}`);
		console.log(
			`   ✓ Capacidad total: ${allCourses.reduce(
				(sum, c) => sum + c.capacity,
				0
			)} cupos`
		);

		// Lista para almacenar asignaciones
		const assignments: Assignment[] = [];

		// Rastrear qué paralelos ha sido asignado cada estudiante
		const studentAssignedParallels = new Map<string, Set<number>>();

		// 3. Asignar a estudiantes prioritarios (todos sus cursos - uno por paralelo)
		console.log("\n🎯 PASO 3: Asignando a estudiantes prioritarios...");
		let priorityCoursesAssigned = 0;
		let priorityStudentsFullyAssigned = 0;

		for (const student of priorityStudents) {
			studentAssignedParallels.set(student.id, new Set());
			const assignedParallels = studentAssignedParallels.get(student.id)!;
			let coursesAssignedToStudent = 0;

			// Intentar asignar los 3 cursos (uno por cada paralelo)
			for (const selection of student.selections) {
				const capacity = courseCapacities.get(selection.course_id);
				const courseParallel = selection.course.parallel;

				// Solo asignar si hay cupo y el estudiante no tiene curso en ese paralelo
				if (
					capacity &&
					capacity.assignedCount < capacity.capacity &&
					!assignedParallels.has(courseParallel)
				) {
					assignments.push({
						student_id: student.id,
						course_id: selection.course_id,
						is_priority: true,
						preference_order: selection.preference_order,
					});

					capacity.assignedCount++;
					assignedParallels.add(courseParallel);
					coursesAssignedToStudent++;
					priorityCoursesAssigned++;

					console.log(
						`   ✓ ${student.email.split("@")[0]} → ${
							selection.course.name
						} (Paralelo ${courseParallel}, Preferencia ${
							selection.preference_order
						})`
					);

					// Si ya tiene los 3 cursos, pasar al siguiente estudiante
					if (coursesAssignedToStudent === 3) {
						priorityStudentsFullyAssigned++;
						break;
					}
				}
			}

			if (coursesAssignedToStudent < 3) {
				console.log(
					`   ⚠️  ${
						student.email.split("@")[0]
					} - Solo ${coursesAssignedToStudent}/3 cursos asignados`
				);
			}
		}

		console.log(`\n   Resumen prioritarios:`);
		console.log(
			`   ✓ Estudiantes con 3 cursos: ${priorityStudentsFullyAssigned}/${priorityStudents.length}`
		);
		console.log(`   ✓ Total cursos asignados: ${priorityCoursesAssigned}`);
		console.log(
			`   ⚠️  Estudiantes incompletos: ${
				priorityStudents.length - priorityStudentsFullyAssigned
			}`
		);

		// 4. Asignar a estudiantes regulares (todos sus cursos - uno por paralelo)
		console.log("\n🎯 PASO 4: Asignando a estudiantes regulares...");

		let regularCoursesAssigned = 0;
		let regularStudentsFullyAssigned = 0;

		// Inicializar paralelos asignados para estudiantes regulares
		regularStudents.forEach((student) => {
			if (!studentAssignedParallels.has(student.id)) {
				studentAssignedParallels.set(student.id, new Set());
			}
		});

		// Procesar por preferencia (1, 2, 3...)
		const maxPreference = Math.max(
			...regularStudents.flatMap((s) =>
				s.selections.map((sel) => sel.preference_order)
			)
		);

		let tiebreaksApplied = 0;

		console.log(`   Procesando preferencias del 1 al ${maxPreference}...\n`);

		for (let preference = 1; preference <= maxPreference; preference++) {
			console.log(`   📌 Procesando preferencia ${preference}:`);

			// Agrupar estudiantes por curso en esta preferencia
			const courseGroups = new Map<string, StudentWithSelections[]>();

			regularStudents.forEach((student) => {
				const selection = student.selections.find(
					(s) => s.preference_order === preference
				);
				if (selection) {
					const assignedParallels = studentAssignedParallels.get(student.id)!;
					const courseParallel = selection.course.parallel;

					// Solo considerar si el estudiante no tiene curso en ese paralelo
					if (!assignedParallels.has(courseParallel)) {
						if (!courseGroups.has(selection.course_id)) {
							courseGroups.set(selection.course_id, []);
						}
						courseGroups.get(selection.course_id)!.push(student);
					}
				}
			});

			console.log(`      Grupos encontrados: ${courseGroups.size}`);

			// Procesar cada grupo de forma secuencial para poder usar await
			for (const [courseId, students] of courseGroups.entries()) {
				const capacity = courseCapacities.get(courseId);

				if (!capacity) {
					console.log(`      ⚠️ Curso no encontrado: ${courseId}`);
					continue;
				}

				const availableSpots = capacity.capacity - capacity.assignedCount;

				console.log(
					`      📝 ${capacity.courseName}: ${students.length} estudiantes, ${availableSpots} cupos disponibles`
				);

				if (availableSpots <= 0) {
					console.log(`         ❌ Sin cupos disponibles`);
					continue;
				}

				let studentsToAssign: StudentWithSelections[];

				if (students.length > availableSpots) {
					// Aplicar desempate aleatorio (Fisher-Yates shuffle)
					tiebreaksApplied++;

					const shuffled = [...students];
					for (let i = shuffled.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
					}
					studentsToAssign = shuffled.slice(0, availableSpots);

					console.log(
						`      ⚡ DESEMPATE: ${capacity.courseName} - ${students.length} candidatos, ${availableSpots} cupos`
					);

					// 🎲 REGISTRAR SORTEO EN LA BASE DE DATOS
					const courseData = allCourses.find((c) => c.id === courseId);
					const lottery = await prisma.lottery.create({
						data: {
							course_id: courseId,
							course_name: capacity.courseName,
							parallel: courseData?.parallel || 0,
							preference: preference,
							candidates: students.length,
							available_spots: availableSpots,
							lottery_results: {
								create: shuffled.map((student, index) => ({
									student_id: student.id,
									student_email: student.email,
									won: index < availableSpots, // Los primeros N ganan
								})),
							},
						},
					});

					console.log(
						`      📊 Sorteo registrado con ID: ${lottery.id.substring(
							0,
							8
						)}...`
					);
				} else {
					studentsToAssign = students;
				}

				// Asignar a los estudiantes seleccionados
				const courseData = allCourses.find((c) => c.id === courseId);
				const courseParallel = courseData?.parallel;

				for (const student of studentsToAssign) {
					assignments.push({
						student_id: student.id,
						course_id: courseId,
						is_priority: false,
						preference_order: preference,
					});

					capacity.assignedCount++;
					if (courseParallel) {
						studentAssignedParallels.get(student.id)!.add(courseParallel);
					}
					regularCoursesAssigned++;
				}

				if (students.length > availableSpots) {
					console.log(
						`      ✓ Asignados ${studentsToAssign.length} estudiantes a ${capacity.courseName}`
					);
				}
			}
		}

		// Contar cuántos estudiantes regulares tienen sus 3 cursos
		regularStudents.forEach((student) => {
			const assignedParallels = studentAssignedParallels.get(student.id)!;
			if (assignedParallels.size === 3) {
				regularStudentsFullyAssigned++;
			}
		});

		console.log(`\n   Resumen regulares:`);
		console.log(
			`   ✓ Estudiantes con 3 cursos: ${regularStudentsFullyAssigned}/${regularStudents.length}`
		);
		console.log(`   ✓ Total cursos asignados: ${regularCoursesAssigned}`);
		console.log(
			`   ⚠️  Estudiantes incompletos: ${
				regularStudents.length - regularStudentsFullyAssigned
			}`
		);
		console.log(`   ⚡ Desempates aplicados: ${tiebreaksApplied}`);

		// 4.5 Asignar cursos faltantes a estudiantes incompletos
		const incompleteStudents = [...priorityStudents, ...regularStudents].filter(
			(student) => {
				const assignedParallels = studentAssignedParallels.get(student.id)!;
				return assignedParallels.size < 3;
			}
		);

		if (incompleteStudents.length > 0) {
			console.log(
				`\n🔄 PASO 4.5: Completando asignaciones para ${incompleteStudents.length} estudiantes...`
			);

			let coursesAssignedInFallback = 0;

			for (const student of incompleteStudents) {
				const assignedParallels = studentAssignedParallels.get(student.id)!;
				const missingParallels = [1, 2, 3].filter(
					(p) => !assignedParallels.has(p)
				);

				console.log(
					`   ${
						student.email.split("@")[0]
					} - Faltan paralelos: ${missingParallels.join(", ")}`
				);

				// Intentar asignar en cada paralelo faltante
				for (const parallelId of missingParallels) {
					// Buscar cursos disponibles en este paralelo
					const availableCourses = Array.from(courseCapacities.values()).filter(
						(cap) => {
							const course = allCourses.find((c) => c.id === cap.courseId);
							return (
								course &&
								course.parallel === parallelId &&
								cap.assignedCount < cap.capacity
							);
						}
					);

					if (availableCourses.length > 0) {
						// Asignar a un curso aleatorio disponible
						const targetCourse =
							availableCourses[
								Math.floor(Math.random() * availableCourses.length)
							];

						const isPriority =
							student.level === 4 ||
							(student.level === 3 && student.is_neurodivergent);

						assignments.push({
							student_id: student.id,
							course_id: targetCourse.courseId,
							is_priority: isPriority,
							preference_order: 99, // Marcador especial para asignación por disponibilidad
						});

						targetCourse.assignedCount++;
						assignedParallels.add(parallelId);
						coursesAssignedInFallback++;

						if (isPriority) {
							priorityCoursesAssigned++;
						} else {
							regularCoursesAssigned++;
						}

						console.log(
							`      ✓ ${student.email.split("@")[0]} → ${
								targetCourse.courseName
							} (Paralelo ${parallelId}, Por disponibilidad)`
						);
					} else {
						console.log(
							`      ⚠️  No hay cursos disponibles en Paralelo ${parallelId} para ${
								student.email.split("@")[0]
							}`
						);
					}
				}
			}

			// Recalcular estudiantes con asignaciones completas
			priorityStudentsFullyAssigned = 0;
			regularStudentsFullyAssigned = 0;

			priorityStudents.forEach((student) => {
				const assignedParallels = studentAssignedParallels.get(student.id)!;
				if (assignedParallels.size === 3) {
					priorityStudentsFullyAssigned++;
				}
			});

			regularStudents.forEach((student) => {
				const assignedParallels = studentAssignedParallels.get(student.id)!;
				if (assignedParallels.size === 3) {
					regularStudentsFullyAssigned++;
				}
			});

			console.log(
				`\n   ✓ Cursos asignados por disponibilidad: ${coursesAssignedInFallback}`
			);
			console.log(
				`   ✓ Estudiantes ahora con 3 cursos: ${
					priorityStudentsFullyAssigned + regularStudentsFullyAssigned
				}/${studentsWithSelections.length}`
			);
		}

		// 5. Guardar en la base de datos
		console.log("\n💾 PASO 5: Guardando asignaciones en la base de datos...");

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (prisma as any).assignment.deleteMany({});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (prisma as any).assignment.createMany({
			data: assignments,
		});

		console.log(
			`   ✓ ${assignments.length} asignaciones guardadas exitosamente`
		);

		// 6. Muestra de asignaciones (10 estudiantes aleatorios con sus 3 cursos)
		console.log(
			"\n👥 MUESTRA DE ASIGNACIONES (10 estudiantes con sus 3 cursos)"
		);
		console.log("=".repeat(80));

		// Seleccionar 10 estudiantes aleatorios
		const shuffledStudents = [...studentsWithSelections].sort(
			() => Math.random() - 0.5
		);
		const sampleStudents = shuffledStudents.slice(0, 10);

		for (const student of sampleStudents) {
			// Obtener todas las asignaciones de este estudiante
			const studentAssignments = assignments.filter(
				(a) => a.student_id === student.id
			);

			const priorityIcon =
				student.level === 4 ||
				(student.level === 3 && student.is_neurodivergent)
					? "⭐"
					: "  ";
			const studentInfo = `${priorityIcon} ${student.email.split("@")[0]} (${
				student.level
			}° medio)`;

			console.log(`\n${studentInfo}:`);

			if (studentAssignments.length > 0) {
				// Agrupar por paralelo
				const coursesByParallel = new Map<
					number,
					(typeof studentAssignments)[0]
				>();

				for (const assignment of studentAssignments) {
					const courseData = courseCapacities.get(assignment.course_id);
					if (courseData) {
						const fullCourse = allCourses.find(
							(c) => c.id === assignment.course_id
						);
						if (fullCourse) {
							coursesByParallel.set(fullCourse.parallel, assignment);
						}
					}
				}

				// Mostrar cursos ordenados por paralelo
				const sortedParallels = Array.from(coursesByParallel.keys()).sort(
					(a, b) => a - b
				);

				for (const parallel of sortedParallels) {
					const assignment = coursesByParallel.get(parallel);
					if (assignment) {
						const course = courseCapacities.get(assignment.course_id);
						const preferenceText =
							assignment.preference_order === 99
								? "Por disponibilidad"
								: `${assignment.preference_order}ª preferencia`;

						console.log(
							`   Paralelo ${parallel}: ${course?.courseName.padEnd(
								30
							)} (${preferenceText})`
						);
					}
				}

				console.log(
					`   Total: ${studentAssignments.length} curso(s) asignado(s)`
				);
			} else {
				console.log(`   ❌ SIN ASIGNACIONES`);
			}
		}

		// 7. Estadísticas finales
		console.log("\n📊 ESTADÍSTICAS FINALES");
		console.log("=".repeat(80));
		console.log(`\n📈 General:`);
		console.log(`   • Total de estudiantes: ${studentsWithSelections.length}`);
		console.log(
			`   • Total asignados: ${assignments.length} (${Math.round(
				(assignments.length / studentsWithSelections.length) * 100
			)}%)`
		);
		console.log(
			`   • Sin asignar: ${studentsWithSelections.length - assignments.length}`
		);
		console.log(`   • Desempates aplicados: ${tiebreaksApplied}`);

		console.log(`\n🎯 Por categoría:`);
		console.log(
			`   • Cursos asignados a prioritarios: ${priorityCoursesAssigned} (${priorityStudentsFullyAssigned} estudiantes con 3 cursos)`
		);
		console.log(
			`   • Cursos asignados a regulares: ${regularCoursesAssigned} (${regularStudentsFullyAssigned} estudiantes con 3 cursos)`
		);

		console.log(`\n📚 Utilización de cursos:`);
		const sortedCapacities = Array.from(courseCapacities.values()).sort(
			(a, b) => b.assignedCount - a.assignedCount
		);

		for (const capacity of sortedCapacities) {
			const utilization = Math.round(
				(capacity.assignedCount / capacity.capacity) * 100
			);
			const bar = "█".repeat(Math.floor(utilization / 5));
			const status = capacity.assignedCount >= capacity.capacity ? "🔴" : "🟢";

			console.log(
				`   ${status} ${capacity.courseName.padEnd(30)} ${capacity.assignedCount
					.toString()
					.padStart(3)}/${capacity.capacity} [${bar.padEnd(
					20
				)}] ${utilization}%`
			);
		}

		// Análisis de preferencias asignadas
		console.log(`\n🎲 Distribución de preferencias asignadas:`);
		const preferenceDistribution = new Map<number, number>();

		for (const assignment of assignments) {
			const count =
				preferenceDistribution.get(assignment.preference_order) || 0;
			preferenceDistribution.set(assignment.preference_order, count + 1);
		}

		const sortedPreferences = Array.from(preferenceDistribution.entries()).sort(
			(a, b) => a[0] - b[0]
		);
		for (const [preference, count] of sortedPreferences) {
			const percent = Math.round((count / assignments.length) * 100);
			console.log(
				`   ${preference}ª preferencia: ${count} estudiantes (${percent}%)`
			);
		}

		console.log("\n✅ PRUEBA COMPLETADA EXITOSAMENTE!\n");
	} catch (error) {
		console.error("\n❌ ERROR durante la prueba:", error);
		throw error;
	}
}

// Ejecutar el test
runAssignmentTest()
	.then(async () => {
		await prisma.$disconnect();
		process.exit(0);
	})
	.catch(async (error) => {
		console.error("❌ Error fatal:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
