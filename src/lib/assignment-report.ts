/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";

type ReportOptions = {
	assignmentRunId: string;
	prismaClient?: any; // PrismaClient | Prisma.TransactionClient - kept any until prisma generate is available
};

function fmt(n: number) {
	return n.toString();
}

/**
 * Genera un reporte textual en español del proceso de asignación para un `assignment_run`
 * - resume por grupo prioritario cuántos asignados
 * - cuántos sorteos totales y por preferencia
 * - cuántos sorteos involucraron candidatos de cada grupo (aproximación)
 *
 * Usa consultas SQL crudas para evitar depender de tipos generados de Prisma mientras
 * las migraciones no se han aplicado en el entorno local.
 */
export async function generateAssignmentReport(
	options: ReportOptions
): Promise<string> {
	const { assignmentRunId, prismaClient } = options;
	const db = prismaClient ?? (prisma as any);

	const runId = assignmentRunId;

	// Totales de asignaciones en este run
	const totalAssignmentsRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM assignments WHERE assignment_run_id = ${runId}::uuid
  `;
	const totalAssignments = Number(totalAssignmentsRes[0]?.count ?? 0);

	// Asignados por grupo
	const neuroAssignedRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(a.*)::bigint as count
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    WHERE a.assignment_run_id = ${runId}::uuid AND s.is_neurodivergent = true
  `;
	const neuroAssigned = Number(neuroAssignedRes[0]?.count ?? 0);

	const fourthAssignedRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(a.*)::bigint as count
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    WHERE a.assignment_run_id = ${runId}::uuid AND s.level = 4 AND s.is_neurodivergent = false
  `;
	const fourthAssigned = Number(fourthAssignedRes[0]?.count ?? 0);

	const thirdAssignedRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(a.*)::bigint as count
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    WHERE a.assignment_run_id = ${runId}::uuid AND s.level = 3 AND s.is_neurodivergent = false
  `;
	const thirdAssigned = Number(thirdAssignedRes[0]?.count ?? 0);

	const othersAssigned =
		totalAssignments - (neuroAssigned + fourthAssigned + thirdAssigned);

	// Estadísticas de sorteos
	const lotteriesTotalRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM lotteries WHERE assignment_run_id = ${runId}::uuid
  `;
	const lotteriesTotal = Number(lotteriesTotalRes[0]?.count ?? 0);

	const lotteriesByPref: Array<{ preference: number; count: bigint }> =
		await db.$queryRaw`
    SELECT preference, COUNT(*)::bigint as count
    FROM lotteries
    WHERE assignment_run_id = ${runId}::uuid
    GROUP BY preference
    ORDER BY preference
  `;

	// Cuántos sorteos involucraron candidatos de cada grupo (distinct lottery ids)
	const lotteriesWithNeuroRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(DISTINCT l.id)::bigint as count
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    JOIN students s ON s.id = r.student_id
    WHERE l.assignment_run_id = ${runId}::uuid AND s.is_neurodivergent = true
  `;
	const lotteriesWithNeuro = Number(lotteriesWithNeuroRes[0]?.count ?? 0);

	const lotteriesWithFourthRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(DISTINCT l.id)::bigint as count
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    JOIN students s ON s.id = r.student_id
    WHERE l.assignment_run_id = ${runId}::uuid AND s.level = 4 AND s.is_neurodivergent = false
  `;
	const lotteriesWithFourth = Number(lotteriesWithFourthRes[0]?.count ?? 0);

	const lotteriesWithThirdRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(DISTINCT l.id)::bigint as count
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    JOIN students s ON s.id = r.student_id
    WHERE l.assignment_run_id = ${runId}::uuid AND s.level = 3 AND s.is_neurodivergent = false
  `;
	const lotteriesWithThird = Number(lotteriesWithThirdRes[0]?.count ?? 0);

	// Ganadores/perdedores totales en los sorteos de este run
	const winnersRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(r.*)::bigint as count
    FROM lottery_results r
    JOIN lotteries l ON r.lottery_id = l.id
    WHERE l.assignment_run_id = ${runId}::uuid AND r.won = true
  `;
	const winners = Number(winnersRes[0]?.count ?? 0);

	const losersRes: Array<{ count: bigint }> = await db.$queryRaw`
    SELECT COUNT(r.*)::bigint as count
    FROM lottery_results r
    JOIN lotteries l ON r.lottery_id = l.id
    WHERE l.assignment_run_id = ${runId}::uuid AND r.won = false
  `;
	const losers = Number(losersRes[0]?.count ?? 0);

	// Build textual report in Spanish
	const lines: string[] = [];
	lines.push(`Reporte de ejecución de asignación — run: ${runId}`);
	lines.push("----------------------------------------------------");
	lines.push(
		`Total de asignaciones registradas en este run: ${fmt(totalAssignments)}`
	);
	lines.push("");
	lines.push("Asignaciones por grupo prioritario:");
	lines.push(`- Neurodivergentes: ${fmt(neuroAssigned)}`);
	lines.push(`- 4° medio (no neurodivergentes): ${fmt(fourthAssigned)}`);
	lines.push(`- 3° medio (no neurodivergentes): ${fmt(thirdAssigned)}`);
	lines.push(`- Otros: ${fmt(othersAssigned)}`);
	lines.push("");
	lines.push("Estadísticas de sorteos:");
	lines.push(`- Sorteos ejecutados (total): ${fmt(lotteriesTotal)}`);
	if (lotteriesByPref.length > 0) {
		lines.push("- Sorteos por preferencia:");
		for (const row of lotteriesByPref) {
			// The stored preference value is 0-based in some DB tables; display as 1-based
			const displayPref = Number(row.preference) + 1;
			lines.push(
				`  - Preferencia ${displayPref}: ${fmt(Number(row.count))} sorteos`
			);
		}
	}
	lines.push("");
	lines.push("Sorteos que involucraron candidatos por grupo (approx):");
	lines.push(
		`- Sorteos con candidatos neurodivergentes: ${fmt(lotteriesWithNeuro)}`
	);
	lines.push(
		`- Sorteos con candidatos 4° medio (no neurodiv): ${fmt(
			lotteriesWithFourth
		)}`
	);
	lines.push(
		`- Sorteos con candidatos 3° medio (no neurodiv): ${fmt(
			lotteriesWithThird
		)}`
	);
	lines.push("");
	lines.push("Resultados agregados de los sorteos:");
	lines.push(
		`- Ganadores totales (sumatoria de todos los sorteos): ${fmt(winners)}`
	);
	lines.push(`- Perdedor(es) totales: ${fmt(losers)}`);
	lines.push("----------------------------------------------------");

	return lines.join("\n");
}

/**
 * Guarda el reporte generado en la tabla de auditoría `assignment_logs`.
 * Se realiza fuera de la transacción principal para que persista incluso si
 * hubo rollback en otras operaciones (pero en nuestro flujo se llama tras commit).
 */
export async function saveAssignmentReportToAudit(options: {
	assignmentRunId: string;
	reportText: string;
	prismaClient?: any;
	requestIp?: string | null;
	userAgent?: string | null;
}) {
	const { assignmentRunId, reportText, prismaClient, requestIp, userAgent } =
		options;
	const db = prismaClient ?? (prisma as any);

	// store as an assignment_log event
	const rec = await db.assignment_logs.create({
		data: {
			assignment_run_id: assignmentRunId ?? undefined,
			event_type: "assignment_report",
			event_subtype: null,
			student_id: null,
			student_email: null,
			course_id: null,
			course_name: null,
			parallel: null,
			preference: null,
			is_priority: null,
			details: { report: reportText, generated_at: new Date().toISOString() },
			request_ip: requestIp ?? null,
			user_agent: userAgent ?? null,
		},
	});

	return rec;
}

const _default = { generateAssignmentReport };
export default _default;
