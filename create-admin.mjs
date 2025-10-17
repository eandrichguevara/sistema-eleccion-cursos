import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createAdmin() {
	try {
		// Hash de la contraseña
		const hashedPassword = await bcrypt.hash("admin123", 10);

		// Crear usuario administrador
		const admin = await prisma.student.upsert({
			where: { email: "admin@institucion.edu" },
			update: {
				role: "admin",
			},
			create: {
				email: "admin@institucion.edu",
				password: hashedPassword,
				level: 4,
				is_neurodivergent: false,
				previous_electives: [],
				role: "admin",
			},
		});

		console.log("✅ Usuario administrador creado/actualizado:");
		console.log(`   Email: ${admin.email}`);
		console.log(`   Role: ${admin.role}`);
		console.log(`   Password: admin123`);
		console.log(
			"\n📝 Puedes usar estas credenciales para acceder como administrador."
		);
	} catch (error) {
		console.error("❌ Error creando administrador:", error);
	} finally {
		await prisma.$disconnect();
	}
}

createAdmin();
