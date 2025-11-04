import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	console.log("🧹 Limpiando asignaciones existentes...\n");

	// Eliminar todas las asignaciones
	const deleted = await prisma.assignments.deleteMany({});
	console.log(`✅ Eliminadas ${deleted.count} asignaciones`);

	// Eliminar registros de ejecución
	const runs = await prisma.assignment_runs.deleteMany({});
	console.log(`✅ Eliminados ${runs.count} registros de ejecución`);

	// Eliminar decisiones de lotería
	const lotteries = await (prisma as any).lottery_decisions.deleteMany({});
	console.log(`✅ Eliminadas ${lotteries.count} decisiones de lotería`);

	console.log("\n✨ Base de datos lista para nueva ejecución\n");

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error("Error:", e);
	await prisma.$disconnect();
	process.exit(1);
});
