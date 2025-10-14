import bcrypt from "bcryptjs";

/**
 * Hashea una contraseña usando bcrypt
 * @param password - Contraseña en texto plano
 * @returns Contraseña hasheada
 */
export async function hashPassword(password: string): Promise<string> {
	const saltRounds = 10;
	return await bcrypt.hash(password, saltRounds);
}

/**
 * Compara una contraseña en texto plano con una hasheada
 * @param password - Contraseña en texto plano
 * @param hashedPassword - Contraseña hasheada
 * @returns true si coinciden, false si no
 */
export async function verifyPassword(
	password: string,
	hashedPassword: string
): Promise<boolean> {
	return await bcrypt.compare(password, hashedPassword);
}
