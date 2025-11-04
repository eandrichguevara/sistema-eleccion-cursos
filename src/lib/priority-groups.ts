import { PriorityGroup } from "../types/assignment";

/**
 * Determina el grupo de prioridad de un estudiante según campos mínimos.
 * - Neurodivergent (cualquier nivel) -> PriorityGroup.NEURODIVERGENT
 * - level === 4 -> PriorityGroup.FOURTH_YEAR
 * - otherwise -> PriorityGroup.THIRD_YEAR
 */
export function getPriorityGroup(student: {
	is_neurodivergent?: boolean;
	level?: number;
}): PriorityGroup {
	if (student.is_neurodivergent) return PriorityGroup.NEURODIVERGENT;
	if (student.level === 4) return PriorityGroup.FOURTH_YEAR;
	return PriorityGroup.THIRD_YEAR;
}

/**
 * Agrupa estudiantes por categoría prioritaria.
 * @param students Array de objetos estudiante (de prisma u objeto similar)
 * @returns Objeto con keys por PriorityGroup y arrays de estudiantes
 */
export function groupStudentsByPriority<T extends { id: string }>(
	students: Array<T & { is_neurodivergent?: boolean; level?: number }>
): Record<
	PriorityGroup,
	Array<T & { is_neurodivergent?: boolean; level?: number }>
> {
	const groups: Record<
		PriorityGroup,
		Array<T & { is_neurodivergent?: boolean; level?: number }>
	> = {
		[PriorityGroup.NEURODIVERGENT]: [],
		[PriorityGroup.FOURTH_YEAR]: [],
		[PriorityGroup.THIRD_YEAR]: [],
	};

	for (const s of students) {
		const key = getPriorityGroup(s);
		groups[key].push(s);
	}

	return groups;
}

const _default = {
	getPriorityGroup,
	groupStudentsByPriority,
};

export default _default;
