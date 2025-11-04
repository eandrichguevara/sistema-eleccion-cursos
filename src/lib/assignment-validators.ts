import { prisma } from "./prisma";
import { recordAssignmentConflicts } from "./audit-logger";
import type { PrismaClient, Prisma } from "@prisma/client";

type _AssignmentRow = {
	student_id: string;
	course_id?: string | null;
	courses?: {
		id?: string | null;
		name?: string | null;
		parallel?: number | null;
	} | null;
	students?: { email?: string | null } | null;
};

type _StudentRow = { id: string; email?: string | null };

/**
 * Valida, a partir de una estructura en memoria que mapea studentId -> Set(parallels),
 * que cada estudiante tenga exactamente un curso por paralelo (1,2,3).
 *
 * @param studentAssignments Map studentId => Set of assigned parallels (numbers)
 * @returns Array con el estado por estudiante (assignedParallels y missingParallels)
 */
export function validateStudentAssignmentsMap(
	studentAssignments: Map<string, Set<number>>
): Array<{
	studentId: string;
	assignedParallels: number[];
	missingParallels: number[];
}> {
	const results: Array<{
		studentId: string;
		assignedParallels: number[];
		missingParallels: number[];
	}> = [];

	for (const [studentId, parallelsSet] of studentAssignments.entries()) {
		const assigned = Array.from(parallelsSet).sort((a, b) => a - b);
		const missing = [1, 2, 3].filter((p) => !parallelsSet.has(p));

		results.push({
			studentId,
			assignedParallels: assigned,
			missingParallels: missing,
		});
	}

	return results;
}

/**
 * Consulta la base de datos y valida que cada estudiante tenga exactamente un curso
 * asignado por cada paralelo (1,2,3). Devuelve la lista de estudiantes que NO cumplen.
 *
 * Nota: esta función asume que la tabla `assignments` guarda asignaciones finales y que
 * cada asignación referencia a `courses` (con campo `parallel`).
 */
export async function validateAssignmentsInDB(
	prismaClient?: PrismaClient | Prisma.TransactionClient
): Promise<
	Array<{
		studentId: string;
		email?: string | null;
		assignedParallels: number[];
		missingParallels: number[];
	}>
> {
	const db: PrismaClient | Prisma.TransactionClient = prismaClient ?? prisma;

	// Trae todas las asignaciones con información de curso y estudiante
	const assignments: _AssignmentRow[] = await db.assignments.findMany({
		include: { courses: true, students: true },
	});

	// Construye un mapa studentId -> Set(parallels)
	const map = new Map<string, Set<number>>();
	const emailMap = new Map<string, string | null>();

	assignments.forEach((a: _AssignmentRow) => {
		const sid = a.student_id;
		const parallel = a.courses?.parallel ?? null;

		if (!map.has(sid)) map.set(sid, new Set());
		if (typeof parallel === "number") map.get(sid)!.add(parallel);

		if (!emailMap.has(sid)) emailMap.set(sid, a.students?.email ?? null);
	});

	// También considera estudiantes sin asignaciones
	const students: _StudentRow[] = await db.students.findMany({
		select: { id: true, email: true },
	});
	students.forEach((s: _StudentRow) => {
		if (!map.has(s.id)) map.set(s.id, new Set());
		if (!emailMap.has(s.id)) emailMap.set(s.id, s.email ?? null);
	});

	const results: Array<{
		studentId: string;
		email?: string | null;
		assignedParallels: number[];
		missingParallels: number[];
	}> = [];

	for (const [studentId, parallelsSet] of map.entries()) {
		const assigned = Array.from(parallelsSet).sort((a, b) => a - b);
		const missing = [1, 2, 3].filter((p) => !parallelsSet.has(p));

		if (missing.length > 0) {
			results.push({
				studentId,
				email: emailMap.get(studentId) ?? null,
				assignedParallels: assigned,
				missingParallels: missing,
			});
		}
	}

	return results;
}

/**
 * Helper que lanza un error si existe al menos un estudiante sin 3 paralelos asignados.
 * Útil para validaciones post-proceso en scripts o tests.
 */
export async function assertAllStudentsFullyAssigned(): Promise<void> {
	const failures = await validateAssignmentsInDB();
	if (failures.length > 0) {
		const sample = failures
			.slice(0, 10)
			.map((f) => ({ studentId: f.studentId, missing: f.missingParallels }));
		throw new Error(
			`Hay ${
				failures.length
			} estudiantes sin 3 paralelos asignados. Ejemplos: ${JSON.stringify(
				sample
			)}`
		);
	}
}

/**
 * Devuelve una lista reducida de estudiantes que tienen menos de 3 asignaciones
 * basándose en la estructura en memoria `studentAssignments` (Map studentId -> Set(parallels)).
 *
 * Resultado: array de { studentId, assignedCount, missingParallels }
 */
export function getStudentsWithLessThanThreeFromMap(
	studentAssignments: Map<string, Set<number>>
): Array<{
	studentId: string;
	assignedCount: number;
	missingParallels: number[];
}> {
	const out: Array<{
		studentId: string;
		assignedCount: number;
		missingParallels: number[];
	}> = [];
	for (const [studentId, parallelsSet] of studentAssignments.entries()) {
		const assignedCount = parallelsSet.size;
		const missing = [1, 2, 3].filter((p) => !parallelsSet.has(p));
		if (assignedCount < 3) {
			out.push({ studentId, assignedCount, missingParallels: missing });
		}
	}
	return out;
}

/**
 * Wrapper async que devuelve estudiantes con menos de 3 asignaciones desde la BD.
 * Resultado: array de { studentId, email?, assignedCount, missingParallels }
 */
export async function getStudentsWithLessThanThreeFromDB(): Promise<
	Array<{
		studentId: string;
		email?: string | null;
		assignedCount: number;
		missingParallels: number[];
	}>
> {
	const failures = await validateAssignmentsInDB();
	return failures.map((f) => ({
		studentId: f.studentId,
		email: f.email,
		assignedCount: f.assignedParallels.length,
		missingParallels: f.missingParallels,
	}));
}

/**
 * Valida la integridad de las asignaciones finales en la BD.
 * Comprueba por estudiante:
 *  - tiene exactamente 3 asignaciones
 *  - no hay duplicados del mismo curso
 *  - no hay más de una asignación en el mismo paralelo
 *
 * Devuelve un array de informes sólo para los estudiantes que presentan problemas.
 */
export async function validateFinalAssignmentsIntegrity(
	prismaClient?: PrismaClient | Prisma.TransactionClient
): Promise<
	Array<{
		studentId: string;
		email?: string | null;
		assignedCount: number;
		duplicates: Array<{ courseId: string; count: number }>;
		multipleInParallel: Array<{ parallel: number; courseIds: string[] }>;
		missingParallels: number[];
		ok: boolean;
	}>
> {
	const db: PrismaClient | Prisma.TransactionClient = prismaClient ?? prisma;

	// Trae todas las asignaciones con información de curso y estudiante
	const assignments: _AssignmentRow[] = await db.assignments.findMany({
		include: { courses: true, students: true },
	});

	// Map studentId -> array of { courseId, courseName, parallel }
	const map = new Map<
		string,
		Array<{ courseId: string; courseName?: string; parallel?: number }>
	>();
	const emailMap = new Map<string, string | null>();

	for (const a of assignments) {
		const sid = a.student_id;
		if (!map.has(sid)) map.set(sid, []);
		map.get(sid)!.push({
			courseId: a.course_id ?? String(a.courses?.id ?? ""),
			courseName: a.courses?.name ?? undefined,
			parallel: a.courses?.parallel ?? undefined,
		});
		if (!emailMap.has(sid)) emailMap.set(sid, a.students?.email ?? null);
	}

	// Ensure all students present (but only those with course selections)
	const students: _StudentRow[] = await db.students.findMany({
		select: { id: true, email: true },
		where: {
			selections: {
				some: {}, // Only include students who have at least one selection
			},
		},
	});
	for (const s of students) {
		if (!map.has(s.id)) map.set(s.id, []);
		if (!emailMap.has(s.id)) emailMap.set(s.id, s.email ?? null);
	}

	const problems: Array<{
		studentId: string;
		email?: string | null;
		assignedCount: number;
		duplicates: Array<{ courseId: string; count: number }>;
		multipleInParallel: Array<{ parallel: number; courseIds: string[] }>;
		missingParallels: number[];
		ok: boolean;
	}> = [];

	for (const [studentId, assigned] of map.entries()) {
		const assignedCount = assigned.length;

		// duplicates by courseId
		const courseCounts = new Map<string, number>();
		for (const a of assigned) {
			const cid = a.courseId ?? "";
			courseCounts.set(cid, (courseCounts.get(cid) ?? 0) + 1);
		}
		const duplicates = Array.from(courseCounts.entries())
			.filter(([, c]) => c > 1)
			.map(([courseId, count]) => ({ courseId, count }));

		// multiple in same parallel
		const parallelMap = new Map<number, string[]>();
		for (const a of assigned) {
			const p = a.parallel ?? -1;
			if (p === -1) continue;
			if (!parallelMap.has(p)) parallelMap.set(p, []);
			parallelMap.get(p)!.push(a.courseId);
		}
		const multipleInParallel = Array.from(parallelMap.entries())
			.filter(([, arr]) => arr.length > 1)
			.map(([parallel, arr]) => ({ parallel, courseIds: arr }));

		const presentParallels = new Set<number>();
		for (const a of assigned)
			if (typeof a.parallel === "number")
				presentParallels.add(a.parallel as number);
		const missingParallels = [1, 2, 3].filter((p) => !presentParallels.has(p));

		const ok =
			duplicates.length === 0 &&
			multipleInParallel.length === 0 &&
			missingParallels.length === 0 &&
			assignedCount === 3;

		if (!ok) {
			problems.push({
				studentId,
				email: emailMap.get(studentId) ?? null,
				assignedCount,
				duplicates,
				multipleInParallel,
				missingParallels,
				ok,
			});
		}
	}

	return problems;
}

/**
 * Arroja un error si existe algún problema de integridad en las asignaciones finales.
 */
export async function assertFinalAssignmentsIntegrity(
	prismaClient?: PrismaClient | Prisma.TransactionClient
): Promise<void> {
	const probs = await validateFinalAssignmentsIntegrity(prismaClient);
	if (probs.length > 0) {
		const sample = probs.slice(0, 10).map((p) => ({
			studentId: p.studentId,
			issues: {
				duplicates: p.duplicates,
				multipleInParallel: p.multipleInParallel,
				missing: p.missingParallels,
			},
		}));
		throw new Error(
			`Integrity check failed for ${
				probs.length
			} students. Examples: ${JSON.stringify(sample)}`
		);
	}
}

/**
 * Detecta conflictos de asignación y los persiste en `assignment_logs` mediante
 * `recordAssignmentConflicts`.
 * Retorna el array de problemas detectados.
 */
export async function detectAndRecordAssignmentConflicts(options?: {
	assignmentRunId?: string;
	requestIp?: string;
	userAgent?: string;
	details?: unknown;
	prismaClient?: PrismaClient | Prisma.TransactionClient;
}): Promise<ReturnType<typeof validateFinalAssignmentsIntegrity>> {
	const problems = await validateFinalAssignmentsIntegrity(
		options?.prismaClient
	);
	if (problems.length > 0) {
		// map problems to the expected shape (they already match)
		await recordAssignmentConflicts({
			assignmentRunId: options?.assignmentRunId ?? null,
			problems,
			requestIp: options?.requestIp,
			userAgent: options?.userAgent,
			details: options?.details,
			client: options?.prismaClient,
		});
	}
	return problems;
}

const _default = {
	validateStudentAssignmentsMap,
	validateAssignmentsInDB,
	assertAllStudentsFullyAssigned,
	getStudentsWithLessThanThreeFromMap,
	getStudentsWithLessThanThreeFromDB,
};

export default _default;
