import { describe, it, expect } from "vitest";
import { shuffleWithRng, shuffleWithSeed, pickWinners } from "./shuffle";

describe("shuffleWithRng", () => {
	it("produces deterministic result for a constant rng=0", () => {
		const arr = [1, 2, 3];
		const rng = () => 0;
		const { shuffled, swaps } = shuffleWithRng(arr, rng);
		// Manual evaluation:
		// i=2 -> j = floor(0*(2+1)) = 0 -> swap indices 2 and 0 => [3,2,1]
		// i=1 -> j = floor(0*(1+1)) = 0 -> swap indices 1 and 0 => [2,3,1]
		expect(shuffled).toEqual([2, 3, 1]);
		expect(swaps).toHaveLength(2);
		expect(swaps[0]).toEqual({ i: 2, j: 0 });
		expect(swaps[1]).toEqual({ i: 1, j: 0 });
	});
});

describe("shuffleWithSeed", () => {
	it("is reproducible with the same seed", () => {
		const arr = ["a", "b", "c", "d", "e"];
		const seed = "my-test-seed-123";

		const r1 = shuffleWithSeed(arr, seed);
		const r2 = shuffleWithSeed(arr, seed);

		expect(r1.seedUsed).toBe(String(seed));
		expect(r2.seedUsed).toBe(String(seed));
		expect(r1.shuffled).toEqual(r2.shuffled);
		expect(r1.swaps).toEqual(r2.swaps);
	});

	it("produces different order when seed differs", () => {
		const arr = [1, 2, 3, 4, 5, 6, 7];
		const s1 = shuffleWithSeed(arr, "seed-one");
		const s2 = shuffleWithSeed(arr, "seed-two");
		// It's possible (though extremely unlikely) that two different seeds produce the same shuffle.
		// We assert that typically they differ; if coincidentally equal the test still passes if they differ.
		expect(s1.shuffled).not.toEqual(s2.shuffled);
	});
});

describe("pickWinners", () => {
	it("returns empty winners when winnersCount <= 0", () => {
		const arr = [1, 2, 3];
		const res = pickWinners(arr, 0, "s");
		expect(res.winners).toEqual([]);
		expect(res.losers).toEqual(arr);
	});

	it("returns correct number of winners and preserves elements", () => {
		const arr = ["x", "y", "z", "w"];
		const { winners, losers } = pickWinners(arr, 2, "seed-42");
		expect(winners).toHaveLength(2);
		expect(losers).toHaveLength(2);
		// union of winners and losers should be a permutation of original array
		const union = [...winners, ...losers];
		expect(union.sort()).toEqual(arr.slice().sort());
	});
});
