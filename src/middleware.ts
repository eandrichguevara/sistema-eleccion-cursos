import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
	function middleware(req) {
		const token = req.nextauth.token;
		const isAuth = !!token;
		const isAuthPage = req.nextUrl.pathname === "/";

		// Si el usuario está autenticado y trata de acceder a la página de login,
		// redirigirlo al dashboard
		if (isAuthPage && isAuth) {
			return NextResponse.redirect(new URL("/dashboard", req.url));
		}

		return NextResponse.next();
	},
	{
		callbacks: {
			authorized: ({ token, req }) => {
				// Permitir acceso a la página de login sin autenticación
				if (req.nextUrl.pathname === "/") {
					return true;
				}
				// Para todas las demás rutas protegidas, verificar el token
				return !!token;
			},
		},
		pages: {
			signIn: "/",
		},
	}
);

export const config = {
	matcher: ["/", "/dashboard/:path*"],
};
