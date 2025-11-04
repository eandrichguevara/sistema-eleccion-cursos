/* Lightweight ports/adapters for dependency injection to improve testability */
import * as auditLogger from "./audit-logger";
import type { PrismaClient, Prisma } from "@prisma/client";

export type PrismaLike = PrismaClient | Prisma.TransactionClient | any;

export type LotteryDecisionOptions = Parameters<
	typeof auditLogger.recordLotteryDecision
>[0];

export interface AuditClient {
	recordLotteryDecision(opts: LotteryDecisionOptions): Promise<any>;
	recordAssignmentConflicts?(opts: any): Promise<any>;
}

export const defaultAuditClient: AuditClient = {
	recordLotteryDecision: (opts: LotteryDecisionOptions) =>
		auditLogger.recordLotteryDecision(opts),
	recordAssignmentConflicts: (opts: any) =>
		(auditLogger as any).recordAssignmentConflicts?.(opts),
};

export default defaultAuditClient;
