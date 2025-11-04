import { describe, it, expect } from "vitest";
import { getPriorityGroup, groupStudentsByPriority } from "./priority-groups";
import { PriorityGroup } from "../types/assignment";

describe("getPriorityGroup", () => {
	it("returns NEURODIVERGENT when is_neurodivergent true", () => {
		const g = getPriorityGroup({ is_neurodivergent: true, level: 3 });
		expect(g).toBe(PriorityGroup.NEURODIVERGENT);
	});

	it("returns FOURTH_YEAR for level 4 when not neurodivergent", () => {
		const g = getPriorityGroup({ is_neurodivergent: false, level: 4 });
		expect(g).toBe(PriorityGroup.FOURTH_YEAR);
	});

	it("returns THIRD_YEAR for other levels when not neurodivergent", () => {
		const g = getPriorityGroup({ is_neurodivergent: false, level: 3 });
		expect(g).toBe(PriorityGroup.THIRD_YEAR);
	});

	it("defaults to THIRD_YEAR when fields missing", () => {
		const g = getPriorityGroup({});
		expect(g).toBe(PriorityGroup.THIRD_YEAR);
	});
});

describe("groupStudentsByPriority", () => {
	it("groups students into correct priority buckets", () => {
		const students = [
			{ id: "s1", is_neurodivergent: true, level: 3 },
			{ id: "s2", is_neurodivergent: false, level: 4 },
			{ id: "s3", is_neurodivergent: false, level: 3 },
			{ id: "s4", is_neurodivergent: true, level: 4 },
		];

		const groups = groupStudentsByPriority(students);
		expect(
			groups[PriorityGroup.NEURODIVERGENT].map((s) => s.id).sort()
		).toEqual(["s1", "s4"]);
		expect(groups[PriorityGroup.FOURTH_YEAR].map((s) => s.id)).toEqual(["s2"]);
		expect(groups[PriorityGroup.THIRD_YEAR].map((s) => s.id)).toEqual(["s3"]);
	});
});
