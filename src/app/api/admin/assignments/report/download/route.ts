/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateAssignmentReport } from "@/lib/assignment-report";
import { generateAuditCsv } from "@/lib/audit-csv-export";

/**
 * GET /api/admin/assignments/report/download?runId=...&format=json|csv&file=assignments|lotteries|lotteryResults|priorityChanges
 * Returns either JSON (report + CSV strings) or a single CSV file (choose which via `file` query param).
 */
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const runId = url.searchParams.get("runId");
		const format = (url.searchParams.get("format") || "json").toLowerCase();
		const file = url.searchParams.get("file") || "assignments";

		// Auth
		const session = (await getServerSession(authOptions as any)) as any;
		if (!session || !session.user?.email)
			return NextResponse.json(
				{ success: false, error: "No autenticado" },
				{ status: 401 }
			);
		const user = await prisma.students.findUnique({
			where: { email: session.user.email },
		});
		if (!user || user.role !== "admin")
			return NextResponse.json(
				{ success: false, error: "No autorizado" },
				{ status: 403 }
			);

		// Resolve runId if missing: pick last run id (best-effort)
		let resolvedRunId = runId;
		if (!resolvedRunId) {
			try {
				const latestRes: Array<{ id: string }> = await (prisma as any)
					.$queryRaw`SELECT id FROM assignment_runs ORDER BY metadata->>'started_at' DESC NULLS LAST LIMIT 1`;
				if (latestRes && latestRes[0]) resolvedRunId = latestRes[0].id;
			} catch {
				try {
					const alt: Array<{ id: string }> = await (prisma as any)
						.$queryRaw`SELECT id FROM assignment_runs ORDER BY id DESC LIMIT 1`;
					if (alt && alt[0]) resolvedRunId = alt[0].id;
				} catch {
					// leave undefined
				}
			}
		}

		if (!resolvedRunId)
			return NextResponse.json(
				{ success: false, error: "No assignment run found" },
				{ status: 404 }
			);

		if (format === "csv") {
			// generate CSVs and return the requested file
			const csvs = await generateAuditCsv({
				assignmentRunId: resolvedRunId,
				prismaClient: prisma as any,
			});

			let content = "";
			let filename = `${file}_${resolvedRunId}.csv`;
			switch (file) {
				case "assignments":
					content = csvs.assignmentsCsv;
					break;
				case "lotteries":
					content = csvs.lotteriesCsv;
					break;
				case "lotteryResults":
				case "lottery_results":
					content = csvs.lotteryResultsCsv;
					filename = `lottery_results_${resolvedRunId}.csv`;
					break;
				case "priorityChanges":
				case "priority_changes":
					content = csvs.priorityChangesCsv;
					break;
				default:
					content = csvs.assignmentsCsv;
			}

			return new NextResponse(content, {
				status: 200,
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="${filename}"`,
				},
			});
		}

		// Default: JSON
		const reportText = await generateAssignmentReport({
			assignmentRunId: resolvedRunId,
		});
		const csvs = await generateAuditCsv({
			assignmentRunId: resolvedRunId,
			prismaClient: prisma as any,
		});

		return NextResponse.json({
			success: true,
			runId: resolvedRunId,
			report: reportText,
			csvs,
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}

export const runtime = "edge";
