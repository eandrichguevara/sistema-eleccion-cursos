"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "../styles/Login.module.css";

export default function Home() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const result = await signIn("credentials", {
				email,
				password,
				redirect: false,
			});

			if (result?.error) {
				setError("Credenciales inválidas. Por favor, intenta de nuevo.");
				setIsLoading(false);
			} else {
				// Login exitoso, redirigir al dashboard
				router.push("/dashboard");
			}
		} catch {
			setError("Ocurrió un error. Por favor, intenta de nuevo.");
			setIsLoading(false);
		}
	};

	return (
		<div className={styles.container}>
			<h1 className={styles.title}>Sistema de Elección de Cursos</h1>
			<form className={styles.form} onSubmit={handleSubmit}>
				{error && <div className={styles.error}>{error}</div>}
				<input
					type="email"
					placeholder="Correo Institucional"
					className={styles.input}
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					disabled={isLoading}
				/>
				<input
					type="password"
					placeholder="Contraseña"
					className={styles.input}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					disabled={isLoading}
				/>
				<button type="submit" className={styles.button} disabled={isLoading}>
					{isLoading ? "Ingresando..." : "Ingresar"}
				</button>
			</form>
		</div>
	);
}
