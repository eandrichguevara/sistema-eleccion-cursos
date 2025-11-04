/**
 * Tipos relacionados con prioridades de estudiantes y estados de asignación
 *
 * Estos tipos se usan para representar los grupos prioritarios (neurodivergentes,
 * 4to medio, 3ro medio) y los estados/resultados de la asignación para un estudiante
 * o una ejecución.
 */

// Grupos de prioridad usados por el algoritmo de asignación
export enum PriorityGroup {
	NEURODIVERGENT = "NEURODIVERGENT",
	FOURTH_YEAR = "FOURTH_YEAR",
	THIRD_YEAR = "THIRD_YEAR",
}

// Información descriptiva de un grupo de prioridad
export interface PriorityGroupInfo {
	key: PriorityGroup;
	// Etiqueta legible para UI/reportes
	label: string;
	// Descripción corta
	description?: string;
	// Orden de procesamiento (1 = mayor prioridad)
	order: number;
	// Indica si este grupo se considera 'prioritario' (para flags de auditoría)
	isPriority: boolean;
}

// Estados de asignación para un estudiante en el conjunto de paralelos
export enum AssignmentStatus {
	// El estudiante no tiene ninguna asignación
	UNASSIGNED = "UNASSIGNED",
	// El estudiante tiene entre 1 y 2 cursos asignados (incompleto)
	PARTIALLY_ASSIGNED = "PARTIALLY_ASSIGNED",
	// El estudiante tiene los 3 cursos (completo)
	FULLY_ASSIGNED = "FULLY_ASSIGNED",
	// Asignación realizada por disponibilidad (no por preferencia)
	ASSIGNED_BY_AVAILABILITY = "ASSIGNED_BY_AVAILABILITY",
}

// Representa el resumen de asignaciones para un estudiante (útil para reportes)
export interface StudentAssignmentSummary {
	studentId: string;
	email?: string;
	priorityGroup: PriorityGroup;
	// Paralelos asignados (map paralelo -> courseId)
	assignedParallels: Record<number, string | null>;
	status: AssignmentStatus;
	// Número total de cursos asignados (0..3)
	assignedCount: number;
}

// Tipo simple para indicar por qué una asignación es prioritaria
export type PriorityReason = "NEURODIVERGENT" | "FOURTH_YEAR" | "NONE";

// Registro que describe una decisión de asignación (útil para auditoría en memoria)
export interface AssignmentDecision {
	studentId: string;
	courseId: string;
	parallel: number; // 1,2,3
	preferenceOrder: number | 99; // 1-4 = preferencia, 99 = por disponibilidad
	isPriority: boolean;
	priorityReason?: PriorityReason;
	assignmentRunId?: string; // opcional, vinculado a assignment_runs
}

// Export de una lista por defecto de grupos con metadata (útil para componentes)
export const PRIORITY_GROUPS: PriorityGroupInfo[] = [
	{
		key: PriorityGroup.NEURODIVERGENT,
		label: "Neurodivergentes",
		description:
			"Estudiantes con prioridad máxima por condición neurodivergente",
		order: 1,
		isPriority: true,
	},
	{
		key: PriorityGroup.FOURTH_YEAR,
		label: "4to Medio",
		description: "Estudiantes de 4to medio (prioridad media)",
		order: 2,
		isPriority: true,
	},
	{
		key: PriorityGroup.THIRD_YEAR,
		label: "3ro Medio",
		description: "Estudiantes de 3ro medio (prioridad baja)",
		order: 3,
		isPriority: false,
	},
];

const _default = {
	PriorityGroup,
	AssignmentStatus,
	PRIORITY_GROUPS,
};

export default _default;
