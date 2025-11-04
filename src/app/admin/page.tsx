"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import styles from "./Admin.module.css";
import dynamic from "next/dynamic";

const AssignmentReportViewer = dynamic(
	() => import("@/components/AssignmentReportViewer"),
	{ ssr: false }
);

interface AssignmentStats {
	totalStudents: number;
	totalAssignments: number;
	neurodivergentAssignments: number;
	fourthYearAssignments: number;
	thirdYearAssignments: number;
	lotteriesExecuted: number;
	studentsFullyAssigned: number;
	studentsPartiallyAssigned: number;
}

interface SelectionStats {
	totalStudents: number;
	studentsWithAnySelection: number;
	studentsCompletePreferences: number;
	studentsMissingAny: number;
}

interface MissingStudent {
	id: string;
	email: string | null;
	level?: number | null;
	selected_parallels: number;
	parallels?: number[] | null;
}

export default function AdminPage() {
	const [isExporting, setIsExporting] = useState(false);
	const [isAssigning, setIsAssigning] = useState(false);
	const [showReport, setShowReport] = useState(false);
	const [lastRunId, setLastRunId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [assignmentStats, setAssignmentStats] =
		useState<AssignmentStats | null>(null);
	const [selectionStats, setSelectionStats] = useState<SelectionStats | null>(
		null
	);
	const [missingStudents, setMissingStudents] = useState<
		MissingStudent[] | null
	>(null);
	const [loadingMissing, setLoadingMissing] = useState(false);
	const [showMissingModal, setShowMissingModal] = useState(false);
	const router = useRouter();
	const { data: session, status } = useSession();

	// Redirigir si no hay sesión o no es admin (doble capa de seguridad)
	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/");
		} else if (status === "authenticated" && session?.user?.role !== "admin") {
			router.push("/dashboard");
		}
	}, [status, session, router]);

	// Fetch selection stats (cuántos ya eligieron preferencias / faltan paralelo)
	useEffect(() => {
		let mounted = true;
		async function fetchSelectionStats() {
			try {
				const res = await fetch("/api/admin/students/preferences");
				if (!res.ok) return;
				const data = await res.json();
				if (mounted) {
					setSelectionStats({
						totalStudents: data.totalStudents || 0,
						studentsWithAnySelection: data.studentsWithAnySelection || 0,
						studentsCompletePreferences: data.studentsCompletePreferences || 0,
						studentsMissingAny: data.studentsMissingAny || 0,
					});
				}
			} catch (e) {
				console.error("Error fetching selection stats", e);
			}
		}

		fetchSelectionStats();
		return () => {
			mounted = false;
		};
	}, []);

	const fetchMissingStudents = async () => {
		try {
			setLoadingMissing(true);
			setMissingStudents(null);
			const res = await fetch("/api/admin/students/missing");
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err?.error || "Error al obtener lista de alumnos");
			}
			const data = await res.json();
			setMissingStudents(data.students || []);
			setShowMissingModal(true);
		} catch (e) {
			console.error("Error fetching missing students:", e);
			setMissingStudents([]);
			setShowMissingModal(true);
		} finally {
			setLoadingMissing(false);
		}
	};

	const handleExportCSV = async () => {
		try {
			setIsExporting(true);
			setError(null);
			setSuccessMessage(null);

			const response = await fetch("/api/admin/export", {
				method: "GET",
				headers: {
					"Content-Type": "text/csv",
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				if (response.status === 404) {
					throw new Error(
						"No hay asignaciones para exportar. Primero debes ejecutar la asignación de cursos usando el botón '🎯 Ejecutar Asignación de Cursos'."
					);
				}
				throw new Error(errorData.error || "Error al exportar");
			}

			// Obtener el nombre del archivo del header
			const contentDisposition = response.headers.get("Content-Disposition");
			let filename = "asignaciones.csv";

			if (contentDisposition) {
				const filenameMatch = contentDisposition.match(/filename="(.+)"/);
				if (filenameMatch) {
					filename = filenameMatch[1];
				}
			}

			// Descargar el archivo
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			setSuccessMessage(`✅ Archivo "${filename}" descargado correctamente`);
		} catch (err) {
			console.error("Error al exportar:", err);
			setError(err instanceof Error ? err.message : "Error desconocido");
		} finally {
			setIsExporting(false);
		}
	};

	const handleAssignCourses = async () => {
		if (
			!confirm(
				"⚠️ ADVERTENCIA: Esta acción eliminará todas las asignaciones previas y ejecutará una nueva asignación de cursos. ¿Deseas continuar?"
			)
		) {
			return;
		}

		try {
			setIsAssigning(true);
			setError(null);
			setSuccessMessage(null);
			setAssignmentStats(null);

			const response = await fetch("/api/admin/assignments/execute", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					clearPrevious: true,
					dryRun: false,
					notes: "Ejecución desde panel de administración",
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Error al ejecutar la asignación");
			}

			setSuccessMessage(
				`✅ Asignación completada exitosamente (Run ID: ${data.runId})`
			);
			setLastRunId(data.runId); // Guardar el ID del run para el informe

			// Mapear el nuevo formato de respuesta al formato esperado por el frontend
			const summary = data.summary || {};
			setAssignmentStats({
				totalStudents: summary.totalStudents || 0,
				totalAssignments: summary.totalAssignments || 0,
				neurodivergentAssignments: summary.neurodivergentAssignments || 0,
				fourthYearAssignments: summary.fourthYearAssignments || 0,
				thirdYearAssignments: summary.thirdYearAssignments || 0,
				lotteriesExecuted: summary.lotteriesExecuted || 0,
				studentsFullyAssigned: summary.studentsFullyAssigned || 0,
				studentsPartiallyAssigned: summary.studentsPartiallyAssigned || 0,
			});
		} catch (err) {
			console.error("Error al asignar cursos:", err);
			setError(err instanceof Error ? err.message : "Error desconocido");
		} finally {
			setIsAssigning(false);
		}
	};

	const handleViewReport = () => {
		if (lastRunId) {
			setShowReport(true);
		}
	};

	const handleLogout = async () => {
		await signOut({ callbackUrl: "/" });
	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h1 className={styles.title}>Panel de Administración</h1>
				<p className={styles.subtitle}>Sistema de Elección de Cursos</p>
				{session?.user && (
					<div className={styles.userSection}>
						<p className={styles.userInfo}>
							👤 {session.user.email} • 🔐 {session.user.role}
						</p>
						<button
							onClick={handleLogout}
							className={styles.logoutButton}
							title="Cerrar sesión"
						>
							🚪 Cerrar Sesión
						</button>
					</div>
				)}
			</div>

			<div className={styles.content}>
				{error && (
					<div className={styles.alert + " " + styles.alertError}>
						❌ {error}
					</div>
				)}
				{successMessage && (
					<div className={styles.alert + " " + styles.alertSuccess}>
						{successMessage}
					</div>
				)}
				{selectionStats && (
					<div className={styles.statsCard}>
						<h3 className={styles.statsTitle}>
							📥 Estado de Preferencias (Todos los Estudiantes)
						</h3>
						<div className={styles.statsGrid}>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Total de estudiantes registrados
								</span>
								<span className={styles.statValue}>
									{selectionStats.totalStudents}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Ya eligieron preferencias (3 paralelos)
								</span>
								<span className={styles.statValue}>
									{selectionStats.studentsCompletePreferences}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Aún falta elegir algún paralelo
								</span>
								<span className={styles.statValue}>
									{selectionStats.studentsMissingAny}
								</span>
							</div>
						</div>
						<div className={styles.info} style={{ marginTop: "1rem" }}>
							<p style={{ fontSize: "0.85rem", margin: 0, color: "#666" }}>
								ℹ️ Los estudiantes que no completaron sus preferencias serán
								asignados a los cursos que tengan cupos disponibles al final de
								las asignaciones.
							</p>
						</div>

						{/* Botón para ver la lista de alumnos que aún faltan elegir algún paralelo */}
						{selectionStats.studentsMissingAny > 0 && (
							<div style={{ marginTop: "1rem" }}>
								<button
									onClick={fetchMissingStudents}
									disabled={loadingMissing}
									className={styles.button + " " + styles.buttonOutline}
								>
									{loadingMissing
										? "⏳ Cargando..."
										: "👀 Ver alumnos sin preferencias"}
								</button>
							</div>
						)}
					</div>
				)}{" "}
				{assignmentStats && (
					<div className={styles.statsCard}>
						<h3 className={styles.statsTitle}>
							📊 Estadísticas de Asignación (Última Ejecución)
						</h3>
						<div className={styles.statsGrid}>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Estudiantes procesados:
								</span>
								<span className={styles.statValue}>
									{assignmentStats.totalStudents}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>Total de asignaciones:</span>
								<span className={styles.statValue}>
									{assignmentStats.totalAssignments}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Asignaciones neurodivergentes:
								</span>
								<span className={styles.statValue}>
									{assignmentStats.neurodivergentAssignments}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Asignaciones 4to medio:
								</span>
								<span className={styles.statValue}>
									{assignmentStats.fourthYearAssignments}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Asignaciones 3ro medio:
								</span>
								<span className={styles.statValue}>
									{assignmentStats.thirdYearAssignments}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>Sorteos ejecutados:</span>
								<span className={styles.statValue}>
									{assignmentStats.lotteriesExecuted}
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Completamente asignados:
								</span>
								<span className={styles.statValue}>
									{assignmentStats.studentsFullyAssigned}/
									{assignmentStats.totalStudents}(
									{Math.round(
										(assignmentStats.studentsFullyAssigned /
											assignmentStats.totalStudents) *
											100
									)}
									%)
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>
									Parcialmente asignados:
								</span>
								<span className={styles.statValue}>
									{assignmentStats.studentsPartiallyAssigned}
								</span>
							</div>
						</div>
					</div>
				)}
				<div className={styles.section}>
					<h2 className={styles.sectionTitle}>🎯 Asignar Cursos</h2>
					<p className={styles.sectionDescription}>
						Ejecuta el algoritmo de asignación automática de cursos. Este
						proceso:
					</p>
					<ul className={styles.featureList}>
						<li>✅ Prioriza estudiantes neurodivergentes</li>
						<li>✅ Luego estudiantes de 4to medio</li>
						<li>✅ Finalmente estudiantes de 3ro medio</li>
						<li>✅ Asigna 1 curso por paralelo a cada estudiante</li>
						<li>✅ Ejecuta sorteos automáticos cuando hay sobrecupo</li>
						<li>
							⚠️ <strong>ELIMINA todas las asignaciones previas</strong>
						</li>
					</ul>

					<button
						onClick={handleAssignCourses}
						disabled={isAssigning}
						className={styles.button + " " + styles.buttonPrimary}
					>
						{isAssigning
							? "⏳ Asignando cursos..."
							: "🎯 Ejecutar Asignación de Cursos"}
					</button>

					{lastRunId && (
						<button
							onClick={handleViewReport}
							className={styles.button + " " + styles.buttonSecondary}
							style={{ marginTop: "1rem" }}
						>
							📋 Ver Informe Detallado de Asignación
						</button>
					)}
				</div>
				<div className={styles.section}>
					<h2 className={styles.sectionTitle}>📊 Exportar Resultados</h2>
					<p className={styles.sectionDescription}>
						Descarga un archivo CSV con todas las asignaciones de cursos,
						incluyendo datos de estudiantes y cursos.
					</p>

					<button
						onClick={handleExportCSV}
						disabled={isExporting}
						className={styles.button + " " + styles.buttonPrimary}
					>
						{isExporting
							? "⏳ Exportando..."
							: "📥 Descargar CSV de Asignaciones"}
					</button>

					<div className={styles.info}>
						<p>
							<strong>El archivo CSV incluye:</strong>
						</p>
						<ul>
							<li>Email del estudiante</li>
							<li>Nivel (3º o 4º medio)</li>
							<li>Estado neurodivergente</li>
							<li>Curso asignado</li>
							<li>Paralelo (1, 2 o 3)</li>
							<li>
								Tipo de asignación (1ª, 2ª, 3ª preferencia o disponibilidad)
							</li>
							<li>Orden de preferencia</li>
							<li>Indicador de prioridad</li>
							<li>Fecha y hora de asignación</li>
						</ul>
					</div>
				</div>
				{showReport && lastRunId && (
					<div className={styles.section}>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "1rem",
							}}
						>
							<h2 className={styles.sectionTitle}>
								📋 Informe Detallado de Asignación
							</h2>
							<button
								onClick={() => setShowReport(false)}
								className={styles.button + " " + styles.buttonOutline}
								style={{ padding: "0.5rem 1rem" }}
							>
								✖️ Cerrar Informe
							</button>
						</div>
						<AssignmentReportViewer initialRunId={lastRunId} />
					</div>
				)}
				{showMissingModal && (
					// Modal simple para mostrar lista de estudiantes
					<div
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: "rgba(0,0,0,0.5)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							zIndex: 9999,
						}}
						onClick={() => setShowMissingModal(false)}
					>
						<div
							onClick={(e) => e.stopPropagation()}
							style={{
								background: "#fff",
								padding: "1.25rem",
								borderRadius: 8,
								maxWidth: "800px",
								width: "90%",
								maxHeight: "80%",
								overflow: "auto",
							}}
						>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "0.5rem",
								}}
							>
								<h3 style={{ margin: 0 }}>
									📋 Alumnos sin todas las preferencias
								</h3>
								<button
									className={styles.button + " " + styles.buttonOutline}
									onClick={() => setShowMissingModal(false)}
								>
									✖️ Cerrar
								</button>
							</div>
							{missingStudents && missingStudents.length > 0 ? (
								<table style={{ width: "100%", borderCollapse: "collapse" }}>
									<thead>
										<tr
											style={{
												textAlign: "left",
												borderBottom: "1px solid #eee",
											}}
										>
											<th style={{ padding: "0.5rem" }}>Email</th>
											<th style={{ padding: "0.5rem" }}>Nivel</th>
											<th style={{ padding: "0.5rem" }}>
												Paralelos seleccionados
											</th>
										</tr>
									</thead>
									<tbody>
										{missingStudents.map((s) => (
											<tr
												key={s.id}
												style={{ borderBottom: "1px solid #f5f5f5" }}
											>
												<td style={{ padding: "0.5rem" }}>{s.email}</td>
												<td style={{ padding: "0.5rem" }}>{s.level ?? "-"}</td>
												<td
													style={{
														padding: "0.5rem",
														display: "flex",
														gap: "0.5rem",
													}}
												>
													{[1, 2, 3].map((p) => {
														const isChecked =
															Array.isArray(s.parallels) &&
															s.parallels.includes(p);
														return (
															<label
																key={p}
																style={{
																	display: "flex",
																	alignItems: "center",
																	gap: "0.5rem",
																	cursor: "default",
																}}
															>
																<span
																	role="img"
																	aria-hidden={!isChecked}
																	className={
																		isChecked
																			? `${styles.greenCheckbox} ${styles.checked}`
																			: styles.greenCheckbox
																	}
																	aria-label={
																		isChecked
																			? `Paralelo ${p} seleccionado`
																			: `Paralelo ${p} no seleccionado`
																	}
																>
																	{isChecked && (
																		<svg
																			viewBox="0 0 24 24"
																			xmlns="http://www.w3.org/2000/svg"
																			aria-hidden="true"
																			focusable="false"
																		>
																			<path
																				fill="none"
																				stroke="#fff"
																				strokeWidth="2.5"
																				strokeLinecap="round"
																				strokeLinejoin="round"
																				d="M5 13l4 4L19 7"
																			/>
																		</svg>
																	)}
																</span>
																<span style={{ fontSize: "0.95rem" }}>{p}</span>
															</label>
														);
													})}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<p>
									No se encontraron alumnos (o hubo un error al obtener la
									lista).
								</p>
							)}
						</div>
					</div>
				)}
				<div className={styles.section}>
					<button
						onClick={() => router.push("/dashboard")}
						className={styles.button + " " + styles.buttonOutline}
					>
						← Volver al Dashboard
					</button>
				</div>
			</div>
		</div>
	);
}
