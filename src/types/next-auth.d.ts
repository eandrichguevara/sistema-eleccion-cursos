import "next-auth";

declare module "next-auth" {
	interface User {
		id: string;
		email: string;
		name?: string;
		level: number;
		isNeurodivergent: boolean;
		role: string;
	}

	interface Session {
		user: {
			id: string;
			email: string;
			name?: string;
			level: number;
			isNeurodivergent: boolean;
			role: string;
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: string;
		email: string;
		level: number;
		isNeurodivergent: boolean;
		role: string;
	}
}
