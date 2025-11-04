"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() {
	useEffect(() => {
		// Cerrar sesión automáticamente al cargar la página
		signOut({ callbackUrl: "/", redirect: true });
	}, []);

	return (
		<div
			style={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				minHeight: "100vh",
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
				color: "white",
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			<div style={{ textAlign: "center" }}>
				<h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
					🔄 Cerrando sesión...
				</h1>
				<p style={{ opacity: 0.9 }}>Serás redirigido al login en un momento.</p>
			</div>
		</div>
	);
}
