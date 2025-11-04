import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAdminRole() {
	console.log("🔍 Verificando rol del administrador...\n");

	try {
		const admin = await prisma.students.findUnique({
			where: { email: "admin@institucion.edu" },
		});

		if (!admin) {
			console.log("❌ No se encontró el usuario admin");
			return;
		}

		console.log("✅ Usuario encontrado:");
		console.log(`   📧 Email: ${admin.email}`);
		console.log(`   🔑 ID: ${admin.id}`);
		console.log(`   📊 Nivel: ${admin.level}`);
		console.log(`   👤 Rol: ${admin.role}`);
		console.log(`   🧠 Neurodivergente: ${admin.is_neurodivergent}`);

		if (admin.role !== "admin") {
			console.log('\n⚠️  PROBLEMA: El rol no es "admin"!');
			console.log("   Ejecuta: npm run db:create-admin para corregirlo");
		} else {
			console.log('\n✅ El rol está correctamente configurado como "admin"');
		}

		console.log("\n💡 Para que los cambios surtan efecto:");
		console.log("   1. Cierra todas las sesiones activas");
		console.log("   2. Elimina las cookies del navegador");
		console.log(
			"   3. Vuelve a iniciar sesión con admin@institucion.edu / admin123"
		);
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

checkAdminRole();
