import { pickWinners } from "./shuffle";
import defaultAuditClient, { AuditClient } from "./ports";
import type { PrismaClient, Prisma } from "@prisma/client";

type Candidate = { id: string; email?: string };

/**
 * Ejecuta un sorteo entre candidatos neurodivergentes para un curso específico.
 * Registra el sorteo en la base de datos (usando recordLotteryDecision) y devuelve
 * ganadores y perdedores.
 */
export async function runNeurodivergentLottery(options: {
	assignmentRunId?: string;
	courseId: string;
	courseName: string;
	parallel: number;
	preference: number;
	candidates: Candidate[];
	availableSpots: number;
	requestIp?: string;
	userAgent?: string;
	reason?: string;
	prismaClient?: PrismaClient | Prisma.TransactionClient;
	auditClient?: AuditClient;
}): Promise<{ winners: Candidate[]; losers: Candidate[]; seedUsed?: string }> {
	const {
		assignmentRunId,
		courseId,
		courseName,
		parallel,
		preference,
		candidates,
		availableSpots,
		requestIp,
		userAgent,
		reason,
	} = options;

	if (candidates.length <= availableSpots) {
		// No hay sobrecupo; todos ganan
		const audit = options.auditClient ?? defaultAuditClient;
		await audit.recordLotteryDecision({
			assignmentRunId,
			courseId,
			courseName,
			parallel,
			preference,
			candidates,
			winners: candidates,
			availableSpots,
			seedUsed: undefined,
			swaps: undefined,
			reason: reason ?? "no_sobrecupo",
			requestIp,
			userAgent,
			executionContext: { runner: "runNeurodivergentLottery" },
			client: options.prismaClient,
		});
		return { winners: candidates, losers: [], seedUsed: undefined };
	}

	const seed = `${assignmentRunId ?? "run"}-${courseId}-${Date.now()}`;
	const { winners, losers, seedUsed } = pickWinners(
		candidates,
		availableSpots,
		seed
	);

	const audit = options.auditClient ?? defaultAuditClient;
	await audit.recordLotteryDecision({
		assignmentRunId,
		courseId,
		courseName,
		parallel,
		preference,
		candidates,
		winners: winners.map((w) => ({ id: w.id, email: w.email })),
		availableSpots,
		seedUsed,
		swaps: undefined,
		reason: reason ?? "sobrecupo_neurodivergentes",
		requestIp,
		userAgent,
		executionContext: { runner: "runNeurodivergentLottery" },
		client: options.prismaClient,
	});

	return { winners, losers, seedUsed };
}

// (removed unused _default)
export async function runFourthYearLottery(options: {
	assignmentRunId?: string;
	courseId: string;
	courseName: string;
	parallel: number;
	preference: number;
	candidates: Candidate[];
	availableSpots: number;
	requestIp?: string;
	userAgent?: string;
	reason?: string;
	prismaClient?: PrismaClient | Prisma.TransactionClient;
	auditClient?: AuditClient;
}): Promise<{ winners: Candidate[]; losers: Candidate[]; seedUsed?: string }> {
	const {
		assignmentRunId,
		courseId,
		courseName,
		parallel,
		preference,
		candidates,
		availableSpots,
		requestIp,
		userAgent,
		reason,
	} = options;

	if (candidates.length <= availableSpots) {
		const audit = options.auditClient ?? defaultAuditClient;
		await audit.recordLotteryDecision({
			assignmentRunId,
			courseId,
			courseName,
			parallel,
			preference,
			candidates,
			winners: candidates,
			availableSpots,
			seedUsed: undefined,
			swaps: undefined,
			reason: reason ?? "no_sobrecupo",
			requestIp,
			userAgent,
			executionContext: { runner: "runFourthYearLottery" },
			client: options.prismaClient,
		});
		return { winners: candidates, losers: [], seedUsed: undefined };
	}

	const seed = `${assignmentRunId ?? "run"}-${courseId}-${Date.now()}`;
	const { winners, losers, seedUsed, swaps } = pickWinners(
		candidates,
		availableSpots,
		seed
	);

	const audit = options.auditClient ?? defaultAuditClient;
	await audit.recordLotteryDecision({
		assignmentRunId,
		courseId,
		courseName,
		parallel,
		preference,
		candidates,
		winners: winners.map((w) => ({ id: w.id, email: w.email })),
		availableSpots,
		seedUsed,
		swaps,
		reason: reason ?? "sobrecupo_4to_medio",
		requestIp,
		userAgent,
		executionContext: { runner: "runFourthYearLottery" },
		client: options.prismaClient,
	});

	return { winners, losers, seedUsed };
}

const _both = { runNeurodivergentLottery, runFourthYearLottery };
export default _both;
