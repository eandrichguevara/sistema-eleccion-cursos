import styles from "./Dashboard.module.css";
import CourseCard from "@/components/CourseCard";

export default function Dashboard() {
	// Datos de ejemplo hardcodeados
	const paralelos = [
		{
			id: 1,
			nombre: "Paralelo 1",
			cursos: [
				{ id: 1, nombre: "Matemáticas Avanzadas" },
				{ id: 2, nombre: "Física Cuántica" },
				{ id: 3, nombre: "Química Orgánica" },
				{ id: 4, nombre: "Programación I" },
			],
		},
		{
			id: 2,
			nombre: "Paralelo 2",
			cursos: [
				{ id: 5, nombre: "Literatura Contemporánea" },
				{ id: 6, nombre: "Historia Universal" },
				{ id: 7, nombre: "Biología Molecular" },
				{ id: 8, nombre: "Inglés Avanzado" },
			],
		},
		{
			id: 3,
			nombre: "Paralelo 3",
			cursos: [
				{ id: 9, nombre: "Economía Global" },
				{ id: 10, nombre: "Estadística Aplicada" },
				{ id: 11, nombre: "Diseño Digital" },
				{ id: 12, nombre: "Bases de Datos" },
			],
		},
	];

	return (
		<div className={styles.container}>
			<h1 className={styles.title}>Dashboard - Selección de Cursos</h1>

			<div className={styles.paralelos}>
				{paralelos.map((paralelo) => (
					<div key={paralelo.id} className={styles.paralelo}>
						<h2 className={styles.paraleloTitle}>{paralelo.nombre}</h2>
						<div className={styles.cursos}>
							{paralelo.cursos.map((curso) => (
								<CourseCard key={curso.id} nombre={curso.nombre} />
							))}
						</div>
					</div>
				))}
			</div>

			<button className={styles.submitButton}>Enviar Selección</button>
		</div>
	);
}
