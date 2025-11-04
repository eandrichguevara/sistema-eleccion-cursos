import { pickWinners, shuffleWithSeed } from "./shuffle";
import defaultAuditClient, { AuditClient } from "./ports";
import type { PrismaClient, Prisma } from "@prisma/client";

type StudentMinimal = {
	id: string;
	email?: string;
	selections?: Array<{
		course_id: string;
		preference_order: number;
		courses: { id: string; name: string; parallel: number };
	}>;
	// optional metadata used by priority grouping
	is_neurodivergent?: boolean;
	level?: number; // e.g., 4 means 4to medio
};

type CourseCapacity = {
	courseId: string;
	courseName: string;
	parallel: number;
	capacity: number;
	assignedCount: number;
};

type Assignment = {
	student_id: string;
	course_id: string;
	preference_order: number;
	is_priority: boolean;
};

/**
 * Asigna las 1ª preferencias de un grupo de estudiantes neurodivergentes.
 * Maneja sobrecupo mediante sorteo reproducible y registra decisiones en BD.
 *
 * @param students Array de estudiantes (con selections)
 * @param courseCapacities Mapa courseId -> CourseCapacity (se actualizará assignedCount)
 * @param studentAssignments Map studentId -> Set(parallels) (se actualizará)
 * @param allAssignments Array donde se acumulan las asignaciones (se muta)
 * @param assignmentRunId id opcional del run (para auditoría)
 * @param context opcional { requestIp, userAgent }
 */
export async function assignFirstPreferencesForNeurodivergent(
	students: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{
	totalAssigned: number;
	lotteriesExecuted: number;
}> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	// Procesar por paralelo 1..3
	for (const parallel of [1, 2, 3]) {
		// Agrupa candidatos por curso (solo preferencia 1)
		const groups = new Map<string, StudentMinimal[]>();

		for (const s of students) {
			// saltar si ya tiene asignación en este paralelo
			const assigned = studentAssignments.get(s.id);
			if (assigned && assigned.has(parallel)) continue;

			const sel = s.selections?.find(
				(x) => x.courses.parallel === parallel && x.preference_order === 1
			);
			if (!sel) continue;

			if (!groups.has(sel.course_id)) groups.set(sel.course_id, []);
			groups.get(sel.course_id)!.push(s);
		}

		// Procesar cada curso
		for (const [courseId, candidates] of groups.entries()) {
			const capacity = courseCapacities.get(courseId);
			if (!capacity) continue;
			const available = capacity.capacity - capacity.assignedCount;
			if (available <= 0) continue;

			// Eligible candidates who still don't have the parallel
			const eligible = candidates.filter((s) => {
				const a = studentAssignments.get(s.id);
				return !a || !a.has(parallel);
			});
			if (eligible.length === 0) continue;

			if (eligible.length > available) {
				// Sorteo reproducible
				const seed = `${assignmentRunId ?? "run"}-${courseId}-${Date.now()}`;
				const { winners, seedUsed, swaps } = pickWinners(
					eligible,
					available,
					seed
				);
				// Registrar en BD el sorteo y logs via injected audit client
				const audit = context?.auditClient ?? defaultAuditClient;
				await audit.recordLotteryDecision({
					assignmentRunId,
					courseId,
					courseName: capacity.courseName,
					parallel,
					preference: 1,
					candidates: eligible.map((s) => ({ id: s.id, email: s.email })),
					winners: winners.map((w) => ({ id: w.id, email: w.email })),
					availableSpots: available,
					seedUsed,
					swaps,
					reason: "sobrecupo primera preferencia - neurodivergentes",
					requestIp: context?.requestIp,
					userAgent: context?.userAgent,
					executionContext: {
						triggeredBy: "assignFirstPreferencesForNeurodivergent",
					},
					client: context?.prismaClient,
				});

				// Asignar ganadores
				for (const winner of winners) {
					allAssignments.push({
						student_id: winner.id,
						course_id: courseId,
						preference_order: 1,
						is_priority: true,
					});
					if (!studentAssignments.has(winner.id))
						studentAssignments.set(winner.id, new Set());
					studentAssignments.get(winner.id)!.add(parallel);
					capacity.assignedCount++;
					totalAssigned++;
				}

				// Los perdedores quedan sin asignación en este paralelo y seguirán su flujo
				lotteriesExecuted++;
			} else {
				// Asignación directa a todos los elegibles
				for (const s of eligible) {
					allAssignments.push({
						student_id: s.id,
						course_id: courseId,
						preference_order: 1,
						is_priority: true,
					});
					if (!studentAssignments.has(s.id))
						studentAssignments.set(s.id, new Set());
					studentAssignments.get(s.id)!.add(parallel);
					capacity.assignedCount++;
					totalAssigned++;
				}
			}
		}
	}

	return { totalAssigned, lotteriesExecuted };
}

/**
 * Asigna automáticamente la 2ª y 3ª preferencia para estudiantes que perdieron
 * un sorteo en la 1ª preferencia.
 *
 * Comportamiento:
 * - Recibe una lista de `losers` (estudiantes que perdieron la 1ª preferencia)
 * - Intenta asignar la preferencia 2; si hay sobrecupo en algún curso, ejecuta
 *   un sorteo reproducible entre los candidatos elegibles y registra la decisión.
 * - Los perdedores del sorteo de preferencia 2 se procesan luego para la
 *   preferencia 3 con la misma lógica.
 * - Actualiza `courseCapacities`, `studentAssignments` y `allAssignments`.
 *
 */
export async function assignFallbackPreferencesForNeurodivergent(
	losers: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{ totalAssigned: number; lotteriesExecuted: number }> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	// intentamos preferencia 2 y luego 3
	let candidatesForNextRound = losers.slice();

	for (const pref of [2, 3]) {
		if (candidatesForNextRound.length === 0) break;

		// procesar por paralelo 1..3
		for (const parallel of [1, 2, 3]) {
			// agrupa por curso la preferencia actual
			const groups = new Map<string, StudentMinimal[]>();

			for (const s of candidatesForNextRound) {
				// si ya tiene asignación en este paralelo, skip
				const assigned = studentAssignments.get(s.id);
				if (assigned && assigned.has(parallel)) continue;

				const sel = s.selections?.find(
					(x) => x.courses.parallel === parallel && x.preference_order === pref
				);
				if (!sel) continue;

				if (!groups.has(sel.course_id)) groups.set(sel.course_id, []);
				groups.get(sel.course_id)!.push(s);
			}

			// construir la nueva lista de perdedores que seguirán al siguiente pref
			const remainingLosers: StudentMinimal[] = [];

			for (const [courseId, candidates] of groups.entries()) {
				const capacity = courseCapacities.get(courseId);
				if (!capacity) continue;
				const available = capacity.capacity - capacity.assignedCount;
				if (available <= 0) {
					// ningún cupo, todos siguen como perdedores
					remainingLosers.push(...candidates);
					continue;
				}

				const eligible = candidates.filter((s) => {
					const a = studentAssignments.get(s.id);
					return !a || !a.has(parallel);
				});

				if (eligible.length === 0) continue;

				if (eligible.length > available) {
					const seed = `${
						assignmentRunId ?? "run"
					}-${courseId}-fallback-${pref}-${Date.now()}`;
					const {
						winners,
						losers: roundLosers,
						seedUsed,
						swaps,
					} = pickWinners(eligible, available, seed);

					// registrar sorteo via injected audit client
					const audit = context?.auditClient ?? defaultAuditClient;
					await audit.recordLotteryDecision({
						assignmentRunId,
						courseId,
						courseName: capacity.courseName,
						parallel,
						preference: pref,
						candidates: eligible.map((s) => ({ id: s.id, email: s.email })),
						winners: winners.map((w) => ({ id: w.id, email: w.email })),
						availableSpots: available,
						seedUsed,
						swaps,
						reason: `sobrecupo preferencia ${pref} - fallback neurodivergentes`,
						requestIp: context?.requestIp,
						userAgent: context?.userAgent,
						executionContext: {
							triggeredBy: "assignFallbackPreferencesForNeurodivergent",
						},
						client: context?.prismaClient,
					});

					// asignar ganadores
					for (const winner of winners) {
						allAssignments.push({
							student_id: winner.id,
							course_id: courseId,
							preference_order: pref,
							is_priority: true,
						});
						if (!studentAssignments.has(winner.id))
							studentAssignments.set(winner.id, new Set());
						studentAssignments.get(winner.id)!.add(parallel);
						capacity.assignedCount++;
						totalAssigned++;
					}

					// los perdedores pasan a siguiente pref
					remainingLosers.push(...roundLosers);
					lotteriesExecuted++;
				} else {
					// asignar a todos los elegibles
					for (const s of eligible) {
						allAssignments.push({
							student_id: s.id,
							course_id: courseId,
							preference_order: pref,
							is_priority: true,
						});
						if (!studentAssignments.has(s.id))
							studentAssignments.set(s.id, new Set());
						studentAssignments.get(s.id)!.add(parallel);
						capacity.assignedCount++;
						totalAssigned++;
					}
					// los que no aplicaron a este curso (o no eran elegibles) seguirán en candidatosForNextRound
					const assignedIds = new Set(eligible.map((x) => x.id));
					for (const c of candidates) {
						if (!assignedIds.has(c.id)) remainingLosers.push(c);
					}
				}
			}

			// actualizar la lista de candidatos para el siguiente paralelo dentro de la misma preferencia
			candidatesForNextRound = candidatesForNextRound.filter((s) => {
				// sigue en la cola si apareció en remainingLosers (es decir, no fue asignado en este paralelo)
				return remainingLosers.findIndex((r) => r.id === s.id) !== -1;
			});
		}
		// al final de la preferencia, candidatesForNextRound ya contiene sólo quienes perdieron esta preferencia
	}

	return { totalAssigned, lotteriesExecuted };
}

// default export will be declared at the end after all functions are defined

/**
 * Asigna 1ª preferencia a estudiantes de 4to medio NO neurodivergentes.
 * Comportamiento similar a assignFirstPreferencesForNeurodivergent pero
 * filtra por nivel===4 y is_neurodivergent===false.
 */
export async function assignFirstPreferencesForFourthYearNonNeurodivergent(
	students: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{ totalAssigned: number; lotteriesExecuted: number }> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	// filter to 4th year non-neurodivergent
	const targets = students.filter((s) => s.level === 4 && !s.is_neurodivergent);

	for (const parallel of [1, 2, 3]) {
		const groups = new Map<string, StudentMinimal[]>();

		for (const s of targets) {
			const assigned = studentAssignments.get(s.id);
			if (assigned && assigned.has(parallel)) continue;

			const sel = s.selections?.find(
				(x) => x.courses.parallel === parallel && x.preference_order === 1
			);
			if (!sel) continue;

			if (!groups.has(sel.course_id)) groups.set(sel.course_id, []);
			groups.get(sel.course_id)!.push(s);
		}

		for (const [courseId, candidates] of groups.entries()) {
			const capacity = courseCapacities.get(courseId);
			if (!capacity) continue;
			const available = capacity.capacity - capacity.assignedCount;
			if (available <= 0) continue;

			const eligible = candidates.filter((s) => {
				const a = studentAssignments.get(s.id);
				return !a || !a.has(parallel);
			});
			if (eligible.length === 0) continue;

			if (eligible.length > available) {
				const seed = `${assignmentRunId ?? "run"}-${courseId}-${Date.now()}`;
				const { winners, seedUsed, swaps } = pickWinners(
					eligible,
					available,
					seed
				);

				const audit = context?.auditClient ?? defaultAuditClient;
				await audit.recordLotteryDecision({
					assignmentRunId,
					courseId,
					courseName: capacity.courseName,
					parallel,
					preference: 1,
					candidates: eligible.map((s) => ({ id: s.id, email: s.email })),
					winners: winners.map((w) => ({ id: w.id, email: w.email })),
					availableSpots: available,
					seedUsed,
					swaps,
					reason:
						"sobrecupo primera preferencia - 4to medio no neurodivergentes",
					requestIp: context?.requestIp,
					userAgent: context?.userAgent,
					executionContext: {
						triggeredBy: "assignFirstPreferencesForFourthYearNonNeurodivergent",
					},
					client: context?.prismaClient,
				});

				for (const winner of winners) {
					allAssignments.push({
						student_id: winner.id,
						course_id: courseId,
						preference_order: 1,
						is_priority: false,
					});
					if (!studentAssignments.has(winner.id))
						studentAssignments.set(winner.id, new Set());
					studentAssignments.get(winner.id)!.add(parallel);
					capacity.assignedCount++;
					totalAssigned++;
				}

				lotteriesExecuted++;
			} else {
				for (const s of eligible) {
					allAssignments.push({
						student_id: s.id,
						course_id: courseId,
						preference_order: 1,
						is_priority: false,
					});
					if (!studentAssignments.has(s.id))
						studentAssignments.set(s.id, new Set());
					studentAssignments.get(s.id)!.add(parallel);
					capacity.assignedCount++;
					totalAssigned++;
				}
			}
		}
	}

	return { totalAssigned, lotteriesExecuted };
}

/**
 * Asigna automáticamente la 2ª y 3ª preferencia para estudiantes de 4to medio
 * que necesiten cubrir vacantes (por ejemplo, perdieron la 1ª preferencia).
 *
 * Lógica:
 * - Recibe `losers` (estudiantes de 4to medio pendientes)
 * - Procesa preferencia 2 y 3 por paralelo (1..3)
 * - En caso de sobrecupo ejecuta sorteo reproducible y registra la decisión
 *   con `recordLotteryDecision`.
 * - Actualiza `courseCapacities`, `studentAssignments` y `allAssignments`.
 */
export async function assignFallbackPreferencesForFourthYear(
	losers: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{ totalAssigned: number; lotteriesExecuted: number }> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	let candidatesForNextRound = losers.slice();

	for (const pref of [2, 3]) {
		if (candidatesForNextRound.length === 0) break;

		for (const parallel of [1, 2, 3]) {
			const groups = new Map<string, StudentMinimal[]>();

			for (const s of candidatesForNextRound) {
				// aseguramos que el estudiante sea 4to medio
				if (s.level !== 4) continue;
				const assigned = studentAssignments.get(s.id);
				if (assigned && assigned.has(parallel)) continue;

				const sel = s.selections?.find(
					(x) => x.courses.parallel === parallel && x.preference_order === pref
				);
				if (!sel) continue;

				if (!groups.has(sel.course_id)) groups.set(sel.course_id, []);
				groups.get(sel.course_id)!.push(s);
			}

			const remainingLosers: StudentMinimal[] = [];

			for (const [courseId, candidates] of groups.entries()) {
				const capacity = courseCapacities.get(courseId);
				if (!capacity) continue;
				const available = capacity.capacity - capacity.assignedCount;
				if (available <= 0) {
					remainingLosers.push(...candidates);
					continue;
				}

				const eligible = candidates.filter((s) => {
					const a = studentAssignments.get(s.id);
					return !a || !a.has(parallel);
				});

				if (eligible.length === 0) continue;

				if (eligible.length > available) {
					const seed = `${
						assignmentRunId ?? "run"
					}-${courseId}-4to-fallback-${pref}-${Date.now()}`;
					const {
						winners,
						losers: roundLosers,
						seedUsed,
						swaps,
					} = pickWinners(eligible, available, seed);

					const audit = context?.auditClient ?? defaultAuditClient;
					await audit.recordLotteryDecision({
						assignmentRunId,
						courseId,
						courseName: capacity.courseName,
						parallel,
						preference: pref,
						candidates: eligible.map((s) => ({ id: s.id, email: s.email })),
						winners: winners.map((w) => ({ id: w.id, email: w.email })),
						availableSpots: available,
						seedUsed,
						swaps,
						reason: `sobrecupo preferencia ${pref} - fallback 4to medio`,
						requestIp: context?.requestIp,
						userAgent: context?.userAgent,
						executionContext: {
							triggeredBy: "assignFallbackPreferencesForFourthYear",
						},
						client: context?.prismaClient,
					});

					for (const winner of winners) {
						allAssignments.push({
							student_id: winner.id,
							course_id: courseId,
							preference_order: pref,
							is_priority: false,
						});
						if (!studentAssignments.has(winner.id))
							studentAssignments.set(winner.id, new Set());
						studentAssignments.get(winner.id)!.add(parallel);
						capacity.assignedCount++;
						totalAssigned++;
					}

					remainingLosers.push(...roundLosers);
					lotteriesExecuted++;
				} else {
					for (const s of eligible) {
						allAssignments.push({
							student_id: s.id,
							course_id: courseId,
							preference_order: pref,
							is_priority: false,
						});
						if (!studentAssignments.has(s.id))
							studentAssignments.set(s.id, new Set());
						studentAssignments.get(s.id)!.add(parallel);
						capacity.assignedCount++;
						totalAssigned++;
					}

					const assignedIds = new Set(eligible.map((x) => x.id));
					for (const c of candidates) {
						if (!assignedIds.has(c.id)) remainingLosers.push(c);
					}
				}
			}

			candidatesForNextRound = candidatesForNextRound.filter((s) => {
				return remainingLosers.findIndex((r) => r.id === s.id) !== -1;
			});
		}
	}

	return { totalAssigned, lotteriesExecuted };
}

const _default = {
	assignFirstPreferencesForNeurodivergent,
	assignFallbackPreferencesForNeurodivergent,
	assignFirstPreferencesForFourthYearNonNeurodivergent,
	assignFallbackPreferencesForFourthYear,
	assignFirstPreferencesForThirdYearNonNeurodivergent,
	assignFallbackPreferencesForThirdYear,
	// backup filler
	assignRandomBackupFillRemaining,
};
export default _default;

/**
 * Asigna 1ª preferencia a estudiantes de 3ro medio NO neurodivergentes.
 * Comportamiento idéntico a la versión para 4to medio, pero filtrando level===3.
 */
export async function assignFirstPreferencesForThirdYearNonNeurodivergent(
	students: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{ totalAssigned: number; lotteriesExecuted: number }> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	const targets = students.filter((s) => s.level === 3 && !s.is_neurodivergent);

	for (const parallel of [1, 2, 3]) {
		const groups = new Map<string, StudentMinimal[]>();

		for (const s of targets) {
			const assigned = studentAssignments.get(s.id);
			if (assigned && assigned.has(parallel)) continue;

			const sel = s.selections?.find(
				(x) => x.courses.parallel === parallel && x.preference_order === 1
			);
			if (!sel) continue;

			if (!groups.has(sel.course_id)) groups.set(sel.course_id, []);
			groups.get(sel.course_id)!.push(s);
		}

		for (const [courseId, candidates] of groups.entries()) {
			const capacity = courseCapacities.get(courseId);
			if (!capacity) continue;
			const available = capacity.capacity - capacity.assignedCount;
			if (available <= 0) continue;

			const eligible = candidates.filter((s) => {
				const a = studentAssignments.get(s.id);
				return !a || !a.has(parallel);
			});
			if (eligible.length === 0) continue;

			if (eligible.length > available) {
				const seed = `${assignmentRunId ?? "run"}-${courseId}-${Date.now()}`;
				const { winners, seedUsed, swaps } = pickWinners(
					eligible,
					available,
					seed
				);

				const audit = context?.auditClient ?? defaultAuditClient;
				await audit.recordLotteryDecision({
					assignmentRunId,
					courseId,
					courseName: capacity.courseName,
					parallel,
					preference: 1,
					candidates: eligible.map((s) => ({ id: s.id, email: s.email })),
					winners: winners.map((w) => ({ id: w.id, email: w.email })),
					availableSpots: available,
					seedUsed,
					swaps,
					reason:
						"sobrecupo primera preferencia - 3ro medio no neurodivergentes",
					requestIp: context?.requestIp,
					userAgent: context?.userAgent,
					executionContext: {
						triggeredBy: "assignFirstPreferencesForThirdYearNonNeurodivergent",
					},
					client: context?.prismaClient,
				});

				for (const winner of winners) {
					allAssignments.push({
						student_id: winner.id,
						course_id: courseId,
						preference_order: 1,
						is_priority: false,
					});
					if (!studentAssignments.has(winner.id))
						studentAssignments.set(winner.id, new Set());
					studentAssignments.get(winner.id)!.add(parallel);
					capacity.assignedCount++;
					totalAssigned++;
				}

				lotteriesExecuted++;
			} else {
				for (const s of eligible) {
					allAssignments.push({
						student_id: s.id,
						course_id: courseId,
						preference_order: 1,
						is_priority: false,
					});
					if (!studentAssignments.has(s.id))
						studentAssignments.set(s.id, new Set());
					studentAssignments.get(s.id)!.add(parallel);
					capacity.assignedCount++;
					totalAssigned++;
				}
			}
		}
	}

	return { totalAssigned, lotteriesExecuted };
}

/**
 * Asigna 2ª y 3ª preferencia para 3ro medio no neurodivergentes que necesiten cubrir vacantes.
 * Misma lógica que assignFallbackPreferencesForFourthYear, pero filtrando level===3.
 */
export async function assignFallbackPreferencesForThirdYear(
	losers: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{ totalAssigned: number; lotteriesExecuted: number }> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	let candidatesForNextRound = losers.slice();

	for (const pref of [2, 3]) {
		if (candidatesForNextRound.length === 0) break;

		for (const parallel of [1, 2, 3]) {
			const groups = new Map<string, StudentMinimal[]>();

			for (const s of candidatesForNextRound) {
				if (s.level !== 3) continue;
				const assigned = studentAssignments.get(s.id);
				if (assigned && assigned.has(parallel)) continue;

				const sel = s.selections?.find(
					(x) => x.courses.parallel === parallel && x.preference_order === pref
				);
				if (!sel) continue;

				if (!groups.has(sel.course_id)) groups.set(sel.course_id, []);
				groups.get(sel.course_id)!.push(s);
			}

			const remainingLosers: StudentMinimal[] = [];

			for (const [courseId, candidates] of groups.entries()) {
				const capacity = courseCapacities.get(courseId);
				if (!capacity) continue;
				const available = capacity.capacity - capacity.assignedCount;
				if (available <= 0) {
					remainingLosers.push(...candidates);
					continue;
				}

				const eligible = candidates.filter((s) => {
					const a = studentAssignments.get(s.id);
					return !a || !a.has(parallel);
				});

				if (eligible.length === 0) continue;

				if (eligible.length > available) {
					const seed = `${
						assignmentRunId ?? "run"
					}-${courseId}-3ro-fallback-${pref}-${Date.now()}`;
					const {
						winners,
						losers: roundLosers,
						seedUsed,
						swaps,
					} = pickWinners(eligible, available, seed);

					const audit = context?.auditClient ?? defaultAuditClient;
					await audit.recordLotteryDecision({
						assignmentRunId,
						courseId,
						courseName: capacity.courseName,
						parallel,
						preference: pref,
						candidates: eligible.map((s) => ({ id: s.id, email: s.email })),
						winners: winners.map((w) => ({ id: w.id, email: w.email })),
						availableSpots: available,
						seedUsed,
						swaps,
						reason: `sobrecupo preferencia ${pref} - fallback 3ro medio`,
						requestIp: context?.requestIp,
						userAgent: context?.userAgent,
						executionContext: {
							triggeredBy: "assignFallbackPreferencesForThirdYear",
						},
						client: context?.prismaClient,
					});

					for (const winner of winners) {
						allAssignments.push({
							student_id: winner.id,
							course_id: courseId,
							preference_order: pref,
							is_priority: false,
						});
						if (!studentAssignments.has(winner.id))
							studentAssignments.set(winner.id, new Set());
						studentAssignments.get(winner.id)!.add(parallel);
						capacity.assignedCount++;
						totalAssigned++;
					}

					remainingLosers.push(...roundLosers);
					lotteriesExecuted++;
				} else {
					for (const s of eligible) {
						allAssignments.push({
							student_id: s.id,
							course_id: courseId,
							preference_order: pref,
							is_priority: false,
						});
						if (!studentAssignments.has(s.id))
							studentAssignments.set(s.id, new Set());
						studentAssignments.get(s.id)!.add(parallel);
						capacity.assignedCount++;
						totalAssigned++;
					}

					const assignedIds = new Set(eligible.map((x) => x.id));
					for (const c of candidates) {
						if (!assignedIds.has(c.id)) remainingLosers.push(c);
					}
				}
			}

			candidatesForNextRound = candidatesForNextRound.filter((s) => {
				return remainingLosers.findIndex((r) => r.id === s.id) !== -1;
			});
		}
	}

	return { totalAssigned, lotteriesExecuted };
}

// (export object already includes third-year handlers)

/**
 * Asigna aleatoriamente en los cupos restantes para intentar completar 3 cursos
 * por estudiante. Se usa para llenar vacantes con una asignación de respaldo.
 *
 * Estrategia:
 * - Por paralelo (1..3) obtiene los estudiantes que aún necesitan asignación.
 * - Obtiene la lista de cursos con cupos disponibles en ese paralelo.
 * - Se hace un shuffle reproducible de estudiantes y cursos (semilla derivada
 *   de `assignmentRunId` y el paralelo).
 * - Reparte estudiantes en el orden aleatorio entre los cursos (uno a uno)
 *   hasta agotar cupos o estudiantes.
 * - Para cada curso al que se asignan estudiantes se registra un `recordLotteryDecision`
 *   que documenta la operación (candidatos, ganadores, seed, swaps).
 */
export async function assignRandomBackupFillRemaining(
	students: StudentMinimal[],
	courseCapacities: Map<string, CourseCapacity>,
	studentAssignments: Map<string, Set<number>>,
	allAssignments: Assignment[],
	assignmentRunId?: string,
	context?: {
		requestIp?: string;
		userAgent?: string;
		seed?: string;
		prismaClient?: PrismaClient | Prisma.TransactionClient;
		auditClient?: AuditClient;
	}
): Promise<{ totalAssigned: number; lotteriesExecuted: number }> {
	let totalAssigned = 0;
	let lotteriesExecuted = 0;

	for (const parallel of [1, 2, 3]) {
		// estudiantes que aún necesitan este paralelo
		const needy = students.filter((s) => {
			const a = studentAssignments.get(s.id);
			return !a || !a.has(parallel);
		});
		if (needy.length === 0) continue;

		// cursos con cupos en este paralelo
		const courses = Array.from(courseCapacities.values()).filter(
			(c) => c.parallel === parallel && c.assignedCount < c.capacity
		);
		if (courses.length === 0) continue;

		const seedBase =
			context?.seed ??
			`${assignmentRunId ?? "run"}-backup-parallel-${parallel}-${Date.now()}`;

		// shuffle reproducible de estudiantes y cursos
		const {
			shuffled: shuffledStudents,
			swaps: studentSwaps,
			seedUsed: seedStudents,
		} = shuffleWithSeed(needy, `${seedBase}-students`);
		const { shuffled: shuffledCourses } = shuffleWithSeed(
			courses,
			`${seedBase}-courses`
		);

		// pool mutable de estudiantes aún por asignar en este paralelo
		const studentPool = [...shuffledStudents];

		for (const course of shuffledCourses) {
			const available = course.capacity - course.assignedCount;
			if (available <= 0) continue;
			if (studentPool.length === 0) break;

			const assignCount = Math.min(available, studentPool.length);
			const winners = studentPool.splice(0, assignCount);

			// aplicar asignaciones
			for (const w of winners) {
				allAssignments.push({
					student_id: w.id,
					course_id: course.courseId,
					preference_order: 0,
					is_priority: false,
				});
				if (!studentAssignments.has(w.id))
					studentAssignments.set(w.id, new Set());
				studentAssignments.get(w.id)!.add(parallel);
				course.assignedCount++;
				totalAssigned++;
			}

			// registrar la operación como un "lottery decision" de respaldo via audit client
			const audit = context?.auditClient ?? defaultAuditClient;
			await audit.recordLotteryDecision({
				assignmentRunId,
				courseId: course.courseId,
				courseName: course.courseName,
				parallel,
				preference: 0,
				candidates: needy.map((s) => ({ id: s.id, email: s.email })),
				winners: winners.map((w) => ({ id: w.id, email: w.email })),
				availableSpots: available,
				seedUsed: seedStudents ?? seedBase,
				swaps: studentSwaps,
				reason: `backup_allocation_parallel_${parallel}`,
				requestIp: context?.requestIp,
				userAgent: context?.userAgent,
				executionContext: { triggeredBy: "assignRandomBackupFillRemaining" },
				client: context?.prismaClient,
			});

			lotteriesExecuted++;
		}
	}

	return { totalAssigned, lotteriesExecuted };
}
