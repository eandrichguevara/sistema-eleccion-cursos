/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/admin/assignments/priority-changes?runId=...
 * Returns priority changes (fallback assignments) for a specific assignment run.
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

		// Find assignments that were fallback (preference_order > 3 or assignments made during fallback phases)
		// This is a simplified version - you could enhance it by tracking which phase each assignment came from
		const assignments = await (prisma as any).assignments.findMany({
			where: {
				assignment_run_id: runId,
				OR: [
					{ preference_order: { gt: 3 } }, // Fallback preferences
					{ preference_order: 0 }, // Backup assignments
				],
			},
			include: {
				students: {
					select: {
						email: true,
					},
				},
				courses: {
					select: {
						name: true,
					},
				},
			},
			orderBy: { assigned_at: "asc" },
		});

		// Transform to priority changes format
		const changes = assignments.map((assignment: any) => ({
			studentId: assignment.student_id,
			email: assignment.students?.email || "Unknown",
			fromPreference: assignment.preference_order > 3 ? 1 : 0, // Simplified
			toPreference: assignment.preference_order,
			assignedCourseName: assignment.courses?.name || "Unknown Course",
		}));

		return NextResponse.json({ success: true, changes });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Error GET /api/admin/assignments/priority-changes:", err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}
