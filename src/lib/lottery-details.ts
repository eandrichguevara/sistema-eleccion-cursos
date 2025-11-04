/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";

type Options = {
	assignmentRunId: string;
	prismaClient?: any; // PrismaClient | Prisma.TransactionClient - any while prisma generate pending
};

export type LotteryParticipant = {
	student_id: string;
	student_email: string | null;
	won: boolean;
};

export type LotteryDetail = {
	lottery_id: string;
	course_id: string;
	course_name: string;
	parallel: number | null;
	preference: number | null;
	candidates: number | null;
	available_spots: number | null;
	executed_at: string | null;
	participants: LotteryParticipant[];
};

/**
 * Devuelve detalles de cada sorteo ejecutado para un `assignment_run`.
 * Retorna un array de objetos con participantes y su estado (won true/false).
 */
export async function generateLotteryDetails(
	options: Options
): Promise<LotteryDetail[]> {
	const { assignmentRunId, prismaClient } = options;
	const db = prismaClient ?? (prisma as any);

	// agrupamos resultados por sorteo usando JSON agg
	const rows: Array<{
		lottery_id: string;
		course_id: string;
		course_name: string;
		parallel: number | null;
		preference: number | null;
		candidates: number | null;
		available_spots: number | null;
		executed_at: string | null;
		participants: any; // json
	}> = await db.$queryRaw`
    SELECT
      l.id as lottery_id,
      l.course_id,
      l.course_name,
      l.parallel,
      l.preference,
      l.candidates,
      l.available_spots,
      to_char(l.executed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as executed_at,
      json_agg(json_build_object('student_id', r.student_id, 'student_email', r.student_email, 'won', r.won) ORDER BY r.student_email NULLS LAST) as participants
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    WHERE l.assignment_run_id = ${assignmentRunId}
    GROUP BY l.id
    ORDER BY l.executed_at ASC
  `;

	// Map rows to typed structure
	const details: LotteryDetail[] = rows.map((r) => ({
		lottery_id: r.lottery_id,
		course_id: r.course_id,
		course_name: r.course_name,
		parallel: r.parallel,
		preference: r.preference,
		candidates: r.candidates,
		available_spots: r.available_spots,
		executed_at: r.executed_at ?? null,
		participants: Array.isArray(r.participants)
			? r.participants.map((p: any) => ({
					student_id: p.student_id,
					student_email: p.student_email ?? null,
					won: !!p.won,
			  }))
			: [],
	}));

	return details;
}

/**
 * Formatea de forma textual (español) los detalles de cada sorteo.
 */
export function formatLotteryDetailsText(details: LotteryDetail[]): string {
	const lines: string[] = [];
	for (const d of details) {
		lines.push(`Sorteo: ${d.lottery_id} — ${d.course_name} (${d.course_id})`);
		lines.push(
			`  Paralelo: ${d.parallel ?? "-"}  Preferencia: ${
				d.preference ?? "-"
			}  Ejecutado: ${d.executed_at ?? "-"} `
		);
		lines.push(
			`  Cupos disponibles: ${d.available_spots ?? "-"}  Candidatos: ${
				d.candidates ?? d.participants.length
			}`
		);
		lines.push(`  Participantes:`);
		for (const p of d.participants) {
			lines.push(
				`    - ${p.student_id} <${p.student_email ?? "sin email"}> — ${
					p.won ? "GANADOR" : "PERDEDOR"
				}`
			);
		}
		lines.push("");
	}
	return lines.join("\n");
}

const _default = { generateLotteryDetails, formatLotteryDetailsText };
export default _default;
