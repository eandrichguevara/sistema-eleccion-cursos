import { prisma } from "../src/lib/prisma";
import { verifyPassword } from "../src/utils/password";

async function run() {
	const [email, password] = process.argv.slice(2);
	if (!email || !password) {
		console.error(
			"Usage: npx tsx scripts/check-user-password.ts <email> <password>"
		);
		process.exit(1);
	}

	try {
		const user = await prisma.students.findUnique({ where: { email } });
		if (!user) {
			console.log(`User not found: ${email}`);
			process.exit(0);
		}

		console.log("Found user:");
		console.log("  id:", user.id);
		console.log("  email:", user.email);
		console.log("  level:", user.level);
		console.log("  role:", user.role);
		console.log("  is_neurodivergent:", user.is_neurodivergent);

		const match = await verifyPassword(password, user.password);
		if (match) {
			console.log("✅ Password matches the stored hash. Login should work.");
		} else {
			console.log("❌ Password does NOT match the stored hash.");
			console.log("If you want to reset it to 'password123' run:");
			console.log(
				"  npx tsx scripts/reset-or-create-user.ts ",
				email,
				" password123"
			);
		}
	} catch (err) {
		console.error("Error checking user:", err);
	} finally {
		await prisma.$disconnect();
	}
}

run();
