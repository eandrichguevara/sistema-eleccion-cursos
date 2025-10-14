import styles from "./CourseCard.module.css";

interface CourseCardProps {
	nombre: string;
}

export default function CourseCard({ nombre }: CourseCardProps) {
	return (
		<div className={styles.card}>
			<h3 className={styles.cursoNombre}>{nombre}</h3>
			<div className={styles.preferencias}>
				<span className={styles.label}>Preferencia:</span>
				<div className={styles.buttons}>
					<button className={styles.preferenciaButton}>1</button>
					<button className={styles.preferenciaButton}>2</button>
					<button className={styles.preferenciaButton}>3</button>
				</div>
			</div>
		</div>
	);
}
