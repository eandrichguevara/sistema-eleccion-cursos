import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyChanges() {
	console.log("🔍 VERIFICANDO CAMBIOS EN EL ALGORITMO DE ASIGNACIÓN\n");
	console.log("=".repeat(80));

	try {
		// Verificar estudiantes con selecciones
		const students = await prisma.students.findMany({
			where: {
				selections: {
					some: {},
				},
			},
			include: {
				selections: {
					include: {
						courses: true,
					},
				},
			},
		});

		console.log(
			`\n📊 Total de estudiantes con selecciones: ${students.length}`
		);

		// Verificar la nueva validación que agregaste hoy
		const hasStudentWithAllParallels = students.some((s) => {
			const selectedParallels = new Set(
				s.selections.map((sel) => sel.courses.parallel)
			);
			return [1, 2, 3].every((p) => selectedParallels.has(p));
		});

		console.log(`\n✅ Nueva validación agregada hoy:`);
		console.log(
			`   ¿Hay al menos un estudiante con selecciones en paralelos 1, 2 y 3?`
		);
		console.log(
			`   Respuesta: ${hasStudentWithAllParallels ? "✅ SÍ" : "❌ NO"}`
		);

		if (hasStudentWithAllParallels) {
			// Contar cuántos estudiantes cumplen con la nueva validación
			const studentsWithAllParallels = students.filter((s) => {
				const selectedParallels = new Set(
					s.selections.map((sel) => sel.courses.parallel)
				);
				return [1, 2, 3].every((p) => selectedParallels.has(p));
			});

			console.log(
				`\n   Estudiantes que cumplen: ${studentsWithAllParallels.length}/${students.length}`
			);
			console.log(`\n   Primeros 5 estudiantes con selecciones completas:`);
			studentsWithAllParallels.slice(0, 5).forEach((s, i) => {
				const parallels = new Set(
					s.selections.map((sel) => sel.courses.parallel)
				);
				console.log(
					`   ${i + 1}. ${s.email} - Paralelos: ${Array.from(parallels)
						.sort()
						.join(", ")}`
				);
			});
		}

		// Verificar que el archivo course-assignment.ts tenga el cambio
		const fs = await import("fs");
		const fileContent = fs.readFileSync(
			"./src/lib/course-assignment.ts",
			"utf-8"
		);

		const hasNewValidation = fileContent.includes("hasStudentWithAllParallels");
		const hasNewErrorMessage = fileContent.includes(
			"No hay al menos un alumno que haya elegido sus prioridades para los paralelos 1, 2 y 3"
		);

		console.log(`\n📝 VERIFICACIÓN DEL CÓDIGO FUENTE:`);
		console.log(
			`   ¿El archivo contiene la nueva validación? ${
				hasNewValidation ? "✅ SÍ" : "❌ NO"
			}`
		);
		console.log(
			`   ¿El archivo contiene el nuevo mensaje de error? ${
				hasNewErrorMessage ? "✅ SÍ" : "❌ NO"
			}`
		);

		console.log(`\n💡 CONCLUSIÓN:`);
		if (hasNewValidation && hasNewErrorMessage) {
			console.log(`   ✅ El código tiene los cambios que realizaste hoy`);
			console.log(
				`   ✅ El botón de asignación DEBERÍA ejecutar estos cambios`
			);

			if (!hasStudentWithAllParallels) {
				console.log(`\n   ⚠️  PROBLEMA DETECTADO:`);
				console.log(
					`   No hay estudiantes con selecciones completas (paralelos 1, 2 y 3)`
				);
				console.log(`   El algoritmo fallará con el mensaje:`);
				console.log(
					`   "No hay al menos un alumno que haya elegido sus prioridades para los paralelos 1, 2 y 3"`
				);
			}
		} else {
			console.log(`   ⚠️  Los cambios NO están presentes en el código`);
		}
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

verifyChanges();
