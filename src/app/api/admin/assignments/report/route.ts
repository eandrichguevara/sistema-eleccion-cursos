/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateAssignmentReport } from "@/lib/assignment-report";

/**
 * GET /api/admin/assignments/report
 * Returns the textual report for the latest assignment run.
 */
export async function GET() {
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

		// Find latest assignment_run (best-effort). Use raw query in case Prisma client isn't generated for the new model.
		let latest: any = null;
		try {
			const rows: Array<{ id: string }> = await (prisma as any)
				.$queryRaw`SELECT id FROM assignment_runs ORDER BY executed_at DESC LIMIT 1`;
			latest = rows?.[0] ?? null;
		} catch (e) {
			// If table doesn't exist or query fails, return a clear error
			console.warn(
				"No se pudo leer assignment_runs (migraciones pendientes?):",
				(e as Error).message
			);
			return NextResponse.json(
				{
					success: false,
					error:
						"No se encontró ninguna ejecución. ¿Aplicaste las migraciones?",
				},
				{ status: 404 }
			);
		}

		if (!latest || !latest.id) {
			return NextResponse.json(
				{ success: false, error: "No hay ejecuciones registradas." },
				{ status: 404 }
			);
		}

		const runId = String(latest.id);

		// Generate textual report using existing helper (returns string)
		const reportText = await generateAssignmentReport({
			assignmentRunId: runId,
		});

		return NextResponse.json({ success: true, runId, report: reportText });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Error GET /api/admin/assignments/report:", err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}
