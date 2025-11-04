import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
	try {
		console.log("🔍 Verificando estado de la base de datos...\n");

		const studentsCount = await prisma.students.count();
		const coursesCount = await prisma.courses.count();
		const selectionsCount = await prisma.selections.count();
		const assignmentsCount = await prisma.assignments.count();

		console.log("📊 Resumen:");
		console.log(`   Estudiantes: ${studentsCount}`);
		console.log(`   Cursos: ${coursesCount}`);
		console.log(`   Selecciones: ${selectionsCount}`);
		console.log(`   Asignaciones: ${assignmentsCount}\n`);

		if (studentsCount > 0) {
			const students = await prisma.students.findMany({
				take: 3,
				select: {
					email: true,
					level: true,
					is_neurodivergent: true,
					role: true,
				},
			});
			console.log("👥 Primeros estudiantes:");
			students.forEach((s) =>
				console.log(`   - ${s.email} (${s.level}, ${s.role})`)
			);
			console.log();
		}

		if (coursesCount > 0) {
			const courses = await prisma.courses.findMany({
				take: 3,
				select: {
					name: true,
					parallel: true,
					capacity: true,
				},
			});
			console.log("📚 Primeros cursos:");
			courses.forEach((c) =>
				console.log(
					`   - ${c.name} - Paralelo ${c.parallel} (capacidad: ${c.capacity})`
				)
			);
			console.log();
		}

		if (selectionsCount > 0) {
			const selections = await prisma.selections.findMany({
				take: 3,
				include: {
					students: {
						select: { email: true },
					},
					courses: {
						select: { name: true, parallel: true },
					},
				},
			});
			console.log("✅ Primeras selecciones:");
			selections.forEach((s) =>
				console.log(
					`   - ${s.students.email} → ${s.courses.name} (P${s.courses.parallel}) - Preferencia ${s.preference_order}`
				)
			);
			console.log();
		}

		// Contar estudiantes por rol
		const adminCount = await prisma.students.count({
			where: { role: "admin" },
		});
		const studentCount = await prisma.students.count({
			where: { role: "student" },
		});

		console.log("👤 Por rol:");
		console.log(`   Administradores: ${adminCount}`);
		console.log(`   Estudiantes: ${studentCount}\n`);

		// Diagnóstico
		console.log("🩺 Diagnóstico:");
		if (studentsCount === 0) {
			console.log("   ❌ No hay estudiantes en la base de datos");
		}
		if (coursesCount === 0) {
			console.log("   ❌ No hay cursos en la base de datos");
		}
		if (selectionsCount === 0) {
			console.log("   ❌ No hay selecciones de cursos");
			if (studentsCount > 0 && coursesCount > 0) {
				console.log(
					"   ℹ️  Necesitas que los estudiantes seleccionen cursos desde el dashboard"
				);
			}
		}
		if (studentsCount > 0 && coursesCount > 0 && selectionsCount > 0) {
			console.log(
				"   ✅ La base de datos está lista para ejecutar la asignación"
			);
		}
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

checkDatabaseStatus();
