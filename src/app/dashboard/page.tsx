"use client";

import { useState } from "react";
import styles from "./Dashboard.module.css";
import CourseCard from "@/components/CourseCard";

type Selection = {
	courseId: number;
	courseName: string;
	parallelId: number;
	preference: number;
};

export default function Dashboard() {
	const [selections, setSelections] = useState<Selection[]>([]);

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

	const handleSelectCourse = (
		courseId: number,
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

	const getCoursePreference = (courseId: number): number => {
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

	const handleSubmit = () => {
		if (hasAllParallelSelections()) {
			console.log("Selecciones:", selections);

			// Agrupar por paralelo para mostrar
			let message = "Selección enviada correctamente!\n\n";
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
			let message = `Debes seleccionar al menos 1 curso por cada paralelo.\n\n`;
			paralelos.forEach((paralelo) => {
				const count = getSelectionsForParallel(paralelo.id).length;
				const status = count >= 1 ? "✓" : "✗";
				message += `${status} ${paralelo.nombre}: ${
					count >= 1 ? "Completo" : "Falta selección"
				}\n`;
			});
			alert(message);
		}
	};

	return (
		<div className={styles.container}>
			<h1 className={styles.title}>Dashboard - Selección de Cursos</h1>
			<div className={styles.paralelos}>
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
				<div className={styles.selectionSummary}>
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
				className={styles.submitButton}
				onClick={handleSubmit}
				disabled={!hasAllParallelSelections()}
			>
				Enviar Selección {selections.length > 0 && `(${selections.length})`}
			</button>
		</div>
	);
}
