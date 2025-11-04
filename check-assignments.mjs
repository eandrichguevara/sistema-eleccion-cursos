import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAssignments() {
	try {
		const assignments = await prisma.assignments.findMany({
			take: 5,
			include: {
				students: {
					select: { email: true, level: true },
				},
				courses: {
					select: { name: true, parallel: true },
				},
			},
		});

		const total = await prisma.assignments.count();

		console.log("📊 Total de asignaciones:", total);
		console.log("\n📋 Primeras 5 asignaciones:");
		console.log(JSON.stringify(assignments, null, 2));
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

checkAssignments();
