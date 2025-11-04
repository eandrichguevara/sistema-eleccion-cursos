/**
 * Helpers para organizar las selecciones de un estudiante por paralelo y preferencia
 *
 * Entrada esperada: array de objetos `selection` con al menos:
 *  - course_id
 *  - preference_order (number)
 *  - courses: { id, name, parallel }
 *
 */

export type SelectionWithCourse = {
	id: string;
	course_id: string;
	preference_order: number;
	courses: { id: string; name: string; parallel: number; capacity?: number };
};

export type PreferencesByParallel = Record<
	number,
	{
		1?: SelectionWithCourse[];
		2?: SelectionWithCourse[];
		3?: SelectionWithCourse[];
		4?: SelectionWithCourse[];
		none?: SelectionWithCourse[]; // selecciones sin preference_order explícito
	}
>;

/**
 * Organiza un array de selecciones por paralelo y por orden de preferencia.
 * Devuelve un objeto cuya clave es el número de paralelo y el valor es un mapa
 * de preferencia (1..4 y "none").
 */
export function getPreferencesByParallel(
	selections: SelectionWithCourse[]
): PreferencesByParallel {
	const result: PreferencesByParallel = {};

	for (const s of selections) {
		const parallel = s.courses?.parallel ?? 0; // 0 significa paralelo desconocido
		if (!result[parallel]) result[parallel] = {};

		const pref =
			typeof s.preference_order === "number" ? s.preference_order : "none";

		if (pref === "none") {
			result[parallel].none = result[parallel].none ?? [];
			result[parallel].none!.push(s);
		} else if (pref >= 1 && pref <= 4) {
			const key = pref as 1 | 2 | 3 | 4;
			result[parallel][key] = result[parallel][key] ?? [];
			result[parallel][key]!.push(s);
		} else {
			// cualquier otro valor lo tratamos como 'none'
			result[parallel].none = result[parallel].none ?? [];
			result[parallel].none!.push(s);
		}
	}

	return result;
}

/**
 * Obtiene las listas de selecciones para un paralelo dado en orden de preferencia
 * (1,2,3,4, none). Devuelve un array de arrays (vacíos permitidos).
 */
export function getOrderedPreferencesForParallel(
	selections: SelectionWithCourse[],
	parallel: number
): SelectionWithCourse[][] {
	const byParallel = getPreferencesByParallel(selections);
	const p = byParallel[parallel] ?? {};
	return [p[1] ?? [], p[2] ?? [], p[3] ?? [], p[4] ?? [], p.none ?? []];
}

const _default = {
	getPreferencesByParallel,
	getOrderedPreferencesForParallel,
};

export default _default;
