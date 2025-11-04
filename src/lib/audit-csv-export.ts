/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";
import fs from "fs";
import path from "path";
import lotteryDetailsModule from "./lottery-details";
import priorityChangeModule from "./priority-change-report";

type Options = {
	assignmentRunId: string;
	prismaClient?: any;
};

function csvEscape(v: unknown): string {
	if (v === null || v === undefined) return "";
	const s = typeof v === "string" ? v : String(v);
	return `"${s.replace(/"/g, '""')}"`;
}

function formatPreferenceForExport(v: number | null | undefined): string {
	if (v === null || v === undefined) return "";
	// Some internal markers (e.g. 99) mean 'assigned by availability' and should be left as-is.
	// Only shift small numeric preference indexes (0..2) up by 1 to become 1..3.
	if (typeof v === "number" && v >= 0 && v <= 10) {
		// Shift 0-based preferences up by 1; large sentinel values (like 99) are > 10 so won't be shifted.
		return String(v + 1);
	}
	return String(v);
}

/**
 * Genera CSVs de auditoría para un `assignment_run`:
 * - assignments.csv (student, email, course, preference, is_priority, assigned_at)
 * - lotteries.csv (lottery metadata)
 * - lottery_results.csv (per-student results per lottery)
 * - priority_changes.csv (from priority-change-report)
 *
 * Retorna un objeto con las cadenas CSV. También se puede escribir a disco con `writeAuditCsvToDir`.
 */
export async function generateAuditCsv(options: Options): Promise<{
	assignmentsCsv: string;
	lotteriesCsv: string;
	lotteryResultsCsv: string;
	priorityChangesCsv: string;
}> {
	const { assignmentRunId, prismaClient } = options;
	const db = prismaClient ?? (prisma as any);

	// Assignments
	const assignmentsRows: Array<{
		student_id: string;
		student_email: string | null;
		course_id: string;
		course_name: string | null;
		preference_order: number | null;
		is_priority: boolean | null;
		assigned_at: string | null;
	}> = await db.$queryRaw`
    SELECT a.student_id, s.email as student_email, a.course_id, c.name as course_name, a.preference_order, a.is_priority, to_char(a.assigned_at, 'YYYY-MM-DD"T"HH24:MI:SS') as assigned_at
    FROM assignments a
    LEFT JOIN students s ON s.id = a.student_id
    LEFT JOIN courses c ON c.id = a.course_id
    WHERE a.assignment_run_id = ${assignmentRunId}
    ORDER BY s.email NULLS LAST, a.preference_order NULLS LAST
  `;

	const assignmentsHeader =
		[
			"student_id",
			"student_email",
			"course_id",
			"course_name",
			"preference_order",
			"is_priority",
			"assigned_at",
		].join(",") + "\n";
	const assignmentsCsv =
		assignmentsHeader +
		assignmentsRows
			.map((r) => {
				const pref = formatPreferenceForExport(r.preference_order as any);
				return [
					r.student_id,
					r.student_email ?? "",
					r.course_id,
					r.course_name ?? "",
					pref,
					r.is_priority ?? "",
					r.assigned_at ?? "",
				]
					.map(csvEscape)
					.join(",");
			})
			.join("\n");

	// Lotteries (metadata)
	const lotteriesRows: Array<{
		id: string;
		course_id: string;
		course_name: string;
		parallel: number | null;
		preference: number | null;
		candidates: number | null;
		available_spots: number | null;
		executed_at: string | null;
	}> = await db.$queryRaw`
    SELECT id, course_id, course_name, parallel, preference, candidates, available_spots, to_char(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as executed_at
    FROM lotteries
    WHERE assignment_run_id = ${assignmentRunId}
    ORDER BY executed_at ASC
  `;

	const lotteriesHeader =
		[
			"lottery_id",
			"course_id",
			"course_name",
			"parallel",
			"preference",
			"candidates",
			"available_spots",
			"executed_at",
		].join(",") + "\n";
	const lotteriesCsv =
		lotteriesHeader +
		lotteriesRows
			.map((r) => {
				const pref = formatPreferenceForExport(r.preference as any);
				return [
					r.id,
					r.course_id,
					r.course_name ?? "",
					r.parallel ?? "",
					pref,
					r.candidates ?? "",
					r.available_spots ?? "",
					r.executed_at ?? "",
				]
					.map(csvEscape)
					.join(",");
			})
			.join("\n");

	// Lottery results per student
	const lotteryResultsRows: Array<{
		lottery_id: string;
		student_id: string;
		student_email: string | null;
		won: boolean;
	}> = await db.$queryRaw`
    SELECT l.id as lottery_id, r.student_id, r.student_email, r.won
    FROM lotteries l
    JOIN lottery_results r ON r.lottery_id = l.id
    WHERE l.assignment_run_id = ${assignmentRunId}
    ORDER BY l.executed_at ASC, r.student_email NULLS LAST
  `;

	const lotteryResultsHeader =
		["lottery_id", "student_id", "student_email", "won"].join(",") + "\n";
	const lotteryResultsCsv =
		lotteryResultsHeader +
		lotteryResultsRows
			.map((r) =>
				[r.lottery_id, r.student_id, r.student_email ?? "", r.won ? "1" : "0"]
					.map(csvEscape)
					.join(",")
			)
			.join("\n");

	// Priority changes CSV
	const priorityRows = await priorityChangeModule.generatePriorityChangeReport({
		assignmentRunId,
		prismaClient: db,
	});
	const priorityHeader =
		[
			"student_id",
			"student_email",
			"assigned_pref_gt1_count",
			"pref1_participations_json",
			"assignments_json",
		].join(",") + "\n";
	const priorityCsv =
		priorityHeader +
		priorityRows
			.map((r) =>
				[
					r.student_id,
					r.student_email ?? "",
					String(r.assigned_pref_gt1_count),
					JSON.stringify(r.pref1_participations),
					JSON.stringify(r.assignments),
				]
					.map(csvEscape)
					.join(",")
			)
			.join("\n");

	return {
		assignmentsCsv,
		lotteriesCsv,
		lotteryResultsCsv,
		priorityChangesCsv: priorityCsv,
	};
}

/**
 * Escribe los CSVs generados en un directorio `outDir`. Retorna los paths escritos.
 */
export async function writeAuditCsvToDir(options: {
	assignmentRunId: string;
	outDir: string;
	prismaClient?: any;
}): Promise<{
	assignmentsPath: string;
	lotteriesPath: string;
	lotteryResultsPath: string;
	priorityChangesPath: string;
}> {
	const { assignmentRunId, outDir, prismaClient } = options;
	const csvs = await generateAuditCsv({ assignmentRunId, prismaClient });

	await fs.promises.mkdir(outDir, { recursive: true });

	const assignmentsPath = path.join(
		outDir,
		`assignments_${assignmentRunId}.csv`
	);
	const lotteriesPath = path.join(outDir, `lotteries_${assignmentRunId}.csv`);
	const lotteryResultsPath = path.join(
		outDir,
		`lottery_results_${assignmentRunId}.csv`
	);
	const priorityChangesPath = path.join(
		outDir,
		`priority_changes_${assignmentRunId}.csv`
	);

	await Promise.all([
		fs.promises.writeFile(assignmentsPath, csvs.assignmentsCsv, "utf8"),
		fs.promises.writeFile(lotteriesPath, csvs.lotteriesCsv, "utf8"),
		fs.promises.writeFile(lotteryResultsPath, csvs.lotteryResultsCsv, "utf8"),
		fs.promises.writeFile(priorityChangesPath, csvs.priorityChangesCsv, "utf8"),
	]);

	return {
		assignmentsPath,
		lotteriesPath,
		lotteryResultsPath,
		priorityChangesPath,
	};
}

const _default = { generateAuditCsv, writeAuditCsvToDir };
export default _default;
