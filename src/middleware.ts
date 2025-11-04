import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
	function middleware(req) {
		const token = req.nextauth.token;
		const isAuth = !!token;
		const isAuthPage = req.nextUrl.pathname === "/";
		const isAdminPage = req.nextUrl.pathname.startsWith("/admin");
		const isDashboardPage = req.nextUrl.pathname.startsWith("/dashboard");
		const userRole = token?.role as string | undefined;

		// 🔍 DEBUG: Imprimir información del token
		console.log("🔍 MIDDLEWARE DEBUG:");
		console.log("   📍 Ruta:", req.nextUrl.pathname);
		console.log("   🔐 Autenticado:", isAuth);
		console.log("   👤 Email:", token?.email || "N/A");
		console.log("   🎭 Rol:", userRole || "UNDEFINED");
		console.log("   📋 Token completo:", JSON.stringify(token, null, 2));
		console.log("---");

		// Si el usuario está autenticado y trata de acceder a la página de login,
		// redirigirlo según su rol
		if (isAuthPage && isAuth) {
			if (userRole === "admin") {
				console.log("✅ Admin detectado - Redirigiendo a /admin");
				return NextResponse.redirect(new URL("/admin", req.url));
			}
			console.log("✅ Estudiante detectado - Redirigiendo a /dashboard");
			return NextResponse.redirect(new URL("/dashboard", req.url));
		}

		// Si un administrador intenta acceder al dashboard, redirigirlo a /admin
		if (isDashboardPage && isAuth && userRole === "admin") {
			console.log(
				"⚠️ Admin intentando acceder a dashboard - Redirigiendo a /admin"
			);
			return NextResponse.redirect(new URL("/admin", req.url));
		}

		// Si un estudiante trata de acceder a /admin, redirigirlo al dashboard
		if (isAdminPage && isAuth && userRole !== "admin") {
			console.log(
				"⚠️ Estudiante intentando acceder a admin - Redirigiendo a /dashboard"
			);
			return NextResponse.redirect(new URL("/dashboard", req.url));
		}

		console.log("✅ Permitiendo acceso a la ruta");
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
	matcher: ["/", "/dashboard/:path*", "/admin/:path*"],
};
