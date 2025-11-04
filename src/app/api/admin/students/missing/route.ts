/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/admin/students/missing
 * Devuelve la lista de estudiantes (id, email, name) que tienen menos de 3
 * paralelos seleccionados (es decir, aún les falta elegir algún paralelo).
 */
export async function GET() {
	try {
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

		// Obtener estudiantes con menos de 3 paralelos seleccionados
		// además devolver array de paralelos seleccionados por estudiante
		const rows: Array<any> = await prisma.$queryRaw`
      SELECT st.id, st.email, st.level, COALESCE(t.cnt, 0)::int as selected_parallels,
             COALESCE(t.parallels, ARRAY[]::int[]) as parallels
      FROM students st
      LEFT JOIN (
        SELECT s.student_id, COUNT(DISTINCT c.parallel) as cnt,
               array_agg(DISTINCT c.parallel) as parallels
        FROM selections s
        JOIN courses c ON s.course_id = c.id
        GROUP BY s.student_id
      ) t ON t.student_id = st.id
      WHERE st.role = 'student' AND COALESCE(t.cnt, 0) < 3
      ORDER BY st.email
    `;

		return NextResponse.json({ students: rows });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Error GET /api/admin/students/missing:", err);
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}
