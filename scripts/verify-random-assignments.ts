import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	console.log(
		"🔍 Verificando asignaciones de estudiantes sin selecciones...\n"
	);

	// Obtener estudiantes sin selecciones
	const studentsNoSelections = await prisma.students.findMany({
		where: {
			role: "student",
			NOT: {
				selections: { some: {} },
			},
		},
		select: {
			id: true,
			email: true,
			level: true,
			is_neurodivergent: true,
		},
	});

	console.log(
		`📊 Total de estudiantes sin selecciones: ${studentsNoSelections.length}\n`
	);

	if (studentsNoSelections.length === 0) {
		console.log("✅ No hay estudiantes sin selecciones");
		await prisma.$disconnect();
		return;
	}

	// Verificar asignaciones de cada uno
	for (const student of studentsNoSelections) {
		const assignments = await prisma.assignments.findMany({
			where: { student_id: student.id },
			include: {
				courses: {
					select: {
						name: true,
						parallel: true,
					},
				},
			},
			orderBy: {
				preference_order: "asc",
			},
		});

		console.log(
			`👤 ${student.email} (Nivel ${student.level}, ${
				student.is_neurodivergent ? "neurodivergente" : "regular"
			})`
		);

		if (assignments.length === 0) {
			console.log("   ❌ SIN ASIGNACIONES\n");
		} else {
			console.log(`   ✅ ${assignments.length} asignaciones:`);
			assignments.forEach((a) => {
				const prefLabel =
					a.preference_order === 0
						? "🎲 ALEATORIO"
						: `Pref ${a.preference_order}`;
				console.log(
					`      ${prefLabel} - ${a.courses.name} (${a.courses.parallel})`
				);
			});
			console.log("");
		}
	}

	// Resumen
	const withAssignments = await prisma.students.count({
		where: {
			role: "student",
			NOT: {
				selections: { some: {} },
			},
			assignments: { some: {} },
		},
	});

	const withoutAssignments = studentsNoSelections.length - withAssignments;

	console.log("\n📈 RESUMEN:");
	console.log(
		`   ✅ Estudiantes sin selecciones CON asignaciones: ${withAssignments}`
	);
	console.log(
		`   ❌ Estudiantes sin selecciones SIN asignaciones: ${withoutAssignments}`
	);

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error("Error:", e);
	await prisma.$disconnect();
	process.exit(1);
});
