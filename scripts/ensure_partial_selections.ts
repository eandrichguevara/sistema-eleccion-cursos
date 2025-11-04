import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function shuffle<T>(arr: T[]) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

async function main() {
	console.log("🔧 Ajustando selecciones de estudiantes...");

	const students = await prisma.students.findMany({
		where: { role: "student" },
		select: { id: true },
	});
	const studentIds = students.map((s) => s.id);
	shuffle(studentIds);

	const noSelectionCount = Math.max(8, Math.floor(studentIds.length * 0.07)); // ~7%
	const partialCount = Math.max(15, Math.floor(studentIds.length * 0.15)); // ~15%

	const noSelectionIds = studentIds.slice(0, noSelectionCount);
	const partialIds = studentIds.slice(
		noSelectionCount,
		noSelectionCount + partialCount
	);

	console.log(
		`  • Pondré sin selecciones a ${noSelectionIds.length} estudiantes`
	);
	console.log(`  • Pondré parciales (1-2) a ${partialIds.length} estudiantes`);

	// Eliminar todas las selecciones para el primer grupo
	await prisma.selections.deleteMany({
		where: { student_id: { in: noSelectionIds } },
	});

	// Para el grupo parcial, asegurar que tengan 1 o 2 selecciones
	for (const sid of partialIds) {
		const sels = await prisma.selections.findMany({
			where: { student_id: sid },
		});
		if (sels.length === 0) {
			// crear 1 selección aleatoria
			// elegir un curso aleatorio
			const course = await prisma.courses.findFirst();
			if (course) {
				await prisma.selections.create({
					data: { student_id: sid, course_id: course.id, preference_order: 1 },
				});
			}
		} else if (sels.length > 2) {
			// eliminar hasta dejar 2 (eliminar aleatoriamente)
			shuffle(sels);
			const toDelete = sels.slice(2);
			for (const d of toDelete) {
				await prisma.selections.delete({ where: { id: d.id } });
			}
		}
		// si tienen 1 o 2, dejar tal cual
	}

	// Calcular conteos finales
	const counts = await prisma.$queryRaw`
    SELECT cnt, COUNT(*)::bigint as group_count FROM (
      SELECT s.id, COUNT(sel.*) as cnt
      FROM students s
      LEFT JOIN selections sel ON sel.student_id = s.id
      WHERE s.role = 'student'
      GROUP BY s.id
    ) t GROUP BY cnt ORDER BY cnt
  `;

	console.log("📊 Conteos por número de selecciones:");
	// counts is an array of rows with cnt and group_count
	// print nicely
	for (const row of counts as any) {
		console.log(`   • ${row.cnt} selecciones: ${Number(row.group_count)}`);
	}

	await prisma.$disconnect();
	console.log("✅ Ajuste completado.");
}

main().catch(async (e) => {
	console.error("Error en script:", e);
	await prisma.$disconnect();
	process.exit(1);
});
