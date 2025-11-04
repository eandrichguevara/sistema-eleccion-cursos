import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	console.log("🔍 Verificando estudiantes sin selecciones...\n");

	// Total de estudiantes
	const totalStudents = await prisma.students.count({
		where: { role: "student" },
	});
	console.log(`Total de estudiantes: ${totalStudents}`);

	// Estudiantes con selecciones
	const withSelections = await prisma.students.count({
		where: {
			role: "student",
			selections: { some: {} },
		},
	});
	console.log(`Con selecciones: ${withSelections}`);

	// Estudiantes sin selecciones
	const withoutSelections = totalStudents - withSelections;
	console.log(`Sin selecciones: ${withoutSelections}`);

	// Listar algunos estudiantes sin selecciones
	const noSelList = await prisma.students.findMany({
		where: {
			role: "student",
			NOT: {
				selections: { some: {} },
			},
		},
		select: {
			email: true,
			level: true,
			is_neurodivergent: true,
		},
		take: 5,
	});

	console.log("\n📋 Ejemplos de estudiantes sin selecciones:");
	noSelList.forEach((s) => {
		console.log(
			`  • ${s.email} (Nivel ${s.level}, ${
				s.is_neurodivergent ? "neurodivergente" : "regular"
			})`
		);
	});

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error("Error:", e);
	await prisma.$disconnect();
	process.exit(1);
});
