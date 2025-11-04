import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	console.log("🔍 Verificando asignaciones...\n");

	const count = await prisma.assignments.count();
	console.log(`Total de asignaciones: ${count}`);

	const sample = await prisma.assignments.findMany({
		take: 5,
		include: {
			courses: true,
			students: true,
		},
		orderBy: {
			assigned_at: "desc",
		},
	});

	console.log("\nMuestra de asignaciones recientes:");
	sample.forEach((a: any) => {
		console.log(`- ${a.students.email}`);
		console.log(
			`  → ${a.courses.name} (Paralelo ${a.courses.parallel}, Preferencia ${a.preference_order})`
		);
	});

	// Verificar que un estudiante tenga 3 cursos
	const studentWithAssignments = await prisma.students.findFirst({
		where: {
			assignments: {
				some: {},
			},
		},
		include: {
			assignments: {
				include: {
					courses: true,
				},
			},
		},
	});

	if (studentWithAssignments) {
		console.log(
			`\n\n📚 Ejemplo completo - Estudiante: ${studentWithAssignments.email}`
		);
		console.log(`Email: ${studentWithAssignments.email}`);
		console.log(
			`Cursos asignados: ${studentWithAssignments.assignments.length}`
		);
		studentWithAssignments.assignments.forEach((a: any) => {
			console.log(
				`  ${a.courses.parallel}. ${a.courses.name} (${
					a.preference_order === 99
						? "Disponibilidad"
						: `Preferencia ${a.preference_order}`
				})`
			);
		});
	}

	await prisma.$disconnect();
}

main().catch(console.error);
