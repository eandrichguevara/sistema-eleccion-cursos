import "next-auth";

declare module "next-auth" {
	interface User {
		id: string;
		email: string;
		name?: string;
		level: number;
		isNeurodivergent: boolean;
	}

	interface Session {
		user: {
			id: string;
			email: string;
			name?: string;
			level: number;
			isNeurodivergent: boolean;
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: string;
		email: string;
		level: number;
		isNeurodivergent: boolean;
	}
}
