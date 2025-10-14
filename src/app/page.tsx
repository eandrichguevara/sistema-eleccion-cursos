import styles from "../../styles/Login.module.css";

export default function Home() {
	return (
		<div className={styles.container}>
			<h1 className={styles.title}>Sistema de Elección de Cursos</h1>
			<form className={styles.form}>
				<input
					type="email"
					placeholder="Correo Institucional"
					className={styles.input}
					required
				/>
				<input
					type="password"
					placeholder="Contraseña"
					className={styles.input}
					required
				/>
				<button type="submit" className={styles.button}>
					Ingresar
				</button>
			</form>
		</div>
	);
}
