import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
	try {
		// Obtener la sesión del usuario
		const session = await getServerSession(authOptions);

		// Verificar que el usuario esté autenticado
		if (!session || !session.user?.id) {
			return NextResponse.json(
				{ error: "No autorizado. Debes iniciar sesión." },
				{ status: 401 }
			);
		}

		const userId = session.user.id;

		// Obtener las selecciones del cuerpo de la petición
		const { selections } = await request.json();

		if (!selections || !Array.isArray(selections)) {
			return NextResponse.json(
				{ error: "Las selecciones son requeridas y deben ser un array." },
				{ status: 400 }
			);
		}

		// Validar que las selecciones no estén vacías
		if (selections.length === 0) {
			return NextResponse.json(
				{ error: "Debes enviar al menos una selección." },
				{ status: 400 }
			);
		}

		// Validar estructura de cada selección
		for (const selection of selections) {
			if (!selection.courseId || !selection.preference) {
				return NextResponse.json(
					{
						error:
							"Cada selección debe tener courseId y preference (preference_order).",
					},
					{ status: 400 }
				);
			}
		}

		// Eliminar selecciones anteriores del usuario (si existen)
		await prisma.selection.deleteMany({
			where: {
				student_id: userId,
			},
		});

		// Crear las nuevas selecciones
		const createdSelections = await prisma.selection.createMany({
			data: selections.map((selection) => ({
				student_id: userId,
				course_id: selection.courseId,
				preference_order: selection.preference,
			})),
		});

		return NextResponse.json(
			{
				message: "Selecciones guardadas exitosamente",
				count: createdSelections.count,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("Error al guardar selecciones:", error);
		return NextResponse.json(
			{ error: "Error interno del servidor al guardar las selecciones." },
			{ status: 500 }
		);
	}
}

export async function GET() {
	try {
		// Obtener la sesión del usuario
		const session = await getServerSession(authOptions);

		// Verificar que el usuario esté autenticado
		if (!session || !session.user?.id) {
			return NextResponse.json(
				{ error: "No autorizado. Debes iniciar sesión." },
				{ status: 401 }
			);
		}

		const userId = session.user.id;

		// Obtener las selecciones del usuario
		const selections = await prisma.selection.findMany({
			where: {
				student_id: userId,
			},
			include: {
				course: true,
			},
			orderBy: {
				preference_order: "asc",
			},
		});

		return NextResponse.json({ selections }, { status: 200 });
	} catch (error) {
		console.error("Error al obtener selecciones:", error);
		return NextResponse.json(
			{ error: "Error interno del servidor al obtener las selecciones." },
			{ status: 500 }
		);
	}
}
