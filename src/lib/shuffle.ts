/**
 * Fisher-Yates shuffle utilities with optional seeded RNG for reproducibility
 * and audit logging (swap history).
 *
 * Provides:
 *  - shuffleWithRng(array, rng) => { shuffled, swaps }
 *  - shuffleWithSeed(array, seed?) => { shuffled, swaps, seedUsed }
 *  - pickWinners(array, count, seed?) => { winners, losers, seedUsed, swaps }
 */

// Small deterministic RNG helpers (xmur3 + mulberry32) for reproducible shuffles
function xmur3(str: string): () => number {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return function () {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return (h ^= h >>> 16) >>> 0;
	};
}

function mulberry32(a: number): () => number {
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Shuffle using provided RNG function (returns number in [0,1)).
 * Records swap operations for auditing.
 */
export function shuffleWithRng<T>(array: T[], rng: () => number) {
	const shuffled = [...array];
	const swaps: Array<{ i: number; j: number }> = [];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		if (i !== j) {
			swaps.push({ i, j });
		}
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return { shuffled, swaps };
}

/**
 * Shuffle using a string or numeric seed. If no seed provided, a random seed is generated.
 * Returns the shuffled array, the seed used (string), and the swaps log for audit.
 */
export function shuffleWithSeed<T>(array: T[], seed?: string | number) {
	// Normalize seed to string
	const seedStr =
		seed === undefined
			? String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
			: String(seed);
	const seedInt = xmur3(seedStr)();
	const rng = mulberry32(seedInt);

	const { shuffled, swaps } = shuffleWithRng(array, rng);
	return { shuffled, swaps, seedUsed: seedStr };
}

/**
 * Pick winnersCount items from array using Fisher-Yates with optional seed.
 * Returns winners (preserving the random order), losers, seedUsed and swaps log.
 */
export function pickWinners<T>(
	array: T[],
	winnersCount: number,
	seed?: string | number
) {
	if (winnersCount <= 0)
		return {
			winners: [],
			losers: [...array],
			seedUsed: String(seed ?? ""),
			swaps: [],
		};
	const { shuffled, swaps, seedUsed } = shuffleWithSeed(array, seed);
	const winners = shuffled.slice(0, winnersCount);
	const losers = shuffled.slice(winnersCount);
	return { winners, losers, seedUsed, swaps };
}

const _default = { shuffleWithRng, shuffleWithSeed, pickWinners };
export default _default;
