/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect } from "vitest";
import {
	validateStudentAssignmentsMap,
	getStudentsWithLessThanThreeFromMap,
	validateAssignmentsInDB,
	validateFinalAssignmentsIntegrity,
} from "./assignment-validators";

describe("validateStudentAssignmentsMap", () => {
	it("computes assigned and missing parallels", () => {
		const m = new Map<string, Set<number>>();
		m.set("a", new Set([1, 2, 3]));
		m.set("b", new Set([1]));
		m.set("c", new Set());

		const res = validateStudentAssignmentsMap(m);
		const byId = Object.fromEntries(res.map((r) => [r.studentId, r]));

		expect(byId["a"].assignedParallels).toEqual([1, 2, 3]);
		expect(byId["a"].missingParallels).toEqual([]);

		expect(byId["b"].assignedParallels).toEqual([1]);
		expect(byId["b"].missingParallels).toEqual([2, 3]);

		expect(byId["c"].assignedParallels).toEqual([]);
		expect(byId["c"].missingParallels).toEqual([1, 2, 3]);
	});
});

describe("getStudentsWithLessThanThreeFromMap", () => {
	it("returns students with < 3 assigned", () => {
		const m = new Map<string, Set<number>>();
		m.set("a", new Set([1, 2, 3]));
		m.set("b", new Set([1]));
		m.set("c", new Set());

		const short = getStudentsWithLessThanThreeFromMap(m);
		const ids = short.map((s) => s.studentId).sort();
		expect(ids).toEqual(["b", "c"]);
		const b = short.find((s) => s.studentId === "b")!;
		expect(b.assignedCount).toBe(1);
		expect(b.missingParallels).toEqual([2, 3]);
	});
});

// For DB-backed validators we provide a minimal mock prismaClient implementing
// assignments.findMany and students.findMany used by the functions.
function makeMockClient({
	assignments,
	students,
}: {
	assignments: any[];
	students: any[];
}) {
	return {
		assignments: {
			findMany: async (_opts?: any) => assignments,
		},
		students: {
			findMany: async (_opts?: any) => students,
		},
	};
}

describe("validateAssignmentsInDB (mocked)", () => {
	it("detects students with missing parallels and returns email", async () => {
		const mockAssignments = [
			// student s1 has only parallel 1
			{
				student_id: "s1",
				course_id: "c1",
				courses: { id: "c1", name: "C1", parallel: 1 },
				students: { email: "s1@example" },
			},
			// student s2 has parallels 1 and 2
			{
				student_id: "s2",
				course_id: "c2",
				courses: { id: "c2", name: "C2", parallel: 1 },
				students: { email: "s2@example" },
			},
			{
				student_id: "s2",
				course_id: "c3",
				courses: { id: "c3", name: "C3", parallel: 2 },
				students: { email: "s2@example" },
			},
			// student s3 has duplicates same course twice
			{
				student_id: "s3",
				course_id: "c4",
				courses: { id: "c4", name: "C4", parallel: 1 },
				students: { email: "s3@example" },
			},
			{
				student_id: "s3",
				course_id: "c4",
				courses: { id: "c4", name: "C4", parallel: 1 },
				students: { email: "s3@example" },
			},
			// student s4 has two assignments in same parallel different courses
			{
				student_id: "s4",
				course_id: "c5",
				courses: { id: "c5", name: "C5", parallel: 1 },
				students: { email: "s4@example" },
			},
			{
				student_id: "s4",
				course_id: "c6",
				courses: { id: "c6", name: "C6", parallel: 1 },
				students: { email: "s4@example" },
			},
			// student s5 has full assignments 1,2,3
			{
				student_id: "s5",
				course_id: "c7",
				courses: { id: "c7", name: "C7", parallel: 1 },
				students: { email: "s5@example" },
			},
			{
				student_id: "s5",
				course_id: "c8",
				courses: { id: "c8", name: "C8", parallel: 2 },
				students: { email: "s5@example" },
			},
			{
				student_id: "s5",
				course_id: "c9",
				courses: { id: "c9", name: "C9", parallel: 3 },
				students: { email: "s5@example" },
			},
		];

		const mockStudents = [
			{ id: "s1", email: "s1@example" },
			{ id: "s2", email: "s2@example" },
			{ id: "s3", email: "s3@example" },
			{ id: "s4", email: "s4@example" },
			{ id: "s5", email: "s5@example" },
			{ id: "s6", email: "s6@example" }, // student with no assignments
		];

		const client = makeMockClient({
			assignments: mockAssignments,
			students: mockStudents,
		});

		const res = await validateAssignmentsInDB(client as any);
		// should include s1 (missing 2,3), s2 (missing 3), s3 (duplicates and missing 2,3), s4 (multiple in parallel and missing 2,3), s6 (no assignments)
		const ids = res.map((r) => r.studentId).sort();
		expect(ids).toEqual(["s1", "s2", "s3", "s4", "s6"]);

		// s3 and s4 should be present because they miss parallels; details about duplicates/multiple are
		// validated in the final integrity test below.
	});
});

describe("validateFinalAssignmentsIntegrity (mocked)", () => {
	it("reports detailed integrity issues", async () => {
		// reuse the same mock setup as above
		const mockAssignments = [
			{
				student_id: "sA",
				course_id: "c1",
				courses: { id: "c1", name: "C1", parallel: 1 },
				students: { email: "a@example" },
			},
			{
				student_id: "sA",
				course_id: "c2",
				courses: { id: "c2", name: "C2", parallel: 2 },
				students: { email: "a@example" },
			},
			// missing parallel 3

			{
				student_id: "sB",
				course_id: "c3",
				courses: { id: "c3", name: "C3", parallel: 1 },
				students: { email: "b@example" },
			},
			{
				student_id: "sB",
				course_id: "c3",
				courses: { id: "c3", name: "C3", parallel: 1 },
				students: { email: "b@example" },
			},

			{
				student_id: "sC",
				course_id: "c4",
				courses: { id: "c4", name: "C4", parallel: 1 },
				students: { email: "c@example" },
			},
			{
				student_id: "sC",
				course_id: "c5",
				courses: { id: "c5", name: "C5", parallel: 1 },
				students: { email: "c@example" },
			},
			{
				student_id: "sC",
				course_id: "c6",
				courses: { id: "c6", name: "C6", parallel: 3 },
				students: { email: "c@example" },
			},
		];
		const mockStudents = [
			{ id: "sA", email: "a@example" },
			{ id: "sB", email: "b@example" },
			{ id: "sC", email: "c@example" },
			{ id: "sD", email: "d@example" },
		];

		const client = makeMockClient({
			assignments: mockAssignments,
			students: mockStudents,
		});

		const probs = await validateFinalAssignmentsIntegrity(client as any);
		const ids = probs.map((p) => p.studentId).sort();
		// sA missing 3, sB duplicates, sC multiple in parallel
		expect(ids).toEqual(["sA", "sB", "sC"]);

		const pa = probs.find((p) => p.studentId === "sA")!;
		expect(pa.missingParallels).toContain(3);

		const pb = probs.find((p) => p.studentId === "sB")!;
		expect(pb.duplicates.length).toBeGreaterThan(0);

		const pc = probs.find((p) => p.studentId === "sC")!;
		expect(pc.multipleInParallel.length).toBeGreaterThan(0);
	});
});
