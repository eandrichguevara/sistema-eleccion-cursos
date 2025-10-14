import styles from "./CourseCard.module.css";

interface CourseCardProps {
	id: number;
	nombre: string;
	parallelId: number;
	currentPreference: number;
	nextAvailablePreference: number;
	onSelect: (
		courseId: number,
		courseName: string,
		parallelId: number,
		preference: number
	) => void;
}

export default function CourseCard({
	id,
	nombre,
	parallelId,
	currentPreference,
	nextAvailablePreference,
	onSelect,
}: CourseCardProps) {
	const handleClick = () => {
		if (currentPreference > 0) {
			// Si ya está seleccionado, deseleccionar
			onSelect(id, nombre, parallelId, 0);
		} else if (nextAvailablePreference > 0) {
			// Si no está seleccionado y hay preferencia disponible, seleccionar
			onSelect(id, nombre, parallelId, nextAvailablePreference);
		}
	};

	const isSelected = currentPreference > 0;
	const canSelect = nextAvailablePreference > 0 || isSelected;
	const isFirstChoice = currentPreference === 1;

	return (
		<div
			className={`${styles.card} ${isSelected ? styles.selected : ""} ${
				isFirstChoice ? styles.firstChoice : ""
			}`}
		>
			<h3 className={styles.cursoNombre}>{nombre}</h3>
			<div className={styles.preferencias}>
				{isSelected ? (
					<div className={styles.selectedInfo}>
						<span
							className={`${styles.preferenceLabel} ${
								isFirstChoice ? styles.firstPreferenceLabel : ""
							}`}
						>
							{isFirstChoice && "🥇 "}Preferencia #{currentPreference}
						</span>
						<button className={styles.removeButton} onClick={handleClick}>
							✕ Quitar
						</button>
					</div>
				) : (
					<button
						className={styles.selectButton}
						onClick={handleClick}
						disabled={!canSelect}
					>
						{canSelect
							? `Seleccionar como opción #${nextAvailablePreference}`
							: "Completa las opciones anteriores"}
					</button>
				)}
			</div>
		</div>
	);
}
