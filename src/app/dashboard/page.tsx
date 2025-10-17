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
	course: {
		name: string;
		parallel: number;
	};
};

export default function Dashboard() {
	const [selections, setSelections] = useState<Selection[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isContentLoaded, setIsContentLoaded] = useState(false);

	// Datos de ejemplo hardcodeados con IDs UUID de la base de datos
	const paralelos = [
		{
			id: 1,
			nombre: "Paralelo 1",
			cursos: [
				{
					id: "e4918312-919b-4e4b-a18d-ba4a01a26822",
					nombre: "Matemáticas Avanzadas",
				},
				{
					id: "79142fe9-a91f-4a06-8342-24aef66cdbfe",
					nombre: "Física Cuántica",
				},
				{
					id: "e98b982b-63d5-4358-8697-58d7c7d0ddaa",
					nombre: "Química Orgánica",
				},
				{
					id: "d493ef1f-a176-4b19-9c66-52302b33797d",
					nombre: "Programación I",
				},
			],
		},
		{
			id: 2,
			nombre: "Paralelo 2",
			cursos: [
				{
					id: "91ed4c4a-48c8-427f-9b25-086b0624c0bd",
					nombre: "Literatura Contemporánea",
				},
				{
					id: "75256b5e-cec6-4d07-9cc9-263da6590325",
					nombre: "Historia Universal",
				},
				{
					id: "afa61754-2b9e-431c-b714-7378f61d7b21",
					nombre: "Biología Molecular",
				},
				{
					id: "ece30772-f050-4f94-a293-ca7a3d0492ef",
					nombre: "Inglés Avanzado",
				},
			],
		},
		{
			id: 3,
			nombre: "Paralelo 3",
			cursos: [
				{
					id: "5a9075ff-c92f-488d-a231-a1c85b1f8dae",
					nombre: "Economía Global",
				},
				{
					id: "78e3e9b5-f3f7-4560-8121-1c70cc1d0a59",
					nombre: "Estadística Aplicada",
				},
				{
					id: "dd474111-8e97-4d5b-b7d5-5c4b272ff0cc",
					nombre: "Diseño Digital",
				},
				{
					id: "7a9abf9d-38a0-429a-ad98-e30ca093a6b1",
					nombre: "Bases de Datos",
				},
			],
		},
	];

	// Cargar selecciones previas al montar el componente
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
								courseName: sel.course.name,
								parallelId: sel.course.parallel,
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

		// Primero cargar las selecciones
		loadSelections().then(() => {
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
				<h1 className={styles.title}>Dashboard - Selección de Cursos</h1>
				<button
					onClick={() => signOut({ callbackUrl: "/" })}
					className={styles.logoutButton}
				>
					Cerrar Sesión
				</button>
			</div>
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
			{selections.length > 0 && (
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
			)}{" "}
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
		</div>
	);
}
