/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeAssignmentAlgorithm } from "@/lib/assignment-runner";
import { detectAndRecordAssignmentConflicts } from "@/lib/assignment-validators";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * POST /api/admin/assignments/execute
 * Body (JSON): { dryRun?: boolean, clearPrevious?: boolean, notes?: string }
 * Creates an `assignment_runs` record, executes the assignment algorithm (atomic),
 * runs validations, and returns a summary + run id.
 */
export async function POST(request: Request) {
	let runId: string | undefined;
	try {
		const body = await request.json().catch(() => ({}));
		const {
			dryRun = false,
			clearPrevious = true,
			notes = null,
		} = body as {
			dryRun?: boolean;
			clearPrevious?: boolean;
			notes?: string | null;
		};

		const userAgent = request.headers.get("user-agent") ?? undefined;
		const requestIp =
			request.headers.get("x-forwarded-for") ??
			request.headers.get("x-real-ip") ??
			undefined;

		// 1) Auth: only admin
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
				{
					success: false,
					error:
						"No autorizado. Solo administradores pueden ejecutar asignaciones.",
				},
				{ status: 403 }
			);
		}

		const initiatedByEmail = session.user.email;

		// 2) Ensure selections are closed before running
		// Prefer environment variable SELECTIONS_CLOSED (true/1). If not set, try to read a site_settings table if present.
		const envClosed = (process.env.SELECTIONS_CLOSED || "").toLowerCase();
		let selectionsClosed = envClosed === "1" || envClosed === "true";
		if (!selectionsClosed) {
			try {
				// try reading a `site_settings` table or similar (best-effort). If not present, we'll keep selectionsClosed=false
				const setting = await (prisma as any).site_settings?.findUnique?.({
					where: { key: "selections_closed" },
				});
				if (
					setting &&
					(setting.value === "1" ||
						String(setting.value).toLowerCase() === "true")
				)
					selectionsClosed = true;
			} catch {
				// ignore: fallback to env
			}
		}

		if (!selectionsClosed) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Las selecciones deben estar cerradas para ejecutar el algoritmo. Configure SELECTIONS_CLOSED=true o cierre el periodo desde el panel.",
				},
				{ status: 412 }
			);
		}

		// 3) Ensure only one execution at a time using a simple metadata.status='running' check on assignment_runs
		try {
			const runningCountRes = await (prisma as any).$queryRaw`
				SELECT COUNT(*)::bigint as count FROM assignment_runs WHERE metadata->>'status' = 'running'
			`;
			const runningCount =
				runningCountRes && runningCountRes[0]
					? Number(runningCountRes[0].count ?? 0)
					: 0;
			if (runningCount > 0) {
				return NextResponse.json(
					{
						success: false,
						error:
							"Ya existe una ejecución en curso. Espera a que termine antes de iniciar otra.",
					},
					{ status: 409 }
				);
			}
		} catch (err) {
			// If the table doesn't exist yet, allow execution (migration pending) — but warn in logs
			console.warn(
				"No se pudo comprobar ejecuciones en curso (tabla assignment_runs ausente?) - procediendo: ",
				(err as Error).message
			);
		}

		// Create assignment_run record (mark as running) and record start timestamp
		const startedAt = new Date().toISOString();
		const run = await (prisma as any).assignment_runs.create({
			data: {
				initiated_by: user.id ?? undefined,
				initiated_by_email: initiatedByEmail ?? undefined,
				seed: null,
				notes: notes ?? undefined,
				metadata: {
					dryRun,
					clearPrevious,
					status: "running",
					started_at: startedAt,
					initiated_by_email: initiatedByEmail ?? null,
				},
			},
		});
		runId = run?.id;

		// Load students and courses from DB to pass into the runner (the runner expects structured inputs)
		// Include students WITH selections AND students WITHOUT selections (for random assignment at the end)
		const studentsRaw = await prisma.students.findMany({
			where: { role: "student" },
			include: {
				selections: {
					include: { courses: true },
					orderBy: { preference_order: "asc" },
				},
			},
		});

		const students = studentsRaw.map((s: any) => ({
			id: s.id,
			email: s.email,
			selections: (s.selections ?? []).map((sel: any) => ({
				course_id: sel.course_id,
				preference_order: sel.preference_order,
				courses: {
					id: sel.courses?.id,
					name: sel.courses?.name,
					parallel: sel.courses?.parallel,
				},
			})),
			is_neurodivergent: s.is_neurodivergent,
			level: s.level,
		}));

		const coursesRaw = await prisma.courses.findMany();
		const courses = coursesRaw.map((c) => ({
			courseId: c.id,
			courseName: c.name,
			parallel: c.parallel,
			capacity: c.capacity,
			assignedCount: 0,
		}));

		// Optionally clear previous assignments (the runner may already do clean-up)
		if (clearPrevious) {
			// remove any assignments/lotteries linked to prior runs (or global) to ensure fresh start
			await prisma.assignments.deleteMany({});
			await prisma.lotteries.deleteMany({});
		}

		// Execute the algorithm (runs inside a transaction in the runner)
		const result = await executeAssignmentAlgorithm({
			students,
			courses,
			assignmentRunId: run.id,
			requestIp: requestIp ?? undefined,
			userAgent: userAgent ?? undefined,
			dryRun,
		});

		// Ensure conflicts are recorded (runner already records, but call again to be safe)
		const recordedProblems = await detectAndRecordAssignmentConflicts({
			assignmentRunId: run.id,
			requestIp: requestIp ?? undefined,
			userAgent: userAgent ?? undefined,
		});

		// If there are validation problems, mark the run accordingly and (unless dryRun)
		// return a non-2xx status so the caller is aware that the assignment finished
		// but with business-rule violations. We still persist the run and logs.
		if ((recordedProblems?.length ?? 0) > 0) {
			try {
				if (typeof runId === "string") {
					const completedAt = new Date().toISOString();
					const durationSeconds =
						(Date.parse(completedAt) -
							Date.parse((run?.metadata?.started_at as string) ?? startedAt)) /
						1000;
					await (prisma as any).assignment_runs.update({
						where: { id: runId },
						data: {
							metadata: {
								status: "completed_with_issues",
								summary: result.summary,
								completed_at: completedAt,
								duration_seconds: durationSeconds,
								problems_count: recordedProblems.length,
							},
						},
					});
				}
			} catch (e) {
				console.warn(
					"No se pudo actualizar assignment_run como completed_with_issues:",
					(e as Error).message
				);
			}

			// If this was a dry run we allow returning success but indicate issues; otherwise return 422
			if (body?.dryRun) {
				return NextResponse.json({
					success: true,
					runId: run.id,
					summary: result.summary,
					problems: recordedProblems,
					warning: "Validation problems detected during dry run",
				});
			}

			return NextResponse.json(
				{
					success: false,
					runId: run.id,
					summary: result.summary,
					problems: recordedProblems,
					error:
						"Validation problems detected: some students have missing assignments or other integrity issues",
				},
				{ status: 422 }
			);
		}

		// mark run as completed (best-effort)
		try {
			if (typeof runId === "string") {
				const completedAt = new Date().toISOString();
				// compute duration in seconds
				const durationSeconds =
					(Date.parse(completedAt) -
						Date.parse((run?.metadata?.started_at as string) ?? startedAt)) /
					1000;

				// attempt to count lotteries for this run (best-effort)
				let lotteriesCount = 0;
				try {
					const lotteriesRes: Array<{ count: bigint }> = await (prisma as any)
						.$queryRaw`SELECT COUNT(*)::bigint as count FROM lotteries WHERE assignment_run_id = ${runId}`;
					lotteriesCount = Number(lotteriesRes[0]?.count ?? 0);
				} catch {
					// ignore: table may not exist or prisma generate pending
				}

				await (prisma as any).assignment_runs.update({
					where: { id: runId },
					data: {
						metadata: {
							status: "completed",
							summary: result.summary,
							completed_at: completedAt,
							duration_seconds: durationSeconds,
							lotteries_executed: lotteriesCount,
						},
					},
				});
			}
		} catch (e) {
			console.warn(
				"No se pudo actualizar assignment_run como completed:",
				(e as Error).message
			);
		}

		return NextResponse.json({
			success: true,
			runId: run.id,
			summary: result.summary,
			problems: recordedProblems,
		});
	} catch (err: unknown) {
		console.error("Error executing assignment endpoint:", err);
		const msg = err instanceof Error ? err.message : String(err);

		// try to mark run failed if it was created
		try {
			if (typeof runId === "string") {
				await (prisma as any).assignment_runs.update({
					where: { id: runId },
					data: { metadata: { status: "failed", error: msg } },
				});
			}
		} catch (updateErr) {
			console.warn(
				"No se pudo marcar assignment_run como fallido:",
				(updateErr as Error).message
			);
		}

		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}

// Removido "edge" runtime porque debug-logger usa Node.js modules (fs, path)
// export const runtime = "edge";
