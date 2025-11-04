import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";

async function createTestUser() {
	try {
		console.log("🔐 Creando usuario de prueba...");

		// Hashear la contraseña
		const hashedPassword = await hashPassword("password123");

		// Crear el usuario
		const user = await prisma.students.create({
			data: {
				email: "estudiante@institucion.edu",
				password: hashedPassword,
				level: 1,
				is_neurodivergent: false,
				previous_electives: [],
			},
		});

		console.log("✅ Usuario creado exitosamente:");
		console.log("📧 Email:", user.email);
		console.log("🔑 Password: password123");
		console.log("📊 Level:", user.level);
		console.log("🆔 ID:", user.id);
		console.log("\n💡 Puedes usar estas credenciales para iniciar sesión");
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "P2002"
		) {
			console.error("❌ Error: El usuario con este email ya existe");
			console.log("\n📧 Email existente: estudiante@institucion.edu");
			console.log("🔑 Password: password123");
			console.log("💡 Puedes usar estas credenciales para iniciar sesión");
		} else {
			console.error("❌ Error al crear usuario:", error);
		}
	} finally {
		await prisma.$disconnect();
	}
}

createTestUser();
