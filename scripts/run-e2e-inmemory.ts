/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * scripts/run-e2e-inmemory.ts
 *
 * Run a full end-to-end assignment simulation in-memory using the existing
 * priority assignment functions and mocked audit logger. Produces a textual
 * report under `docs/` with statistics and a summary of lotteries executed.
 *
 * Run with:
 *   npx ts-node scripts/run-e2e-inmemory.ts
 *
 */

import fs from "fs";
import path from "path";
import {
	assignFirstPreferencesForNeurodivergent,
	assignFirstPreferencesForFourthYearNonNeurodivergent,
	assignFirstPreferencesForThirdYearNonNeurodivergent,
	assignFallbackPreferencesForNeurodivergent,
	assignFallbackPreferencesForFourthYear,
	assignFallbackPreferencesForThirdYear,
	assignRandomBackupFillRemaining,
} from "../src/lib/priority-assignments";

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

async function main() {
	const STUDENT_COUNT = 500; // realistic-ish
	const COURSES_PER_PARALLEL = 6; // 18 courses total

	let lotteryCalls: any[] = [];

	// mock recordLotteryDecision to capture lotteries instead of writing to DB
	const originalRecord = (auditLogger as any).recordLotteryDecision;
	(auditLogger as any).recordLotteryDecision = async (opts: any) => {
		lotteryCalls.push(opts);
		return { lotteryId: `mock-${lotteryCalls.length}` };
	};

	function makeCourses(): CourseCapacity[] {
		const courses: CourseCapacity[] = [];
		let idx = 1;
		for (let parallel = 1; parallel <= 3; parallel++) {
			for (let i = 0; i < COURSES_PER_PARALLEL; i++) {
				const capacity = 8 + (i % 4) * 4; // varied capacities: 8,12,16,20
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
		const byParallel = new Map<number, CourseCapacity[]>();
		for (const c of courses) {
			if (!byParallel.has(c.parallel)) byParallel.set(c.parallel, []);
			byParallel.get(c.parallel)!.push(c);
		}

		for (let i = 0; i < STUDENT_COUNT; i++) {
			const id = `S${i + 1}`;
			const email = `student${i + 1}@school.test`;
			const is_neuro = i % 12 === 0; // ~8% neurodivergent
			const level = i % 2 === 0 ? 4 : 3; // spread between 3 and 4

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

	const courses = makeCourses();
	const students = makeStudents(courses);

	const courseCapMap = new Map<string, CourseCapacity>();
	for (const c of courses) courseCapMap.set(c.courseId, { ...c });

	const studentAssignments = new Map<string, Set<number>>();
	const allAssignments: Array<any> = [];
	const assignmentRunId = `e2e-run-${Date.now()}`;

	// Run phases
	(async () => {
		const neuro = students.filter((s) => s.is_neurodivergent);
		await assignFirstPreferencesForNeurodivergent(
			neuro as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run" }
		);

		await assignFirstPreferencesForFourthYearNonNeurodivergent(
			students as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run" }
		);

		await assignFirstPreferencesForThirdYearNonNeurodivergent(
			students as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run" }
		);

		// recompute needy
		const needing = Array.from(studentAssignments.entries())
			.filter(([, s]) => s.size < 3)
			.map(([id]) => id);
		const needyStudents = students.filter((s) => needing.includes(s.id));

		const needyNeuro = needyStudents.filter((s) => s.is_neurodivergent);
		await assignFallbackPreferencesForNeurodivergent(
			needyNeuro as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run" }
		);

		const needyFourth = needyStudents.filter(
			(s) => s.level === 4 && !s.is_neurodivergent
		);
		await assignFallbackPreferencesForFourthYear(
			needyFourth as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run" }
		);

		const needyThird = needyStudents.filter(
			(s) => s.level === 3 && !s.is_neurodivergent
		);
		await assignFallbackPreferencesForThirdYear(
			needyThird as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run" }
		);

		await assignRandomBackupFillRemaining(
			students as any,
			courseCapMap,
			studentAssignments,
			allAssignments,
			assignmentRunId,
			{ requestIp: "127.0.0.1", userAgent: "e2e-run", seed: "e2e-seed" }
		);

		// Build report from in-memory data
		let totalAssignedCount = 0;
		for (const c of courseCapMap.values()) {
			if (c.assignedCount > c.capacity) {
				console.warn(
					`Course ${c.courseId} exceeded capacity: ${c.assignedCount} > ${c.capacity}`
				);
			}
			totalAssignedCount += c.assignedCount;
		}

		const neuroAssigned = allAssignments.filter((a) => {
			const s = students.find((x) => x.id === a.student_id);
			return s?.is_neurodivergent;
		}).length;
		const fourthAssigned = allAssignments.filter((a) => {
			const s = students.find((x) => x.id === a.student_id);
			return s && s.level === 4 && !s.is_neurodivergent;
		}).length;
		const thirdAssigned = allAssignments.filter((a) => {
			const s = students.find((x) => x.id === a.student_id);
			return s && s.level === 3 && !s.is_neurodivergent;
		}).length;

		const winners = lotteryCalls.reduce(
			(acc, l) => acc + (l.winners?.length ?? 0),
			0
		);
		const losers = lotteryCalls.reduce(
			(acc, l) =>
				acc + ((l.candidates?.length ?? 0) - (l.winners?.length ?? 0)),
			0
		);

		const lines: string[] = [];
		lines.push(`E2E in-memory assignment report — run ${assignmentRunId}`);
		lines.push("----------------------------------------------------");
		lines.push(`Students simulated: ${students.length}`);
		lines.push(`Courses simulated: ${courses.length}`);
		lines.push(`Total assignments created: ${totalAssignedCount}`);
		lines.push("Assignments by group:");
		lines.push(`- Neurodivergent: ${neuroAssigned}`);
		lines.push(`- 4th year (non-neurodiv): ${fourthAssigned}`);
		lines.push(`- 3rd year (non-neurodiv): ${thirdAssigned}`);
		lines.push("");
		lines.push(`Lotteries executed: ${lotteryCalls.length}`);
		lines.push(`Winners recorded across all lotteries: ${winners}`);
		lines.push(`Approx losers across all lotteries: ${losers}`);
		lines.push("");
		lines.push("Sample lottery details (first 10):");
		for (let i = 0; i < Math.min(10, lotteryCalls.length); i++) {
			const l = lotteryCalls[i];
			lines.push(
				`- ${i + 1}) course=${l.courseId} pref=${l.preference} available=${
					l.availableSpots
				} candidates=${l.candidates?.length ?? 0} winners=${
					l.winners?.length ?? 0
				} seed=${l.seedUsed}`
			);
		}
		lines.push("----------------------------------------------------");

		const outDir = path.join(process.cwd(), "docs");
		if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
		const outPath = path.join(outDir, `E2E_REPORT_${Date.now()}.txt`);
		fs.writeFileSync(outPath, lines.join("\n"), "utf8");

		console.log("E2E in-memory run complete. Report written to:", outPath);
		console.log(lines.join("\n"));

		// restore original logger
		(auditLogger as any).recordLotteryDecision = originalRecord;
	})();
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error("E2E runner failed:", e);
	process.exit(1);
});
