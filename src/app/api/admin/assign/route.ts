import { NextResponse } from "next/server";
import { executeAssignmentAlgorithm } from "@/lib/course-assignment";

/**
 * POST /api/admin/assign
 * Ejecuta el algoritmo completo de asignación de cursos
 *
 * Prioriza en este orden:
 * 1. Estudiantes neurodivergentes (cualquier nivel)
 * 2. Estudiantes de 4to medio
 * 3. Estudiantes de 3ro medio
 *
 * Para cada grupo, asigna por paralelo usando preferencias 1-4
 * con sistema de sorteo cuando hay sobrecupo
 */
export async function POST() {
	try {
		console.log("📥 Recibida solicitud de asignación de cursos");

		const result = await executeAssignmentAlgorithm();

		if (result.success) {
			return NextResponse.json({
				success: true,
				message: result.message,
				stats: result.stats,
			});
		} else {
			return NextResponse.json(
				{
					success: false,
					error: result.message,
				},
				{ status: 400 }
			);
		}
	} catch (error) {
		console.error("❌ Error ejecutando asignación:", error);

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Error desconocido",
			},
			{ status: 500 }
		);
	}
}
