/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";
import lotteryDetailsModule, { LotteryDetail } from "./lottery-details";
import priorityChangeModule, {
	PriorityChangeRow,
} from "./priority-change-report";

type Options = {
	assignmentRunId: string;
	prismaClient?: any;
};

export type DashboardReport = {
	runId: string;
	totals: {
		totalAssignments: number;
		totalLotteries: number;
		winners: number;
		losers: number;
	};
	groups: {
		neurodivergent: number;
		fourth_year: number;
		third_year: number;
		others: number;
	};
	lotteriesByPreference: Array<{ preference: number; count: number }>;
	lotteriesInvolvingGroups: {
		neuro: number;
		fourth: number;
		third: number;
	};
	lotteryDetails: LotteryDetail[];
	priorityChanges: PriorityChangeRow[];
	integrityProblemsCount: number;
};

/**
 * Genera un objeto JSON con métricas y detalles útiles para un dashboard.
 * Reutiliza `lottery-details` y `priority-change-report` para los bloques detallados.
 */
export async function generateDashboardReport(
	options: Options
): Promise<DashboardReport> {
	const { assignmentRunId, prismaClient } = options;
	const db = prismaClient ?? (prisma as any);
	const runId = assignmentRunId;

	// Totales básicos
	const totalAssignmentsRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM assignments WHERE assignment_run_id = ${runId}
  `;
	const totalAssignments = Number(totalAssignmentsRes[0]?.count ?? 0);

	const lotteriesTotalRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM lotteries WHERE assignment_run_id = ${runId}
  `;
	const totalLotteries = Number(lotteriesTotalRes[0]?.count ?? 0);

	const winnersRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(r.*)::bigint as count
    FROM lottery_results r
    JOIN lotteries l ON r.lottery_id = l.id
    WHERE l.assignment_run_id = ${runId} AND r.won = true
  `;
	const winners = Number(winnersRes[0]?.count ?? 0);

	const losersRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(r.*)::bigint as count
    FROM lottery_results r
    JOIN lotteries l ON r.lottery_id = l.id
    WHERE l.assignment_run_id = ${runId} AND r.won = false
  `;
	const losers = Number(losersRes[0]?.count ?? 0);

	// Por grupos
	const neuroAssignedRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(a.*)::bigint as count
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    WHERE a.assignment_run_id = ${runId} AND s.is_neurodivergent = true
  `;
	const neuroAssigned = Number(neuroAssignedRes[0]?.count ?? 0);

	const fourthAssignedRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(a.*)::bigint as count
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    WHERE a.assignment_run_id = ${runId} AND s.level = 4 AND s.is_neurodivergent = false
  `;
	const fourthAssigned = Number(fourthAssignedRes[0]?.count ?? 0);

	const thirdAssignedRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(a.*)::bigint as count
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    WHERE a.assignment_run_id = ${runId} AND s.level = 3 AND s.is_neurodivergent = false
  `;
	const thirdAssigned = Number(thirdAssignedRes[0]?.count ?? 0);

	const othersAssigned =
		totalAssignments - (neuroAssigned + fourthAssigned + thirdAssigned);

	// Lotteries by preference
	const lotteriesByPref: Array<{ preference: number; count: bigint }> =
		await db.$queryRaw`
    SELECT preference, COUNT(*)::bigint as count
    FROM lotteries
    WHERE assignment_run_id = ${runId}
    GROUP BY preference
    ORDER BY preference
  `;

	// Lotteries involving groups (approx)
	const lotteriesWithNeuroRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(DISTINCT l.id)::bigint as count
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    JOIN students s ON s.id = r.student_id
    WHERE l.assignment_run_id = ${runId} AND s.is_neurodivergent = true
  `;
	const lotteriesWithNeuro = Number(lotteriesWithNeuroRes[0]?.count ?? 0);

	const lotteriesWithFourthRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(DISTINCT l.id)::bigint as count
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    JOIN students s ON s.id = r.student_id
    WHERE l.assignment_run_id = ${runId} AND s.level = 4 AND s.is_neurodivergent = false
  `;
	const lotteriesWithFourth = Number(lotteriesWithFourthRes[0]?.count ?? 0);

	const lotteriesWithThirdRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(DISTINCT l.id)::bigint as count
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    JOIN students s ON s.id = r.student_id
    WHERE l.assignment_run_id = ${runId} AND s.level = 3 AND s.is_neurodivergent = false
  `;
	const lotteriesWithThird = Number(lotteriesWithThirdRes[0]?.count ?? 0);

	// Problems count (per-student conflict logs)
	const problemsRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM assignment_logs WHERE assignment_run_id = ${runId} AND event_type = 'assignment_conflict'
  `;
	const problemsCount = Number(problemsRes[0]?.count ?? 0);

	// Detailed blocks (reuse modules)
	const lotteryDetails = await lotteryDetailsModule.generateLotteryDetails({
		assignmentRunId: runId,
		prismaClient: db,
	});
	const priorityChanges =
		await priorityChangeModule.generatePriorityChangeReport({
			assignmentRunId: runId,
			prismaClient: db,
		});

	const report: DashboardReport = {
		runId,
		totals: {
			totalAssignments,
			totalLotteries,
			winners,
			losers,
		},
		groups: {
			neurodivergent: neuroAssigned,
			fourth_year: fourthAssigned,
			third_year: thirdAssigned,
			others: othersAssigned,
		},
		lotteriesByPreference: lotteriesByPref.map((r) => ({
			preference: Number(r.preference),
			count: Number(r.count),
		})),
		lotteriesInvolvingGroups: {
			neuro: lotteriesWithNeuro,
			fourth: lotteriesWithFourth,
			third: lotteriesWithThird,
		},
		lotteryDetails,
		priorityChanges,
		integrityProblemsCount: problemsCount,
	};

	return report;
}

export function generateDashboardReportJSON(report: DashboardReport): string {
	return JSON.stringify(report, null, 2);
}

const _default = { generateDashboardReport, generateDashboardReportJSON };
export default _default;
