/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";
import type { PrismaClient, Prisma } from "@prisma/client";
import debugLogger from "./debug-logger";

type Candidate = { id: string; email?: string };

/**
 * Registra en la base de datos los resultados de un sorteo (decisión aleatoria).
 * - Crea un registro en `lotteries` con `lottery_results` anidados
 * - Crea entradas en `assignment_logs` por cada ganador/perdedor con el motivo
 * - Guarda metadatos (seed, swaps) en el campo `details` del log resumen
 */
export async function recordLotteryDecision(options: {
	assignmentRunId?: string | null;
	courseId: string;
	courseName: string;
	parallel: number;
	preference: number;
	candidates: Candidate[]; // todos los participantes
	winners: Candidate[]; // subset
	availableSpots: number;
	seedUsed?: string;
	swaps?: Array<{ i: number; j: number }>;
	reason?: string; // motivo textual del sorteo (ej: "sobrecupo en preferencia 1")
	requestIp?: string;
	userAgent?: string;
	executionContext?: unknown;
	client?: PrismaClient | Prisma.TransactionClient;
}): Promise<{
	lotteryId: string;
}> {
	const {
		assignmentRunId,
		courseId,
		courseName,
		parallel,
		preference,
		candidates,
		winners,
		availableSpots,
		seedUsed,
		swaps,
		reason,
		requestIp,
		userAgent,
		executionContext,
	} = options;

	// Prepare lottery_results payload
	const winnersMap = new Map(winners.map((w) => [w.id, w]));

	const lotteryResultsData = candidates.map((c) => ({
		student_id: c.id,
		student_email: c.email ?? "",
		won: winnersMap.has(c.id),
		request_ip: requestIp ?? null,
		user_agent: userAgent ?? null,
		execution_context: executionContext ?? null,
	}));

	const db = options.client ?? prisma;

	// Structured debug log for reproducibility (includes seed and swaps)
	debugLogger.log("lottery_executing", {
		assignmentRunId,
		courseId,
		courseName,
		parallel,
		preference,
		candidates: candidates.map((c) => ({ id: c.id, email: c.email ?? null })),
		availableSpots,
		seedUsed: seedUsed ?? null,
		swaps: swaps ?? null,
		reason: reason ?? null,
		executionContext: executionContext ?? null,
	});

	// Create lottery record with nested results
	const lottery = await (db as any).lotteries.create({
		data: {
			course_id: courseId,
			course_name: courseName,
			parallel,
			preference,
			candidates: candidates.length,
			available_spots: availableSpots,
			assignment_run_id: assignmentRunId ?? undefined,
			lottery_results: {
				create: lotteryResultsData,
			},
		},
	});

	// Create a summary log in assignment_logs
	await (db as any).assignment_logs.create({
		data: {
			assignment_run_id: assignmentRunId ?? undefined,
			event_type: "lottery_executed",
			event_subtype: null,
			student_id: null,
			student_email: null,
			course_id: courseId,
			course_name: courseName,
			parallel,
			preference,
			is_priority: null,
			details: {
				reason: reason ?? null,
				seedUsed: seedUsed ?? null,
				swaps: swaps ?? null,
				candidatesCount: candidates.length,
				winners: winners.map((w) => ({ id: w.id, email: w.email ?? "" })),
				losers: candidates
					.filter((c) => !winnersMap.has(c.id))
					.map((c) => ({ id: c.id, email: c.email ?? "" })),
			},
			request_ip: requestIp ?? null,
			user_agent: userAgent ?? null,
		},
	});

	// Emit detailed debug log after DB writes
	debugLogger.log("lottery_executed", {
		assignmentRunId,
		lotteryId: (lottery as any).id,
		courseId,
		courseName,
		parallel,
		preference,
		candidatesCount: candidates.length,
		winners: winners.map((w) => ({ id: w.id, email: w.email ?? null })),
		losers: candidates
			.filter((c) => !winnersMap.has(c.id))
			.map((c) => ({ id: c.id, email: c.email ?? null })),
		seedUsed: seedUsed ?? null,
		swaps: swaps ?? null,
		requestIp: requestIp ?? null,
	});

	// Create detailed per-student logs (winner/loser)
	const perStudentLogs = candidates.map((c) => ({
		assignment_run_id: assignmentRunId ?? undefined,
		event_type: "lottery_result",
		event_subtype: winnersMap.has(c.id) ? "winner" : "loser",
		student_id: c.id,
		student_email: c.email ?? "",
		course_id: courseId,
		course_name: courseName,
		parallel,
		preference,
		is_priority: null,
		details: {
			won: winnersMap.has(c.id),
			reason: winnersMap.has(c.id) ? "won_lottery" : "lost_lottery",
			seedUsed: seedUsed ?? null,
			swaps: swaps ?? null,
		},
		request_ip: requestIp ?? null,
		user_agent: userAgent ?? null,
	}));

	// Bulk insert per-student logs
	// Prisma createMany ignores nested relations; we insert directly to assignment_logs
	await (db as any).assignment_logs.createMany({ data: perStudentLogs });

	return { lotteryId: lottery.id };
}

const _default = { recordLotteryDecision };
export default _default;

/**
 * Registra conflictos de asignación detectados (por ejemplo duplicados, falta de paralelos,
 * múltiples asignaciones en un mismo paralelo) en `assignment_logs`.
 *
 * options.problems: array de objetos con la forma producida por
 * `validateFinalAssignmentsIntegrity()` en `assignment-validators.ts`.
 */
export async function recordAssignmentConflicts(options: {
	assignmentRunId?: string | null;
	problems: Array<{
		studentId: string;
		email?: string | null;
		assignedCount: number;
		duplicates: Array<{ courseId: string; count: number }>;
		multipleInParallel: Array<{ parallel: number; courseIds: string[] }>;
		missingParallels: number[];
		ok: boolean;
	}>;
	requestIp?: string;
	userAgent?: string;
	details?: unknown;
	client?: PrismaClient | Prisma.TransactionClient;
}): Promise<void> {
	const { assignmentRunId, problems, requestIp, userAgent, details } = options;

	// Summary log
	const db = options.client ?? prisma;

	// Debug-level summary
	debugLogger.log("assignment_conflicts_summary_executing", {
		assignmentRunId,
		problemsCount: problems.length,
		details: details ?? null,
	});

	await (db as any).assignment_logs.create({
		data: {
			assignment_run_id: assignmentRunId ?? undefined,
			event_type: "assignment_conflicts_summary",
			event_subtype: null,
			student_id: null,
			student_email: null,
			course_id: null,
			course_name: null,
			parallel: null,
			preference: null,
			is_priority: null,
			details: { problemsCount: problems.length, details: details ?? null },
			request_ip: requestIp ?? null,
			user_agent: userAgent ?? null,
		},
	});

	if (problems.length === 0) return;

	// Per-student conflict logs
	const perStudentLogs = problems.map((p) => ({
		assignment_run_id: assignmentRunId ?? undefined,
		event_type: "assignment_conflict",
		event_subtype: null,
		student_id: p.studentId,
		student_email: p.email ?? "",
		course_id: null,
		course_name: null,
		parallel: null,
		preference: null,
		is_priority: null,
		details: {
			assignedCount: p.assignedCount,
			duplicates: p.duplicates,
			multipleInParallel: p.multipleInParallel,
			missingParallels: p.missingParallels,
		},
		request_ip: requestIp ?? null,
		user_agent: userAgent ?? null,
	}));

	// Bulk insert logs
	await (db as any).assignment_logs.createMany({ data: perStudentLogs });

	// Emit per-student debug logs
	debugLogger.log("assignment_conflicts_recorded", {
		assignmentRunId,
		problemsCount: problems.length,
	});
}

// named exports are already available via the function declarations above
