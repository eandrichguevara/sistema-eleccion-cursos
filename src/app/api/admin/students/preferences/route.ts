/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/admin/students/preferences
 * Devuelve conteos: total estudiantes, cuantos completaron preferencias (3 paralelos)
 * y cuantos aún faltan elegir al menos un paralelo.
 */
export async function GET(request: NextRequest) {
	try {
		// Auth: solo admin
		const session = await getServerSession(authOptions);
		if (!session || !session.user?.email) {
			return NextResponse.json(
				{ success: false, error: "No autenticado" },
				{ status: 401 }
			);
		}

		const user = await prisma.students.findUnique({
			where: { email: session.user.email },
		});
		if (!user || user.role !== "admin") {
			return NextResponse.json(
				{ success: false, error: "No autorizado. Solo administradores." },
				{ status: 403 }
			);
		}

		// Total de estudiantes (rol student)
		const totalStudents = await prisma.students.count({
			where: { role: "student" },
		});

		// Estudiantes que tienen al menos una selección (any)
		const anySelRes: Array<{ count: bigint }> = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT student_id)::bigint as count FROM selections
    `;
		const studentsWithAnySelection = Number(anySelRes[0]?.count ?? 0);

		// Estudiantes que tienen selecciones en los 3 paralelos (completos)
		const completeRes: Array<{ count: bigint }> = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint as count FROM (
        SELECT s.student_id, COUNT(DISTINCT c.parallel) as cnt
        FROM selections s
        JOIN courses c ON s.course_id = c.id
        GROUP BY s.student_id
      ) t WHERE t.cnt = 3
    `;
		const studentsCompletePreferences = Number(completeRes[0]?.count ?? 0);

		const studentsMissingAny = totalStudents - studentsCompletePreferences;

		return NextResponse.json({
			totalStudents,
			studentsWithAnySelection,
			studentsCompletePreferences,
			studentsMissingAny,
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Error GET /api/admin/students/preferences:", err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}
