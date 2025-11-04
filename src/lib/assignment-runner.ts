import priorityAssignments from "./priority-assignments";
import {
	detectAndRecordAssignmentConflicts,
	assertFinalAssignmentsIntegrity,
} from "./assignment-validators";
import { prisma } from "./prisma";
import { CourseCapacity } from "./course-capacity";
import debugLogger from "./debug-logger";
import {
	generateAssignmentReport,
	saveAssignmentReportToAudit,
} from "./assignment-report";

// Persist intermediate checkpoints into assignment_runs.metadata.checkpoints
async function persistCheckpoint(
	assignmentRunId: string | undefined,
	phase: string,
	payload: unknown
) {
	if (!assignmentRunId) return;
	try {
		const existing = await (prisma as any).assignment_runs.findUnique({
			where: { id: assignmentRunId },
		});
		const prevMeta = existing?.metadata ?? {};
		const checkpoints = Array.isArray(prevMeta.checkpoints)
			? prevMeta.checkpoints
			: [];
		checkpoints.push({ phase, timestamp: new Date().toISOString(), payload });
		await (prisma as any).assignment_runs.update({
			where: { id: assignmentRunId },
			data: { metadata: { ...prevMeta, checkpoints } },
		});
	} catch (cErr) {
		debugLogger.log("assignment_run_checkpoint_error", {
			assignmentRunId,
			phase,
			error: (cErr as Error)?.message ?? String(cErr),
		});
	}
}

type StudentInput = {
	id: string;
	email?: string;
	selections?: Array<{
		course_id: string;
		preference_order: number;
		courses: { id: string; name: string; parallel: number };
	}>;
	is_neurodivergent?: boolean;
	level?: number;
};

type Assignment = {
	student_id: string;
	course_id: string;
	preference_order: number;
	is_priority: boolean;
};

/**
 * Orquesta el algoritmo de asignación en orden:
 * 1) 1ª preferencia neurodivergentes
 * 2) 1ª preferencia 4º medio no neurodivergentes
 * 3) 1ª preferencia 3º medio no neurodivergentes
 * 4) fallbacks para neurodivergentes (2ª/3ª)
 * 5) fallbacks para 4º medio (2ª/3ª)
 * 6) fallbacks para 3º medio (2ª/3ª)
 * 7) asignación aleatoria de respaldo para completar 3 cursos
 * 8) detección y registro de conflictos y aserción de integridad
 *
 * inputs:
 * - students: array de estudiantes (con selections)
 * - courses: array de CourseCapacity (se convertirá a Map interna)
 * - assignmentRunId, requestIp, userAgent: metadata para auditoría
 */
export async function executeAssignmentAlgorithm(options: {
	students: StudentInput[];
	courses: CourseCapacity[];
	assignmentRunId?: string;
	requestIp?: string;
	userAgent?: string;
	dryRun?: boolean; // if true, do not persist side-effects beyond in-memory (note: audit logger may still attempt DB writes)
}): Promise<{
	summary: Record<string, unknown>;
	problems: Array<Record<string, unknown>>;
}> {
	const { students, courses, assignmentRunId, requestIp, userAgent } = options;

	// Performance metric: record start time and persist to assignment_runs.metadata
	const startMs = Date.now();
	debugLogger.log("assignment_run_start", {
		assignmentRunId,
		studentCount: students.length,
		courseCount: courses.length,
		requestIp,
		userAgent,
		started_at: new Date(startMs).toISOString(),
	});

	if (assignmentRunId) {
		try {
			// Read existing metadata then set started_at (merge) to avoid losing other metadata
			const existing = await (prisma as any).assignment_runs.findUnique({
				where: { id: assignmentRunId },
			});
			const prevMeta = existing?.metadata ?? {};
			await (prisma as any).assignment_runs.update({
				where: { id: assignmentRunId },
				data: {
					metadata: {
						...prevMeta,
						started_at: new Date(startMs).toISOString(),
					},
				},
			});
		} catch (metaErr) {
			// Non-fatal: log but continue execution.
			debugLogger.log("assignment_run_start_metadata_error", {
				assignmentRunId,
				error: (metaErr as Error)?.message ?? String(metaErr),
			});
		}
	}

	// We'll run the whole assignment as a single transaction so that all
	// audit log writes are atomic with respect to the assignment decisions.
	// Increase timeout to 60 seconds (default is 5 seconds)
	let result;
	try {
		result = await prisma.$transaction(
			async (tx) => {
				debugLogger.log("assignment_run_transaction_begin", {
					assignmentRunId,
				});
				// build course capacity map
				const courseCapMap = new Map<string, CourseCapacity>();
				for (const c of courses) courseCapMap.set(c.courseId, { ...c });

				const studentAssignments = new Map<string, Set<number>>();
				const allAssignments: Assignment[] = [];

				const summary: Record<string, unknown> = {};

				// 1) Neurodivergent first preferences
				const neuro = students.filter((s) => s.is_neurodivergent);
				const res1 =
					await priorityAssignments.assignFirstPreferencesForNeurodivergent(
						neuro,
						courseCapMap,
						studentAssignments,
						allAssignments,
						assignmentRunId,
						{ requestIp, userAgent, prismaClient: tx }
					);
				summary.neuro_first = res1;
				// persist checkpoint after neuro first phase
				await persistCheckpoint(assignmentRunId, "neuro_first", res1);

				// 2) 4th year non-neurodivergent first preferences
				const res2 =
					await priorityAssignments.assignFirstPreferencesForFourthYearNonNeurodivergent(
						students,
						courseCapMap,
						studentAssignments,
						allAssignments,
						assignmentRunId,
						{ requestIp, userAgent, prismaClient: tx }
					);
				summary.fourth_first = res2;
				await persistCheckpoint(assignmentRunId, "fourth_first", res2);

				// 3) 3rd year non-neurodivergent first preferences
				const res3 =
					await priorityAssignments.assignFirstPreferencesForThirdYearNonNeurodivergent(
						students,
						courseCapMap,
						studentAssignments,
						allAssignments,
						assignmentRunId,
						{ requestIp, userAgent, prismaClient: tx }
					);
				summary.third_first = res3;
				await persistCheckpoint(assignmentRunId, "third_first", res3);

				// Identify remaining students who still need assignments (less than 3)
				// This includes students not yet in the map (no selections) AND students with <3 assignments
				const needyStudents = students.filter((s) => {
					const assigned = studentAssignments.get(s.id);
					return !assigned || assigned.size < 3;
				}); // 4) fallback neurodivergent
				const needyNeuro = needyStudents.filter((s) => s.is_neurodivergent);
				const res4 =
					await priorityAssignments.assignFallbackPreferencesForNeurodivergent(
						needyNeuro,
						courseCapMap,
						studentAssignments,
						allAssignments,
						assignmentRunId,
						{ requestIp, userAgent, prismaClient: tx }
					);
				summary.neuro_fallback = res4;
				await persistCheckpoint(assignmentRunId, "neuro_fallback", res4);

				// 5) fallback 4th year
				const needyFourth = needyStudents.filter(
					(s) => s.level === 4 && !s.is_neurodivergent
				);
				const res5 =
					await priorityAssignments.assignFallbackPreferencesForFourthYear(
						needyFourth,
						courseCapMap,
						studentAssignments,
						allAssignments,
						assignmentRunId,
						{ requestIp, userAgent, prismaClient: tx }
					);
				summary.fourth_fallback = res5;
				await persistCheckpoint(assignmentRunId, "fourth_fallback", res5);

				// 6) fallback 3rd year
				const needyThird = needyStudents.filter(
					(s) => s.level === 3 && !s.is_neurodivergent
				);
				const res6 =
					await priorityAssignments.assignFallbackPreferencesForThirdYear(
						needyThird,
						courseCapMap,
						studentAssignments,
						allAssignments,
						assignmentRunId,
						{ requestIp, userAgent, prismaClient: tx }
					);
				summary.third_fallback = res6;
				await persistCheckpoint(assignmentRunId, "third_fallback", res6);

				// 7) backup fill remaining randomly
				const res7 = await priorityAssignments.assignRandomBackupFillRemaining(
					students,
					courseCapMap,
					studentAssignments,
					allAssignments,
					assignmentRunId,
					{ requestIp, userAgent, prismaClient: tx }
				);
				summary.backup_fill = res7;
				await persistCheckpoint(assignmentRunId, "backup_fill", res7);

				// CRITICAL: Persist all assignments to database
				debugLogger.log("persisting_assignments", {
					assignmentRunId,
					totalAssignments: allAssignments.length,
				});

				if (allAssignments.length > 0) {
					await (tx as any).assignments.createMany({
						data: allAssignments.map((a) => ({
							student_id: a.student_id,
							course_id: a.course_id,
							preference_order: a.preference_order,
							is_priority: a.is_priority,
							assignment_run_id: assignmentRunId ?? undefined,
						})),
					});
				}

				summary.totalAssignments = allAssignments.length;
				await persistCheckpoint(assignmentRunId, "assignments_persisted", {
					totalAssignments: allAssignments.length,
				});

				// 8) detect and record conflicts (will use tx for logging)
				const problems = (await detectAndRecordAssignmentConflicts({
					assignmentRunId,
					requestIp,
					userAgent,
					prismaClient: tx,
				})) as Array<Record<string, unknown>>;
				summary.problemsCount = problems.length;
				await persistCheckpoint(assignmentRunId, "conflicts_detected", {
					problemsCount: problems.length,
					problems,
				});

				// 9) final assert (throws if integrity invalid)
				try {
					await assertFinalAssignmentsIntegrity(tx);
					summary.integrity = "ok";
				} catch (err: unknown) {
					summary.integrity = "failed";
					summary.integrityError = (err as Error)?.message ?? String(err);
				}

				// 10) Calculate final statistics for frontend display
				const studentIds = new Set(allAssignments.map((a) => a.student_id));
				const neurodivergentCount = allAssignments.filter(
					(a) => a.is_priority
				).length;

				// Count students by level
				const studentLevels = new Map<string, number>();
				for (const student of students) {
					if (student.level !== undefined) {
						studentLevels.set(student.id, student.level);
					}
				}

				const fourthYearCount = allAssignments.filter(
					(a) => studentLevels.get(a.student_id) === 4
				).length;
				const thirdYearCount = allAssignments.filter(
					(a) => studentLevels.get(a.student_id) === 3
				).length;

				// Count assignment completeness per student
				const assignmentsPerStudent = new Map<string, number>();
				for (const assignment of allAssignments) {
					assignmentsPerStudent.set(
						assignment.student_id,
						(assignmentsPerStudent.get(assignment.student_id) || 0) + 1
					);
				}

				const studentsFullyAssigned = Array.from(
					assignmentsPerStudent.values()
				).filter((count) => count === 3).length;
				const studentsPartiallyAssigned = Array.from(
					assignmentsPerStudent.values()
				).filter((count) => count > 0 && count < 3).length;

				// Total lotteries executed across all phases
				const totalLotteries =
					(summary.neuro_first?.lotteriesExecuted || 0) +
					(summary.neuro_fallback?.lotteriesExecuted || 0) +
					(summary.third_first?.lotteriesExecuted || 0) +
					(summary.third_fallback?.lotteriesExecuted || 0) +
					(summary.fourth_first?.lotteriesExecuted || 0) +
					(summary.fourth_fallback?.lotteriesExecuted || 0) +
					(summary.backup_fill?.lotteriesExecuted || 0);

				// Add frontend-compatible statistics
				summary.totalStudents = studentIds.size;
				summary.neurodivergentAssignments = neurodivergentCount;
				summary.fourthYearAssignments = fourthYearCount;
				summary.thirdYearAssignments = thirdYearCount;
				summary.lotteriesExecuted = totalLotteries;
				summary.studentsFullyAssigned = studentsFullyAssigned;
				summary.studentsPartiallyAssigned = studentsPartiallyAssigned;

				return { summary, problems };
			},
			{
				timeout: 60000, // 60 seconds timeout (default is 5 seconds)
			}
		);
		debugLogger.log("assignment_run_completed", {
			assignmentRunId,
			summary: result?.summary ?? null,
			problemsCount: Array.isArray(result?.problems)
				? result.problems.length
				: 0,
		});

		// Performance metric: compute duration and persist completed_at/duration_seconds/status
		const endMs = Date.now();
		const durationSeconds = Math.round((endMs - startMs) / 1000);
		if (assignmentRunId) {
			try {
				const existing = await (prisma as any).assignment_runs.findUnique({
					where: { id: assignmentRunId },
				});
				const prevMeta = existing?.metadata ?? {};
				const status =
					Array.isArray(result?.problems) && result.problems.length > 0
						? "completed_with_issues"
						: "completed";
				await (prisma as any).assignment_runs.update({
					where: { id: assignmentRunId },
					data: {
						metadata: {
							...prevMeta,
							completed_at: new Date(endMs).toISOString(),
							duration_seconds: durationSeconds,
							status,
							problems_count: Array.isArray(result?.problems)
								? result.problems.length
								: 0,
						},
					},
				});
			} catch (metaErr) {
				debugLogger.log("assignment_run_complete_metadata_error", {
					assignmentRunId,
					error: (metaErr as Error)?.message ?? String(metaErr),
				});
			}
		}

		// Persist generated report to audit table (outside transaction)
		try {
			if (assignmentRunId) {
				const reportText = await generateAssignmentReport({ assignmentRunId });
				await saveAssignmentReportToAudit({
					assignmentRunId,
					reportText,
					prismaClient: prisma as any,
					requestIp,
					userAgent,
				});
				debugLogger.log("assignment_report_saved", { assignmentRunId });
			}
		} catch (reportErr) {
			// Log but don't fail the whole operation
			debugLogger.log("assignment_report_error", {
				assignmentRunId,
				error: (reportErr as Error)?.message ?? String(reportErr),
			});
		}

		return result;
	} catch (err: unknown) {
		// Prisma transactions automatically rollback if an error is thrown
		// inside the transaction callback. Here we capture the error, record
		// a failure entry to `assignment_logs` (outside the failed tx) so
		// there is an audit trail, and then rethrow the error.
		const errMsg = (err as Error)?.message ?? String(err);
		const errStack = (err as Error)?.stack ?? undefined;

		try {
			// write a failure summary log outside the transaction so it persists
			// even though the tx rolled back. Use any-cast because generated
			// client might be out-of-date until migrations are applied.
			await (prisma as any).assignment_logs.create({
				data: {
					assignment_run_id: assignmentRunId ?? undefined,
					event_type: "assignment_run_failed",
					event_subtype: null,
					student_id: null,
					student_email: null,
					course_id: null,
					course_name: null,
					parallel: null,
					preference: null,
					is_priority: null,
					details: { message: errMsg, stack: errStack },
					request_ip: requestIp ?? null,
					user_agent: userAgent ?? null,
				},
			});
			// Also attempt to mark the assignment_run as failed and record duration
			try {
				if (assignmentRunId) {
					const endMs = Date.now();
					const durationSeconds = Math.round((endMs - startMs) / 1000);
					const existing = await (prisma as any).assignment_runs.findUnique({
						where: { id: assignmentRunId },
					});
					const prevMeta = existing?.metadata ?? {};
					await (prisma as any).assignment_runs.update({
						where: { id: assignmentRunId },
						data: {
							metadata: {
								...prevMeta,
								completed_at: new Date(endMs).toISOString(),
								duration_seconds: durationSeconds,
								status: "failed",
								error_message: errMsg,
							},
						},
					});
				}
			} catch (metaErr) {
				debugLogger.log("assignment_run_failed_metadata_error", {
					assignmentRunId,
					error: (metaErr as Error)?.message ?? String(metaErr),
				});
			}
			// Emit debug log for failure
			debugLogger.log("assignment_run_failed", {
				assignmentRunId,
				error: errMsg,
			});
		} catch (logErr) {
			// If logging also fails, at least surface both errors in the thrown error
			const logMsg = (logErr as Error)?.message ?? String(logErr);
			throw new Error(
				`Assignment transaction failed: ${errMsg}; additionally failed to write failure log: ${logMsg}`
			);
		}

		throw err;
	}
}

const _default = { executeAssignmentAlgorithm };
export default _default;
