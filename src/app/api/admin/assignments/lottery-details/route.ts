/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/admin/assignments/lottery-details?runId=...
 * Returns detailed lottery information for a specific assignment run.
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

		// Fetch lotteries for this run
		const lotteries = await (prisma as any).lotteries.findMany({
			where: { assignment_run_id: runId },
			include: {
				lottery_results: true,
			},
			orderBy: { executed_at: "asc" },
		});

		// Transform to the format expected by the component
		const details = lotteries.map((lottery: any) => ({
			lotteryId: lottery.id,
			courseName: lottery.course_name || "Unknown Course",
			parallel: lottery.parallel || 0,
			preference: lottery.preference || 0,
			totalCandidates: lottery.candidates || 0,
			availableSlots: lottery.available_spots || 0,
			candidates: (lottery.lottery_results || []).map((result: any) => ({
				studentId: result.student_id,
				email: result.student_email || "Unknown",
				won: result.won,
			})),
		}));

		return NextResponse.json({ success: true, details });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Error GET /api/admin/assignments/lottery-details:", err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}
