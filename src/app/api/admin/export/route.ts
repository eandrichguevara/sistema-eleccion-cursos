import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
	try {
		// 1. Verificar autenticación y rol de administrador
		const session = await getServerSession(authOptions);

		if (!session || !session.user?.email) {
			return NextResponse.json({ error: "No autenticado" }, { status: 401 });
		}

		// Verificar que el usuario sea administrador
		const user = await prisma.students.findUnique({
			where: { email: session.user.email },
		});

		if (!user || user.role !== "admin") {
			return NextResponse.json(
				{ error: "No autorizado. Solo administradores pueden exportar." },
				{ status: 403 }
			);
		}

		// 2. Obtener todas las asignaciones con datos relacionados
		const assignments = await prisma.assignments.findMany({
			include: {
				students: true,
				courses: true,
			},
			orderBy: [
				{ students: { level: "asc" } },
				{ students: { email: "asc" } },
				{ courses: { parallel: "asc" } },
			],
		});

		if (assignments.length === 0) {
			return NextResponse.json(
				{ error: "No hay asignaciones para exportar" },
				{ status: 404 }
			);
		}

		// 3. Generar el contenido CSV
		const csvHeader = [
			"Email Estudiante",
			"Nivel",
			"Neurodivergente",
			"Curso",
			"Paralelo",
			"Tipo Asignación",
			"Preferencia",
			"Prioritario",
			"Fecha Asignación",
		].join(",");

		const csvRows = assignments.map((assignment) => {
			// Determinar el tipo de asignación
			let tipoAsignacion = "";
			if (assignment.preference_order === 1) {
				tipoAsignacion = "1ª Preferencia";
			} else if (assignment.preference_order === 2) {
				tipoAsignacion = "2ª Preferencia";
			} else if (assignment.preference_order === 3) {
				tipoAsignacion = "3ª Preferencia";
			} else if (assignment.preference_order === 99) {
				tipoAsignacion = "Disponibilidad";
			} else {
				tipoAsignacion = `Preferencia ${assignment.preference_order}`;
			}

			return [
				assignment.students.email,
				assignment.students.level,
				assignment.students.is_neurodivergent ? "Sí" : "No",
				`"${assignment.courses.name}"`, // Entre comillas por si tiene comas
				assignment.courses.parallel,
				tipoAsignacion,
				assignment.preference_order === 99
					? "N/A"
					: assignment.preference_order,
				assignment.is_priority ? "Sí" : "No",
				new Date(assignment.assigned_at).toLocaleString("es-CL", {
					timeZone: "America/Santiago",
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit",
				}),
			].join(",");
		});

		const csvContent = [csvHeader, ...csvRows].join("\n");

		// 4. Generar estadísticas para el nombre del archivo
		const totalEstudiantes = new Set(assignments.map((a) => a.student_id)).size;
		const timestamp = new Date().toISOString().split("T")[0];
		const filename = `asignaciones_${timestamp}_${totalEstudiantes}estudiantes.csv`;

		// 5. Retornar el archivo CSV
		return new NextResponse(csvContent, {
			status: 200,
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Cache-Control": "no-cache",
			},
		});
	} catch (error) {
		console.error("Error al exportar asignaciones:", error);
		return NextResponse.json(
			{
				error: "Error al exportar asignaciones",
				details: error instanceof Error ? error.message : "Error desconocido",
			},
			{ status: 500 }
		);
	} finally {
		await prisma.$disconnect();
	}
}
