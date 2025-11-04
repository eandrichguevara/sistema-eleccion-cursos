/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/admin/assignments/dashboard?runId=...
 * Returns dashboard metrics for a specific assignment run.
 */
export async function GET(request: NextRequest) {
	try {
		// Auth: only admin
		const session = await getServerSession(authOptions);
		if (!session || !session.user?.email) {
			return NextResponse.json(
				{ success: false, error: "No autenticado" },
				{ status: 401 }
			);
		}
		const user = await prisma.students.findUnique({
			where: { email: session.user.email },
		});
		if (!user || user.role !== "admin") {
			return NextResponse.json(
				{ success: false, error: "No autorizado. Solo administradores." },
				{ status: 403 }
			);
		}

		const { searchParams } = new URL(request.url);
		const runId = searchParams.get("runId");

		if (!runId) {
			return NextResponse.json(
				{ success: false, error: "runId es requerido" },
				{ status: 400 }
			);
		}

		// Fetch the assignment run
		const run = await (prisma as any).assignment_runs.findUnique({
			where: { id: runId },
		});

		if (!run) {
			return NextResponse.json(
				{ success: false, error: "Run no encontrado" },
				{ status: 404 }
			);
		}

		// Extract metrics from metadata
		const metadata = run.metadata || {};
		const summary = metadata.summary || {};

		// Count assignments for this run
		const totalAssignments = await (prisma as any).assignments.count({
			where: { assignment_run_id: runId },
		});

		// Count lotteries for this run
		const totalLotteries = await (prisma as any).lotteries.count({
			where: { assignment_run_id: runId },
		});

		// Build dashboard response
		const dashboard = {
			runId: run.id,
			status: metadata.status || "unknown",
			createdAt: run.executed_at,
			completedAt: metadata.completed_at || null,
			durationSeconds: metadata.duration_seconds || 0,
			summary: {
				totalAssignments: summary.totalAssignments || totalAssignments,
				totalStudents: summary.totalStudents || 0,
				neurodivergentAssignments: summary.neurodivergentAssignments || 0,
				fourthYearAssignments: summary.fourthYearAssignments || 0,
				thirdYearAssignments: summary.thirdYearAssignments || 0,
				lotteriesExecuted: summary.lotteriesExecuted || totalLotteries,
				studentsFullyAssigned: summary.studentsFullyAssigned || 0,
				studentsPartiallyAssigned: summary.studentsPartiallyAssigned || 0,
			},
			phases: {
				neuro_first: summary.neuro_first || {},
				neuro_fallback: summary.neuro_fallback || {},
				fourth_first: summary.fourth_first || {},
				fourth_fallback: summary.fourth_fallback || {},
				third_first: summary.third_first || {},
				third_fallback: summary.third_fallback || {},
				backup_fill: summary.backup_fill || {},
			},
			integrity: summary.integrity || "unknown",
			problemsCount: metadata.problems_count || summary.problemsCount || 0,
		};

		return NextResponse.json(dashboard);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Error GET /api/admin/assignments/dashboard:", err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}
