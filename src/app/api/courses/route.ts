import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const courses = await prisma.course.findMany({
			orderBy: [{ parallel: "asc" }, { name: "asc" }],
		});

		return NextResponse.json(courses);
	} catch (error) {
		console.error("Error fetching courses:", error);
		return NextResponse.json(
			{ error: "Error al obtener los cursos" },
			{ status: 500 }
		);
	}
}
