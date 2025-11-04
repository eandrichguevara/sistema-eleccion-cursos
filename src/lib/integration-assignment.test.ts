import { test, expect, beforeAll, vi } from "vitest";

import {
	assignFirstPreferencesForNeurodivergent,
	assignFirstPreferencesForFourthYearNonNeurodivergent,
	assignFirstPreferencesForThirdYearNonNeurodivergent,
	assignFallbackPreferencesForNeurodivergent,
	assignFallbackPreferencesForFourthYear,
	assignFallbackPreferencesForThirdYear,
	assignRandomBackupFillRemaining,
} from "./priority-assignments";

import * as auditLogger from "./audit-logger";
import { shuffleWithSeed } from "./shuffle";

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

// Integration-style test using mocked audit logger (no DB access).
// Builds 100 students, 12 courses (4 per parallel) with varying capacities to force
// multiple lotteries and backup allocation.

const STUDENT_COUNT = 100;
const COURSES_PER_PARALLEL = 4; // 4 * 3 = 12 courses

let lotteryCalls: any[] = [];

beforeAll(() => {
	// Freeze Date.now so seed derivation is deterministic
	vi.spyOn(Date, "now").mockReturnValue(1700000000000);

	// Mock recordLotteryDecision to avoid DB writes and collect calls for assertions
	vi.spyOn(auditLogger, "recordLotteryDecision").mockImplementation(
		async (opts: any) => {
			lotteryCalls.push(opts);
			return { lotteryId: `mock-${lotteryCalls.length}` };
		}
	);

	// Also mock recordAssignmentConflicts if present (safe-guard)
	if ((auditLogger as any).recordAssignmentConflicts) {
		vi.spyOn(
			auditLogger as any,
			"recordAssignmentConflicts"
		).mockImplementation(async () => {});
	}
});

function makeCourses(): CourseCapacity[] {
	const courses: CourseCapacity[] = [];
	let idx = 1;
	for (let parallel = 1; parallel <= 3; parallel++) {
		for (let i = 0; i < COURSES_PER_PARALLEL; i++) {
			const capacity = [6, 8, 10, 12][i % 4]; // variation to create over/under subscription
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

function makeStudents(courses: CourseCapacity[]): Student[] {
	const students: Student[] = [];

	// group courses by parallel for preference generation
	const byParallel = new Map<number, CourseCapacity[]>();
	for (const c of courses) {
		if (!byParallel.has(c.parallel)) byParallel.set(c.parallel, []);
		byParallel.get(c.parallel)!.push(c);
	}

	for (let i = 0; i < STUDENT_COUNT; i++) {
		const id = `S${i + 1}`;
		const email = `student${i + 1}@school.test`;
		const is_neuro = i % 10 === 0; // ~10% neurodivergent
		const level = (i % 3) + 3; // 3 or 4 mostly (3,4,3,4,...). We keep values 3 and 4.

		const selections: Student["selections"] = [];

		for (const parallel of [1, 2, 3]) {
			const pool = byParallel.get(parallel)!;
			// make a reproducible permutation per student+parallel using shuffleWithSeed
			const seed = `student-${id}-parallel-${parallel}`;
			const { shuffled } = shuffleWithSeed(pool.slice(), seed);

			// pick top 3 unique course choices from this parallel, assign preference_order 1..3
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

test("integration: full algorithm flow (in-memory, 100 students, 12 courses)", async () => {
	const courses = makeCourses();
	const students = makeStudents(courses);

	// convert into the format used by priority-assignments (CourseCapacity[])
	const courseCapMap = new Map<string, CourseCapacity>();
	for (const c of courses) courseCapMap.set(c.courseId, { ...c });

	const studentAssignments = new Map<string, Set<number>>();
	const allAssignments: Array<any> = [];
	const assignmentRunId = "integration-run-1";

	// 1) neurodivergent first preferences
	const neuro = students.filter((s) => s.is_neurodivergent);
	const res1 = await assignFirstPreferencesForNeurodivergent(
		neuro as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "vitest", prismaClient: undefined }
	);

	// 2) 4th year non-neurodivergent first preferences
	const res2 = await assignFirstPreferencesForFourthYearNonNeurodivergent(
		students as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "vitest", prismaClient: undefined }
	);

	// 3) 3rd year non-neurodivergent first preferences
	const res3 = await assignFirstPreferencesForThirdYearNonNeurodivergent(
		students as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "vitest", prismaClient: undefined }
	);

	// compute who still needs assignments
	const needing = Array.from(studentAssignments.entries())
		.filter(([, s]) => s.size < 3)
		.map(([studentId]) => studentId);

	const needyStudents = students.filter((s) => needing.includes(s.id));

	// 4) fallback neurodivergent
	const needyNeuro = needyStudents.filter((s) => s.is_neurodivergent);
	await assignFallbackPreferencesForNeurodivergent(
		needyNeuro as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "vitest", prismaClient: undefined }
	);

	// 5) fallback 4th year
	const needyFourth = needyStudents.filter(
		(s) => s.level === 4 && !s.is_neurodivergent
	);
	await assignFallbackPreferencesForFourthYear(
		needyFourth as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "vitest", prismaClient: undefined }
	);

	// 6) fallback 3rd year
	const needyThird = needyStudents.filter(
		(s) => s.level === 3 && !s.is_neurodivergent
	);
	await assignFallbackPreferencesForThirdYear(
		needyThird as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{ requestIp: "127.0.0.1", userAgent: "vitest", prismaClient: undefined }
	);

	// 7) backup fill remaining randomly
	await assignRandomBackupFillRemaining(
		students as any,
		courseCapMap,
		studentAssignments,
		allAssignments,
		assignmentRunId,
		{
			requestIp: "127.0.0.1",
			userAgent: "vitest",
			prismaClient: undefined,
			seed: "integration-seed",
		}
	);

	// Basic in-memory validations
	// - No course exceeded its capacity
	let totalAssignedCount = 0;
	for (const c of courseCapMap.values()) {
		expect(c.assignedCount).toBeLessThanOrEqual(c.capacity);
		totalAssignedCount += c.assignedCount;
	}

	// - Sum of course assigned counts equals number of recorded assignments
	expect(totalAssignedCount).toBe(allAssignments.length);

	// - No student has more than one assignment per parallel
	// Build a map student -> map(parallel->count)
	const studentParallelCounts = new Map<string, Map<number, number>>();
	for (const asg of allAssignments) {
		// preference_order may be 0 for backup; need the parallel from the course map
		const course = courses.find((c) => c.courseId === asg.course_id) as
			| CourseCapacity
			| undefined;
		const parallel = course ? course.parallel : undefined;
		if (!parallel) continue;
		if (!studentParallelCounts.has(asg.student_id))
			studentParallelCounts.set(asg.student_id, new Map());
		const m = studentParallelCounts.get(asg.student_id)!;
		m.set(parallel, (m.get(parallel) ?? 0) + 1);
	}

	for (const [studentId, map] of studentParallelCounts.entries()) {
		for (const [, count] of map.entries()) {
			expect(count).toBeLessThanOrEqual(1);
		}
	}

	// Print summary (test will surface failures). Also assert that at least one lottery was executed.
	// eslint-disable-next-line no-console
	console.log(
		"integration test summary: totalAssigned=",
		totalAssignedCount,
		"lotteriesExecuted=",
		lotteryCalls.length
	);
	expect(lotteryCalls.length).toBeGreaterThan(0);
});
