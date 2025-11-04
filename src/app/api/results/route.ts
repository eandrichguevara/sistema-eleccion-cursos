import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/results
 *
 * Obtiene los cursos asignados para el estudiante autenticado.
 * Requiere que el usuario esté autenticado con NextAuth.
 *
 * @returns {Object} JSON con las asignaciones del estudiante
 * @returns {boolean} hasAssignments - Indica si el estudiante tiene asignaciones
 * @returns {Array} assignments - Lista de cursos asignados con detalles
 */
export async function GET() {
	try {
		// Obtener la sesión del usuario autenticado
		const session = await getServerSession();

		if (!session || !session.user?.email) {
			return NextResponse.json({ error: "No autenticado" }, { status: 401 });
		}

		// Buscar el estudiante por email
		const student = await prisma.students.findUnique({
			where: {
				email: session.user.email,
			},
		});

		if (!student) {
			return NextResponse.json(
				{ error: "Estudiante no encontrado" },
				{ status: 404 }
			);
		}

		// Obtener las asignaciones del estudiante con información del curso
		const assignments = await prisma.assignments.findMany({
			where: {
				student_id: student.id,
			},
			include: {
				courses: {
					select: {
						id: true,
						name: true,
						parallel: true,
						capacity: true,
					},
				},
			},
			orderBy: [
				{ is_priority: "desc" }, // Prioritarios primero
				{ preference_order: "asc" }, // Luego por preferencia
			],
		});

		// Formatear la respuesta
		const formattedAssignments = assignments.map((assignment) => ({
			id: assignment.id,
			courseId: assignment.course_id,
			courseName: assignment.courses.name,
			parallel: assignment.courses.parallel,
			capacity: assignment.courses.capacity,
			assignedAt: assignment.assigned_at,
			isPriority: assignment.is_priority,
			preferenceOrder: assignment.preference_order,
			// Indicador de si fue por preferencia o por disponibilidad
			assignmentType:
				assignment.preference_order === 99
					? "availability"
					: assignment.preference_order === 1
					? "first"
					: assignment.preference_order === 2
					? "second"
					: "third",
		}));

		return NextResponse.json({
			hasAssignments: formattedAssignments.length > 0,
			totalAssignments: formattedAssignments.length,
			assignments: formattedAssignments,
			studentInfo: {
				email: student.email,
				level: student.level,
				isNeurodivergent: student.is_neurodivergent,
			},
		});
	} catch (error) {
		console.error("Error al obtener resultados:", error);
		return NextResponse.json(
			{ error: "Error al obtener los resultados de asignación" },
			{ status: 500 }
		);
	} finally {
		await prisma.$disconnect();
	}
}
