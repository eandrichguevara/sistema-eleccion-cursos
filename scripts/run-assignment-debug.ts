#!/usr/bin/env tsx

/**
 * Debug runner for the assignment algorithm.
 *
 * Usage:
 *   npx tsx scripts/run-assignment-debug.ts --seed my-seed --students 100 --courses-per-parallel 4
 *
 * This script runs the in-memory assignment flow (no DB writes) and prints
 * all lottery decisions (seed and swaps) so you can reproduce them later.
 */

import * as priorityAssignments from "../src/lib/priority-assignments";
import * as auditLogger from "../src/lib/audit-logger";
import { shuffleWithSeed } from "../src/lib/shuffle";

type Student = {
	id: string;
	email: string;
	is_neurodivergent?: boolean;
	level?: number;
	selections?: Array<{
		course_id: string;
		preference_order: number;
		courses: { id: string; name: string; parallel: number };
	}>;
};

type CourseCapacity = {
	courseId: string;
	courseName: string;
	parallel: number;
	capacity: number;
	assignedCount: number;
};

function parseArgs() {
	const args = process.argv.slice(2);
	const out: Record<string, string> = {};
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a.startsWith("--")) {
			const key = a.slice(2);
			const val =
				args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
			out[key] = val;
		}
	}
	return out;
}

function makeCourses(cpp: number): CourseCapacity[] {
	const courses: CourseCapacity[] = [];
	let idx = 1;
	for (let parallel = 1; parallel <= 3; parallel++) {
		for (let i = 0; i < cpp; i++) {
			const capacity = [6, 8, 10, 12][i % 4];
			courses.push({
				courseId: `C${idx}`,
				courseName: `Course ${idx}`,
				parallel,
				capacity,
				assignedCount: 0,
			});
			idx++;
		}
	}
	return courses;
}

function makeStudents(count: number, courses: CourseCapacity[]): Student[] {
	const students: Student[] = [];
	const byParallel = new Map<number, CourseCapacity[]>();
	for (const c of courses) {
		if (!byParallel.has(c.parallel)) byParallel.set(c.parallel, []);
		byParallel.get(c.parallel)!.push(c);
	}

	for (let i = 0; i < count; i++) {
		const id = `S${i + 1}`;
		const email = `student${i + 1}@school.test`;
		const is_neuro = i % 10 === 0;
		const level = (i % 3) + 3;

		const selections: Student["selections"] = [];
		for (const parallel of [1, 2, 3]) {
			const pool = byParallel.get(parallel)!;
			const seed = `student-${id}-parallel-${parallel}`;
			const { shuffled } = shuffleWithSeed(pool.slice(), seed);
			for (let pref = 1; pref <= 3; pref++) {
				const course = shuffled[(pref - 1) % shuffled.length];
				selections.push({
					course_id: course.courseId,
					preference_order: pref,
					courses: { id: course.courseId, name: course.courseName, parallel },
				});
			}
		}

		students.push({
			id,
			email,
			is_neurodivergent: is_neuro,
			level,
			selections,
		});
	}

	return students;
}

async function main() {
	const args = parseArgs();
	const seed = args.seed ?? "debug-seed";
	const studentsCount = Number(args.students ?? "100");
	const coursesPerParallel = Number(
		args["courses-per-parallel"] ?? args["courses_per_parallel"] ?? "4"
	);

	// Bind Date.now to a value derived from seed so Date.now()-based seeds are stable
	const stableNow = (() => {
		let h = 2166136261;
		for (let i = 0; i < seed.length; i++) {
			h ^= seed.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return 1600000000000 + ((h >>> 0) % 1000000000);
	})();
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	Date.now = () => stableNow;

	console.log(
		`Running debug assignment with seed='${seed}', students=${studentsCount}, coursesPerParallel=${coursesPerParallel}`
	);

	const courses = makeCourses(coursesPerParallel);
	const students = makeStudents(studentsCount, courses);

	// collect lottery calls
	const lotteries: any[] = [];

	// Replace audit logger with an in-memory collector to avoid DB writes
	// We attempt to override the exported function; priority-assignments uses the live binding
	// so this replacement should be picked up.
	(auditLogger as any).recordLotteryDecision = async (opts: any) => {
		lotteries.push(opts);
		return { lotteryId: `debug-${lotteries.length}` };
	};

	if ((auditLogger as any).recordAssignmentConflicts) {
		(auditLogger as any).recordAssignmentConflicts = async () => {};
	}

	// Run the same flow as the runner but in memory
	const courseCapMap = new Map<string, CourseCapacity>();
	for (const c of courses) courseCapMap.set(c.courseId, { ...c });

	const studentAssignments = new Map<string, Set<number>>();
	const allAssignments: Array<any> = [];
	const assignmentRunId = `debug-${seed}`;

	console.log("\n-- Phase: neurodivergent first preferences --");
	await priorityAssignments.assignFirstPreferencesForNeurodivergent(
		students.filter((s) => s.is_neurodivergent) as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "debug-run", prismaClient: undefined }
	);

	console.log("-- Phase: 4th year first preferences --");
	await priorityAssignments.assignFirstPreferencesForFourthYearNonNeurodivergent(
		students as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "debug-run", prismaClient: undefined }
	);

	console.log("-- Phase: 3rd year first preferences --");
	await priorityAssignments.assignFirstPreferencesForThirdYearNonNeurodivergent(
		students as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "debug-run", prismaClient: undefined }
	);

	// compute needy
	const needing = Array.from(studentAssignments.entries())
		.filter(([, s]) => s.size < 3)
		.map(([id]) => id);
	const needyStudents = students.filter((s) => needing.includes(s.id));

	console.log("-- Phase: fallbacks & backup --");
	await priorityAssignments.assignFallbackPreferencesForNeurodivergent(
		needyStudents.filter((s) => s.is_neurodivergent) as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "debug-run", prismaClient: undefined }
	);

	await priorityAssignments.assignFallbackPreferencesForFourthYear(
		needyStudents.filter((s) => s.level === 4 && !s.is_neurodivergent) as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "debug-run", prismaClient: undefined }
	);

	await priorityAssignments.assignFallbackPreferencesForThirdYear(
		needyStudents.filter((s) => s.level === 3 && !s.is_neurodivergent) as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "debug-run", prismaClient: undefined }
	);

	await priorityAssignments.assignRandomBackupFillRemaining(
		students as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{
			requestIp: "127.0.0.1",
			userAgent: "debug-run",
			prismaClient: undefined,
			seed,
		}
	);

	// summary
	console.log(`\n-- Debug run summary (seed=${seed}) --`);
	console.log(`Total assignments recorded: ${allAssignments.length}`);
	console.log(`Total lotteries executed: ${lotteries.length}`);

	// Print each lottery with seed and swaps so it can be reproduced
	lotteries.forEach((l, idx) => {
		console.log(
			`\nLottery #${idx + 1}: course=${l.courseId} parallel=${
				l.parallel
			} preference=${l.preference}`
		);
		console.log(`  seedUsed: ${l.seedUsed ?? l.seed ?? "(unknown)"}`);
		if (l.swaps) console.log(`  swaps: ${JSON.stringify(l.swaps)}`);
		if (l.candidates)
			console.log(
				`  candidates: ${l.candidates
					.map((c: any) => c.id ?? c)
					.slice(0, 10)
					.join(", ")}${l.candidates.length > 10 ? "..." : ""}`
			);
		if (l.winners)
			console.log(
				`  winners: ${l.winners.map((w: any) => w.id ?? w).join(", ")}`
			);
	});

	console.log(`\nDump a reproducible command:`);
	console.log(
		`  npx tsx scripts/run-assignment-debug.ts --seed ${seed} --students ${studentsCount} --courses-per-parallel ${coursesPerParallel}`
	);
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error(err);
	process.exit(1);
});
