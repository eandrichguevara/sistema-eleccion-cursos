"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import styles from "./Dashboard.module.css";
import CourseCard from "@/components/CourseCard";

type Selection = {
	courseId: string; // UUID
	courseName: string;
	parallelId: number;
	preference: number;
};

type ApiSelection = {
	course_id: string;
	preference_order: number;
	courses: {
		name: string;
		parallel: number;
	};
};

type Assignment = {
	id: string;
	courseId: string;
	courseName: string;
	parallel: number;
	capacity: number;
	assignedAt: string;
	isPriority: boolean;
	preferenceOrder: number;
	assignmentType: "first" | "second" | "third" | "availability";
};

type Course = {
	id: string;
	name: string;
	parallel: number;
	capacity: number;
};

type Parallel = {
	id: number;
	nombre: string;
	cursos: Array<{
		id: string;
		nombre: string;
	}>;
};

export default function Dashboard() {
	const [selections, setSelections] = useState<Selection[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isContentLoaded, setIsContentLoaded] = useState(false);
	const [assignments, setAssignments] = useState<Assignment[]>([]);
	const [hasAssignments, setHasAssignments] = useState(false);
	const [showResults, setShowResults] = useState(false);
	const [paralelos, setParalelos] = useState<Parallel[]>([]);

	// Cargar selecciones previas al montar el componente
	// Función para cargar los resultados de asignación
	const loadResults = async () => {
		try {
			const response = await fetch("/api/results");
			if (response.ok) {
				const data = await response.json();
				if (data.hasAssignments) {
					setAssignments(data.assignments);
					setHasAssignments(true);
					setShowResults(true);
				}
			}
		} catch (error) {
			console.error("Error al cargar resultados:", error);
		}
	};

	// Función para cargar los cursos desde la API
	const loadCourses = async () => {
		try {
			const response = await fetch("/api/courses");
			if (response.ok) {
				const courses: Course[] = await response.json();

				// Agrupar cursos por paralelo
				const grouped: { [key: number]: Parallel } = {};
				courses.forEach((course) => {
					if (!grouped[course.parallel]) {
						grouped[course.parallel] = {
							id: course.parallel,
							nombre: `Paralelo ${course.parallel}`,
							cursos: [],
						};
					}
					grouped[course.parallel].cursos.push({
						id: course.id,
						nombre: course.name,
					});
				});

				// Convertir a array y ordenar por paralelo
				const paralelosArray = Object.values(grouped).sort(
					(a, b) => a.id - b.id
				);
				setParalelos(paralelosArray);
			}
		} catch (error) {
			console.error("Error al cargar cursos:", error);
		}
	};

	useEffect(() => {
		const loadSelections = async () => {
			try {
				const response = await fetch("/api/selections");
				if (response.ok) {
					const data = await response.json();
					// Mapear las selecciones de la API al formato del estado local
					if (data.selections && data.selections.length > 0) {
						const loadedSelections: Selection[] = data.selections.map(
							(sel: ApiSelection) => ({
								courseId: sel.course_id, // Ya es un UUID string
								courseName: sel.courses.name,
								parallelId: sel.courses.parallel,
								preference: sel.preference_order,
							})
						);
						setSelections(loadedSelections);
					}
				}
			} catch (error) {
				console.error("Error al cargar selecciones:", error);
			}
		};

		// Cargar cursos, selecciones y resultados
		Promise.all([loadCourses(), loadSelections(), loadResults()]).then(() => {
			// Después de cargar, esperar un momento y activar la transición
			setTimeout(() => {
				setIsContentLoaded(true);
			}, 1500); // Espera 1.5 segundos para mostrar el título
		});
	}, []);
	const handleSelectCourse = (
		courseId: string,
		courseName: string,
		parallelId: number,
		preference: number
	) => {
		if (preference > 0) {
			// Agregar nueva selección
			const newSelections = selections.filter((s) => s.courseId !== courseId);
			newSelections.push({ courseId, courseName, parallelId, preference });
			setSelections(newSelections);
		} else {
			// Eliminar y reordenar
			const currentSelection = selections.find((s) => s.courseId === courseId);
			if (!currentSelection) return;

			const removedPreference = currentSelection.preference;
			const removedParallelId = currentSelection.parallelId;

			// Filtrar la selección eliminada
			let newSelections = selections.filter((s) => s.courseId !== courseId);

			// Reordenar las preferencias del mismo paralelo que estaban después de la eliminada
			newSelections = newSelections.map((s) => {
				if (
					s.parallelId === removedParallelId &&
					s.preference > removedPreference
				) {
					return { ...s, preference: s.preference - 1 };
				}
				return s;
			});

			setSelections(newSelections);
		}
	};

	const getCoursePreference = (courseId: string): number => {
		const selection = selections.find((s) => s.courseId === courseId);
		return selection ? selection.preference : 0;
	};

	const getNextAvailablePreference = (parallelId: number): number => {
		// Obtener las preferencias usadas SOLO en este paralelo
		const selectionsInParallel = selections.filter(
			(s) => s.parallelId === parallelId
		);
		const usedPreferences = selectionsInParallel.map((s) => s.preference);

		for (let i = 1; i <= 3; i++) {
			if (!usedPreferences.includes(i)) {
				return i;
			}
		}
		return 0; // Todas las preferencias están usadas en este paralelo
	};

	const getSelectionsForParallel = (parallelId: number): Selection[] => {
		return selections
			.filter((s) => s.parallelId === parallelId)
			.sort((a, b) => a.preference - b.preference);
	};

	const hasAllParallelSelections = (): boolean => {
		// Verificar que cada paralelo tenga al menos 1 selección
		return paralelos.every((paralelo) => {
			return getSelectionsForParallel(paralelo.id).length >= 1;
		});
	};

	const handleSubmit = async () => {
		if (!hasAllParallelSelections()) {
			let message = `Debes seleccionar al menos 1 curso por cada paralelo.\n\n`;
			paralelos.forEach((paralelo) => {
				const count = getSelectionsForParallel(paralelo.id).length;
				const status = count >= 1 ? "✓" : "✗";
				message += `${status} ${paralelo.nombre}: ${
					count >= 1 ? "Completo" : "Falta selección"
				}\n`;
			});
			alert(message);
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch("/api/selections", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					selections: selections.map((s) => ({
						courseId: s.courseId, // Ya es string UUID
						preference: s.preference,
					})),
				}),
			});

			if (response.ok) {
				let message = "Selección guardada correctamente!\n\n";
				paralelos.forEach((paralelo) => {
					const paraleloSelections = getSelectionsForParallel(paralelo.id);
					message += `${paralelo.nombre}:\n`;
					paraleloSelections.forEach((s) => {
						message += `  ${s.preference}. ${s.courseName}\n`;
					});
					message += "\n";
				});
				alert(message);
			} else {
				const error = await response.json();
				alert(`Error al guardar: ${error.error || "Error desconocido"}`);
			}
		} catch (error) {
			console.error("Error:", error);
			alert("Error al conectar con el servidor");
		} finally {
			setIsLoading(false);
		}
	};

	// Función para obtener el icono según el tipo de asignación
	const getAssignmentIcon = (type: string) => {
		switch (type) {
			case "first":
				return "🥇";
			case "second":
				return "🥈";
			case "third":
				return "🥉";
			case "availability":
				return "📋";
			default:
				return "✓";
		}
	};

	// Función para obtener el texto según el tipo de asignación
	const getAssignmentText = (type: string) => {
		switch (type) {
			case "first":
				return "1ª preferencia";
			case "second":
				return "2ª preferencia";
			case "third":
				return "3ª preferencia";
			case "availability":
				return "Por disponibilidad";
			default:
				return "Asignado";
		}
	};

	return (
		<div
			className={`${styles.container} ${isContentLoaded ? styles.loaded : ""}`}
		>
			{/* Loading Overlay */}
			<div
				className={`${styles.loadingOverlay} ${
					isContentLoaded ? styles.hidden : ""
				}`}
			>
				<div className={styles.spinner}></div>
				<div className={styles.loadingText}>Cargando cursos...</div>
			</div>
			<div className={styles.header}>
				<h1 className={styles.title}>
					{showResults
						? "Mis Cursos Asignados"
						: "Dashboard - Selección de Cursos"}
				</h1>
				<div className={styles.headerActions}>
					{hasAssignments && (
						<button
							onClick={() => setShowResults(!showResults)}
							className={styles.toggleButton}
						>
							{showResults ? "Ver Selección" : "Ver Resultados"}
						</button>
					)}
					<button
						onClick={() => signOut({ callbackUrl: "/" })}
						className={styles.logoutButton}
					>
						Cerrar Sesión
					</button>
				</div>
			</div>

			{/* Sección de Resultados */}
			{showResults && hasAssignments && (
				<div
					className={`${styles.resultsSection} ${
						isContentLoaded ? styles.visible : ""
					}`}
				>
					<div className={styles.resultsHeader}>
						<h2>🎉 ¡Felicitaciones! Tus cursos han sido asignados</h2>
						<p className={styles.resultsSubtitle}>
							Has sido asignado a {assignments.length} cursos. A continuación,
							puedes ver el detalle de cada uno:
						</p>
					</div>

					<div className={styles.assignmentsGrid}>
						{[1, 2, 3].map((parallelNum) => {
							const assignment = assignments.find(
								(a) => a.parallel === parallelNum
							);
							if (!assignment) return null;

							return (
								<div key={assignment.id} className={styles.assignmentCard}>
									<div className={styles.assignmentParallel}>
										Paralelo {parallelNum}
									</div>
									<div className={styles.assignmentCourse}>
										{assignment.courseName}
									</div>
									<div className={styles.assignmentDetails}>
										<span className={styles.assignmentBadge}>
											{getAssignmentIcon(assignment.assignmentType)}{" "}
											{getAssignmentText(assignment.assignmentType)}
										</span>
										{assignment.isPriority && (
											<span className={styles.priorityBadge}>
												⭐ Prioritario
											</span>
										)}
									</div>
									<div className={styles.assignmentDate}>
										Asignado el:{" "}
										{new Date(assignment.assignedAt).toLocaleDateString(
											"es-CL",
											{
												year: "numeric",
												month: "long",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											}
										)}
									</div>
								</div>
							);
						})}
					</div>

					<div className={styles.resultsFooter}>
						<p>
							💡 <strong>Nota:</strong> Estos son tus cursos definitivos. Si
							tienes alguna consulta, contacta con la administración.
						</p>
					</div>
				</div>
			)}

			{/* Sección de Selección (solo si no se muestran resultados) */}
			{!showResults && (
				<div
					className={`${styles.paralelos} ${
						isContentLoaded ? styles.visible : ""
					}`}
				>
					{paralelos.map((paralelo) => (
						<div key={paralelo.id} className={styles.paralelo}>
							<h2 className={styles.paraleloTitle}>
								{paralelo.nombre}
								<span className={styles.paraleloCount}>
									({getSelectionsForParallel(paralelo.id).length})
									{getSelectionsForParallel(paralelo.id).length >= 1 && " ✓"}
								</span>
							</h2>
							<div className={styles.cursos}>
								{paralelo.cursos.map((curso) => (
									<CourseCard
										key={curso.id}
										id={curso.id}
										nombre={curso.nombre}
										parallelId={paralelo.id}
										currentPreference={getCoursePreference(curso.id)}
										nextAvailablePreference={getNextAvailablePreference(
											paralelo.id
										)}
										onSelect={handleSelectCourse}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Resumen de selecciones (solo si no se muestran resultados) */}
			{!showResults && selections.length > 0 && (
				<div
					className={`${styles.selectionSummary} ${
						isContentLoaded ? styles.visible : ""
					}`}
				>
					<h3>Tus selecciones:</h3>
					<div className={styles.summaryGrid}>
						{paralelos.map((paralelo) => {
							const paraleloSelections = getSelectionsForParallel(paralelo.id);
							if (paraleloSelections.length === 0) return null;
							return (
								<div key={paralelo.id} className={styles.summaryParallel}>
									<strong>
										{paralelo.nombre} {paraleloSelections.length >= 1 && "✓"}
									</strong>
									<ol>
										{paraleloSelections.map((s) => {
											let className = "";
											if (s.preference === 1) className = styles.firstChoice;
											else if (s.preference === 2)
												className = styles.secondChoice;
											else if (s.preference === 3)
												className = styles.thirdChoice;

											return (
												<li key={s.courseId} className={className}>
													{s.courseName}
												</li>
											);
										})}
									</ol>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Botón de envío (solo si no se muestran resultados) */}
			{!showResults && (
				<button
					className={`${styles.submitButton} ${
						isContentLoaded ? styles.visible : ""
					}`}
					onClick={handleSubmit}
					disabled={!hasAllParallelSelections() || isLoading}
				>
					{isLoading
						? "Guardando..."
						: `Enviar Selección${
								selections.length > 0 ? ` (${selections.length})` : ""
						  }`}
				</button>
			)}
		</div>
	);
}
