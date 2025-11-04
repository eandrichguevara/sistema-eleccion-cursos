import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createAdmin() {
	console.log("👤 Creando usuario administrador...\n");

	try {
		// Verificar si ya existe
		const existingAdmin = await prisma.students.findUnique({
			where: { email: "admin@institucion.edu" },
		});

		if (existingAdmin) {
			console.log("⚠️  El usuario admin ya existe.");
			console.log("🔄 Actualizando contraseña...");

			const hashedPassword = await bcrypt.hash("admin123", 10);

			await prisma.students.update({
				where: { email: "admin@institucion.edu" },
				data: {
					password: hashedPassword,
					role: "admin",
				},
			});

			console.log("✅ Contraseña actualizada correctamente!");
		} else {
			console.log("➕ Creando nuevo usuario admin...");

			const hashedPassword = await bcrypt.hash("admin123", 10);

			await prisma.students.create({
				data: {
					email: "admin@institucion.edu",
					password: hashedPassword,
					level: 4,
					is_neurodivergent: false,
					previous_electives: [],
					role: "admin",
				},
			});

			console.log("✅ Usuario admin creado correctamente!");
		}

		console.log("\n💡 Credenciales del administrador:");
		console.log("   📧 Email: admin@institucion.edu");
		console.log("   🔑 Password: admin123");
		console.log("\n⚠️  Importante: Cambia esta contraseña en producción!");
	} catch (error) {
		console.error("❌ Error al crear/actualizar admin:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

createAdmin();
