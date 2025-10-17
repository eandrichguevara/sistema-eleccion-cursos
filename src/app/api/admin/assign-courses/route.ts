import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tipos para el proceso de asignación
type StudentWithSelections = {
	id: string;
	email: string;
	level: number;
	is_neurodivergent: boolean;
	previous_electives: string[];
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
	assignedCount: number;
	capacity: number;
};

/**
 * POST /api/admin/assign-courses
 * Ejecuta el algoritmo de asignación de cursos
 * Solo accesible para administradores
 */
export async function POST() {
	try {
		// Verificar autenticación
		const session = await getServerSession(authOptions);
		if (!session?.user?.email) {
			return NextResponse.json({ error: "No autenticado" }, { status: 401 });
		}

		// Verificar que el usuario es administrador
		const user = await prisma.student.findUnique({
			where: { email: session.user.email },
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (!user || (user as any).role !== "admin") {
			return NextResponse.json(
				{ error: "No autorizado. Solo administradores pueden asignar cursos." },
				{ status: 403 }
			);
		}

		// 1. Obtener todas las selecciones con datos de estudiantes y cursos
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
						preference_order: "asc", // Ordenar por preferencia
					},
				},
			},
		});

		if (studentsWithSelections.length === 0) {
			return NextResponse.json(
				{ error: "No hay selecciones para procesar" },
				{ status: 400 }
			);
		}

		// 2. Separar alumnos prioritarios (4to medio o 3ro neurodivergentes)
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

		// Mapa para rastrear cupos disponibles por curso
		const courseCapacities = new Map<string, CourseCapacity>();

		// Inicializar capacidades de todos los cursos
		const allCourses = await prisma.course.findMany();
		allCourses.forEach((course) => {
			courseCapacities.set(course.id, {
				courseId: course.id,
				assignedCount: 0,
				capacity: course.capacity,
			});
		});

		// Lista para almacenar todas las asignaciones
		const assignments: Array<{
			student_id: string;
			course_id: string;
			is_priority: boolean;
			preference_order: number;
		}> = [];

		// 3. Asignar cursos a alumnos prioritarios
		console.log(
			`Asignando cursos a ${priorityStudents.length} alumnos prioritarios...`
		);

		for (const student of priorityStudents) {
			let assigned = false;

			// Intentar asignar según orden de preferencia
			for (const selection of student.selections) {
				const capacity = courseCapacities.get(selection.course_id);

				if (capacity && capacity.assignedCount < capacity.capacity) {
					// Hay cupo disponible
					assignments.push({
						student_id: student.id,
						course_id: selection.course_id,
						is_priority: true,
						preference_order: selection.preference_order,
					});

					// Actualizar contador de cupos
					capacity.assignedCount++;
					assigned = true;
					break;
				}
			}

			if (!assigned) {
				console.warn(
					`No se pudo asignar curso al estudiante prioritario: ${student.email}`
				);
			}
		}

		// 4. Asignar cursos al resto de alumnos
		console.log(
			`Asignando cursos a ${regularStudents.length} alumnos regulares...`
		);

		// Agrupar estudiantes por preferencia y curso para aplicar desempate
		const coursePreferenceGroups = new Map<string, StudentWithSelections[]>();

		regularStudents.forEach((student) => {
			student.selections.forEach((selection) => {
				const key = `${selection.course_id}___${selection.preference_order}`;
				if (!coursePreferenceGroups.has(key)) {
					coursePreferenceGroups.set(key, []);
				}
				coursePreferenceGroups.get(key)!.push(student);
			});
		});

		// Procesar por orden de preferencia (1ra, 2da, 3ra...)
		const maxPreference = Math.max(
			...regularStudents.flatMap((s) =>
				s.selections.map((sel) => sel.preference_order)
			)
		);

		const assignedStudents = new Set<string>();

		for (let preference = 1; preference <= maxPreference; preference++) {
			// Para cada curso en esta preferencia
			const relevantGroups = Array.from(
				coursePreferenceGroups.entries()
			).filter(([key]) => key.endsWith(`___${preference}`));

			for (const [key, students] of relevantGroups) {
				const courseId = key.split("___")[0];
				const capacity = courseCapacities.get(courseId);

				if (!capacity) continue;

				// Filtrar estudiantes que ya fueron asignados
				const availableStudents = students.filter(
					(s) => !assignedStudents.has(s.id)
				);
				const availableSpots = capacity.capacity - capacity.assignedCount;

				if (availableSpots <= 0 || availableStudents.length === 0) continue;

				// Si hay más estudiantes que cupos, hacer desempate aleatorio
				let studentsToAssign: StudentWithSelections[];
				if (availableStudents.length > availableSpots) {
					// Shuffle aleatorio (Fisher-Yates)
					const shuffled = [...availableStudents];
					for (let i = shuffled.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
					}
					studentsToAssign = shuffled.slice(0, availableSpots);
				} else {
					studentsToAssign = availableStudents;
				}

				// Asignar a los estudiantes seleccionados
				for (const student of studentsToAssign) {
					assignments.push({
						student_id: student.id,
						course_id: courseId,
						is_priority: false,
						preference_order: preference,
					});

					capacity.assignedCount++;
					assignedStudents.add(student.id);
				}
			}
		}

		// 4.5. Asignar estudiantes regulares no asignados a cursos disponibles en sus paralelos
		const regularUnassignedCount =
			regularStudents.length - assignedStudents.size;
		if (regularUnassignedCount > 0) {
			console.log(
				`\n📋 PASO 4.5: Asignando ${regularUnassignedCount} estudiantes regulares no asignados a cursos disponibles...`
			);

			const unassignedStudents = regularStudents.filter(
				(s) => !assignedStudents.has(s.id)
			);

			for (const student of unassignedStudents) {
				// Obtener los IDs de los paralelos que este estudiante seleccionó
				const parallelIds = [
					...new Set(student.selections.map((s) => s.course.parallel)),
				];

				let assigned = false;

				// Intentar asignar en cada paralelo que el estudiante seleccionó
				for (const parallelId of parallelIds) {
					// Buscar cursos disponibles en este paralelo
					const availableCourses: CourseCapacity[] = [];

					for (const [courseId, capacity] of courseCapacities) {
						const course = allCourses.find((c) => c.id === courseId);
						if (
							course &&
							course.parallel === parallelId &&
							capacity.assignedCount < capacity.capacity
						) {
							availableCourses.push(capacity);
						}
					}

					if (availableCourses.length > 0) {
						// Si hay varios cursos disponibles, elegir uno al azar
						const randomIndex = Math.floor(
							Math.random() * availableCourses.length
						);
						const targetCourse = availableCourses[randomIndex];

						// Crear la asignación con preference_order: 99 (indica asignación por disponibilidad)
						assignments.push({
							student_id: student.id,
							course_id: targetCourse.courseId,
							is_priority: false,
							preference_order: 99, // Marcador especial para "asignado por disponibilidad"
						});

						// Actualizar contadores
						targetCourse.assignedCount++;
						assignedStudents.add(student.id);

						const courseName = allCourses.find(
							(c) => c.id === targetCourse.courseId
						)?.name;

						console.log(
							`✓ ${student.email} → ${courseName} (Por disponibilidad, Paralelo ${parallelId})`
						);

						assigned = true;
						break; // Una vez asignado en un paralelo, pasar al siguiente estudiante
					}
				}

				if (!assigned) {
					console.log(
						`⚠️ No se pudo asignar a ${student.email} (sin cursos disponibles en sus paralelos)`
					);
				}
			}

			const finalUnassigned = regularStudents.length - assignedStudents.size;
			console.log(
				`\n📊 Estudiantes regulares sin asignar después del fallback: ${finalUnassigned}`
			);
		}

		// 5. Guardar todas las asignaciones en la base de datos
		console.log(
			`Guardando ${assignments.length} asignaciones en la base de datos...`
		);

		// Limpiar asignaciones anteriores (opcional)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (prisma as any).assignment.deleteMany({});

		// Crear nuevas asignaciones
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (prisma as any).assignment.createMany({
			data: assignments,
		});

		// Obtener estadísticas
		const stats = {
			totalStudents: studentsWithSelections.length,
			priorityStudents: priorityStudents.length,
			regularStudents: regularStudents.length,
			totalAssignments: assignments.length,
			studentsAssigned:
				assignedStudents.size +
				priorityStudents.filter((s) =>
					assignments.some((a) => a.student_id === s.id)
				).length,
			studentsUnassigned:
				studentsWithSelections.length -
				assignedStudents.size -
				priorityStudents.filter((s) =>
					assignments.some((a) => a.student_id === s.id)
				).length,
			courseUtilization: Array.from(courseCapacities.values()).map((c) => ({
				courseId: c.courseId,
				assigned: c.assignedCount,
				capacity: c.capacity,
				utilizationPercent: Math.round((c.assignedCount / c.capacity) * 100),
			})),
		};

		return NextResponse.json({
			success: true,
			message: "Asignación de cursos completada exitosamente",
			stats,
		});
	} catch (error) {
		console.error("Error en asignación de cursos:", error);
		return NextResponse.json(
			{
				error: "Error al procesar asignaciones",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
