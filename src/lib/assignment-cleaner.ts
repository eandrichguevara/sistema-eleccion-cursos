/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";
import type { PrismaClient, Prisma } from "@prisma/client";

/**
 * Borra asignaciones y registros de auditoría asociados a un `assignment_run_id`.
 *
 * Seguridad: requiere `assignmentRunId` para evitar borrados accidentales.
 * Acepta un `prismaClient` transaccional opcional para integrarse con flujos
 * que ya están en una transacción. Si no se pasa, se ejecuta su propia
 * transacción.
 */
export async function clearAssignmentsForRun(options: {
	assignmentRunId: string;
	prismaClient?: PrismaClient | Prisma.TransactionClient;
}): Promise<{
	deletedAssignments: number;
	deletedLotteries: number;
	deletedLogs: number;
}> {
	const { assignmentRunId, prismaClient } = options;
	if (!assignmentRunId)
		throw new Error(
			"assignmentRunId is required to clear previous assignments"
		);

	const runClear = async (db: PrismaClient | Prisma.TransactionClient) => {
		// Use any-cast because generated client may be out of sync until migrations are applied
		const client: any = db as any;

		// Remove logs first (they reference the run)
		const logs = await client.assignment_logs.deleteMany({
			where: { assignment_run_id: assignmentRunId },
		});

		// Remove lotteries (this should cascade-delete lottery_results if DB constraints set; if not, consider deleting results explicitly)
		const lotteries = await client.lotteries.deleteMany({
			where: { assignment_run_id: assignmentRunId },
		});

		// Remove final assignments
		const assignments = await client.assignments.deleteMany({
			where: { assignment_run_id: assignmentRunId },
		});

		return {
			deletedAssignments: assignments.count ?? assignments,
			deletedLotteries: lotteries.count ?? lotteries,
			deletedLogs: logs.count ?? logs,
		};
	};

	if (prismaClient) {
		return await runClear(prismaClient);
	}

	// run its own transaction
	return await prisma.$transaction(async (tx) => {
		return await runClear(tx);
	});
}

/**
 * Borra TODO el historial de asignaciones y logs. Uso peligroso — requiere
 * `confirm=true` para ejecutar. Ejecuta en una transacción.
 */
export async function clearAllAssignments(options?: {
	confirm?: boolean;
	prismaClient?: PrismaClient | Prisma.TransactionClient;
}) {
	if (!options?.confirm)
		throw new Error("clearAllAssignments requires confirm=true to proceed");
	const fn = async (db: PrismaClient | Prisma.TransactionClient) => {
		const client: any = db as any;
		await client.assignment_logs.deleteMany({ where: {} });
		await client.lotteries.deleteMany({ where: {} });
		await client.assignments.deleteMany({ where: {} });
		return { ok: true };
	};

	if (options?.prismaClient) return await fn(options.prismaClient);
	return await prisma.$transaction(async (tx) => fn(tx));
}

const _default = { clearAssignmentsForRun, clearAllAssignments };
export default _default;
