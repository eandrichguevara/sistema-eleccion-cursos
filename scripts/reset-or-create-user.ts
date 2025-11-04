import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";

async function run() {
	const args = process.argv.slice(2);
	const email = args[0] || "estudiante@institucion.edu";
	const password = args[1] || "password123";

	try {
		const hashed = await hashPassword(password);
		// Try to update existing user
		try {
			const updated = await prisma.students.update({
				where: { email },
				data: { password: hashed },
			});
			console.log("✅ Password updated for existing user:", updated.email);
			console.log("🔑 New password:", password);
		} catch (err: unknown) {
			// If not found, create
			const e = err as { code?: string } | undefined;
			if (e && e.code === "P2025") {
				const created = await prisma.students.create({
					data: {
						email,
						password: hashed,
						level: 1,
						is_neurodivergent: false,
						previous_electives: [],
					},
				});
				console.log("✅ User created:", created.email);
				console.log("🔑 Password:", password);
				console.log("🆔 ID:", created.id);
			} else {
				throw err;
			}
		}
	} catch (e) {
		console.error("Error:", e);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

run();
