/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";

type Options = {
	assignmentRunId: string;
	prismaClient?: any;
};

export type PriorityChangeRow = {
	student_id: string;
	student_email: string | null;
	pref1_wins: number;
	assigned_pref_gt1_count: number;
	pref1_participations: Array<{
		lottery_id: string;
		course_id: string;
		course_name: string;
		won: boolean;
	}>;
	assignments: Array<{
		course_id: string;
		course_name: string | null;
		preference_order: number;
	}>;
};

/**
 * Detecta estudiantes que participaron en sorteos de preferencia 1, no ganaron en preferencia 1,
 * y terminaron con asignaciones de preferencia > 1 en el mismo `assignment_run`.
 *
 * Retorna una lista de objetos con participaciones en preferencia 1 y las asignaciones finales.
 */
export async function generatePriorityChangeReport(
	options: Options
): Promise<PriorityChangeRow[]> {
	const { assignmentRunId, prismaClient } = options;
	const db = prismaClient ?? (prisma as any);

	const runId = assignmentRunId;

	const rows: Array<{
		student_id: string;
		student_email: string | null;
		pref1_wins: bigint;
		assigned_pref_gt1_count: bigint;
		pref1_participations: any; // json array
		assignments: any; // json array
	}> = await db.$queryRaw`
    WITH pref1_participants AS (
      SELECT DISTINCT r.student_id, r.student_email
      FROM lottery_results r
      JOIN lotteries l ON r.lottery_id = l.id
      WHERE l.assignment_run_id = ${runId} AND l.preference = 1
    )
    SELECT
      p.student_id,
      p.student_email,
      (SELECT COUNT(*)::bigint FROM lottery_results r JOIN lotteries l2 ON r.lottery_id = l2.id WHERE l2.assignment_run_id = ${runId} AND l2.preference = 1 AND r.student_id = p.student_id AND r.won = true) as pref1_wins,
      (SELECT COUNT(*)::bigint FROM assignments a WHERE a.assignment_run_id = ${runId} AND a.student_id = p.student_id AND a.preference_order > 1) as assigned_pref_gt1_count,
      (
        SELECT json_agg(json_build_object('lottery_id', l.id, 'course_id', l.course_id, 'course_name', l.course_name, 'won', r.won) ORDER BY l.executed_at ASC)
        FROM lotteries l
        JOIN lottery_results r ON r.lottery_id = l.id
        WHERE l.assignment_run_id = ${runId} AND l.preference = 1 AND r.student_id = p.student_id
      ) as pref1_participations,
      (
        SELECT json_agg(json_build_object('course_id', a.course_id, 'course_name', c.name, 'preference_order', a.preference_order) ORDER BY a.preference_order ASC)
        FROM assignments a
        LEFT JOIN courses c ON c.id = a.course_id
        WHERE a.assignment_run_id = ${runId} AND a.student_id = p.student_id
      ) as assignments
    FROM pref1_participants p
    HAVING (SELECT COUNT(*) FROM lottery_results r JOIN lotteries l2 ON r.lottery_id = l2.id WHERE l2.assignment_run_id = ${runId} AND l2.preference = 1 AND r.student_id = p.student_id AND r.won = true) = 0
       AND (SELECT COUNT(*) FROM assignments a WHERE a.assignment_run_id = ${runId} AND a.student_id = p.student_id AND a.preference_order > 1) > 0
  `;

	return rows.map((r) => ({
		student_id: r.student_id,
		student_email: r.student_email ?? null,
		pref1_wins: Number(r.pref1_wins),
		assigned_pref_gt1_count: Number(r.assigned_pref_gt1_count),
		pref1_participations: Array.isArray(r.pref1_participations)
			? r.pref1_participations.map((p: any) => ({
					lottery_id: p.lottery_id,
					course_id: p.course_id,
					course_name: p.course_name,
					won: !!p.won,
			  }))
			: [],
		assignments: Array.isArray(r.assignments)
			? r.assignments.map((a: any) => ({
					course_id: a.course_id,
					course_name: a.course_name ?? null,
					preference_order: a.preference_order,
			  }))
			: [],
	}));
}

export function formatPriorityChangeText(rows: PriorityChangeRow[]): string {
	if (!rows || rows.length === 0)
		return "No se detectaron estudiantes que perdieran en preferencia 1 y terminaran asignados en preferencia 2/3.";

	const lines: string[] = [];
	lines.push("Estudiantes con cambio de prioridad (1ª → 2ª/3ª):");
	lines.push("------------------------------------------------");
	for (const r of rows) {
		lines.push(`- ${r.student_id} <${r.student_email ?? "sin email"}>`);
		lines.push(`  - Participaciones en preferencia 1 (no ganadas):`);
		for (const p of r.pref1_participations) {
			lines.push(
				`    * ${p.course_name} (${p.course_id}) — ${p.won ? "GANÓ" : "PERDIÓ"}`
			);
		}
		lines.push(
			`  - Asignaciones finales (${r.assigned_pref_gt1_count} con preferencia >1):`
		);
		for (const a of r.assignments) {
			lines.push(
				`    * ${a.course_name ?? a.course_id} — preferencia ${
					a.preference_order
				}`
			);
		}
		lines.push("");
	}

	return lines.join("\n");
}

const _default = { generatePriorityChangeReport, formatPriorityChangeText };
export default _default;
