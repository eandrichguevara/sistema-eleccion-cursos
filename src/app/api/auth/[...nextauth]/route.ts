import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
	providers: [
		CredentialsProvider({
			name: "Credentials",
			credentials: {
				email: { label: "Correo Institucional", type: "email" },
				password: { label: "Contraseña", type: "password" },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					throw new Error("Email y contraseña son requeridos");
				}

				// Buscar el estudiante en la base de datos
				const student = await prisma.student.findUnique({
					where: {
						email: credentials.email,
					},
				});

				if (!student) {
					throw new Error("Credenciales inválidas");
				}

				// Verificar la contraseña
				const isPasswordValid = await bcrypt.compare(
					credentials.password,
					student.password
				);

				if (!isPasswordValid) {
					throw new Error("Credenciales inválidas");
				}

				// Retornar el usuario si las credenciales son válidas
				return {
					id: student.id,
					email: student.email,
					name: student.email.split("@")[0],
					level: student.level,
					isNeurodivergent: student.is_neurodivergent,
				};
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.email = user.email;
				token.level = user.level;
				token.isNeurodivergent = user.isNeurodivergent;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.id = token.id;
				session.user.level = token.level;
				session.user.isNeurodivergent = token.isNeurodivergent;
			}
			return session;
		},
	},
	pages: {
		signIn: "/",
	},
	session: {
		strategy: "jwt",
	},
	secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
