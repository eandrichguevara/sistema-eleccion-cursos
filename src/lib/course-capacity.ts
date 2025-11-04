/**
 * Utilidades para agrupar cursos por paralelo y validar capacidades disponibles
 */

export interface CourseCapacity {
	courseId: string;
	courseName: string;
	parallel: number;
	capacity: number;
	assignedCount: number;
}

/**
 * Agrupa un array de CourseCapacity por su campo `parallel`.
 * @returns Map where key is parallel (number) and value is array of CourseCapacity
 */
export function groupCoursesByParallel(
	courses: CourseCapacity[]
): Map<number, CourseCapacity[]> {
	const m = new Map<number, CourseCapacity[]>();
	for (const c of courses) {
		if (!m.has(c.parallel)) m.set(c.parallel, []);
		m.get(c.parallel)!.push(c);
	}
	return m;
}

/**
 * Devuelve los cursos de un paralelo que todavía tienen cupos disponibles.
 */
export function availableCoursesInParallel(
	courses: CourseCapacity[],
	parallel: number
): CourseCapacity[] {
	return courses.filter(
		(c) => c.parallel === parallel && c.assignedCount < c.capacity
	);
}

/**
 * Calcula la capacidad total, asignados totales y cupos disponibles por paralelo.
 * @param courses
 */
export function capacitySummaryByParallel(
	courses: CourseCapacity[]
): Map<number, { totalCapacity: number; assigned: number; available: number }> {
	const map = new Map<
		number,
		{ totalCapacity: number; assigned: number; available: number }
	>();
	for (const c of courses) {
		const cur = map.get(c.parallel) ?? {
			totalCapacity: 0,
			assigned: 0,
			available: 0,
		};
		cur.totalCapacity += c.capacity;
		cur.assigned += c.assignedCount;
		cur.available = cur.totalCapacity - cur.assigned;
		map.set(c.parallel, cur);
	}
	return map;
}

/**
 * Valida que NO existan cursos con assignedCount > capacity y que la capacidad total por paralelo
 * sea suficiente (opcionalmente) para un número esperado de estudiantes.
 * @param courses
 * @param expectedStudentsPerParallel Optional: número esperado de estudiantes que deberían poder ser asignados por paralelo
 */
export function validateCourseCapacities(
	courses: CourseCapacity[],
	expectedStudentsPerParallel?: number
): { ok: boolean; issues: string[] } {
	const issues: string[] = [];

	for (const c of courses) {
		if (c.assignedCount > c.capacity) {
			issues.push(
				`Curso ${c.courseName} (${c.courseId}) en paralelo ${c.parallel} tiene assignedCount=${c.assignedCount} > capacity=${c.capacity}`
			);
		}
		if (c.capacity < 0) {
			issues.push(
				`Curso ${c.courseName} (${c.courseId}) tiene capacidad negativa: ${c.capacity}`
			);
		}
	}

	if (typeof expectedStudentsPerParallel === "number") {
		const summary = capacitySummaryByParallel(courses);
		for (const [parallel, s] of summary.entries()) {
			if (s.totalCapacity < expectedStudentsPerParallel) {
				issues.push(
					`Paralelo ${parallel} tiene capacidad total ${s.totalCapacity} < esperado ${expectedStudentsPerParallel}`
				);
			}
		}
	}

	return { ok: issues.length === 0, issues };
}

const _default = {
	groupCoursesByParallel,
	availableCoursesInParallel,
	capacitySummaryByParallel,
	validateCourseCapacities,
};

export default _default;
