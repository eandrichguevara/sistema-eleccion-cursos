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

export default function AdminPage() {
	const [isExporting, setIsExporting] = useState(false);
	const [isAssigning, setIsAssigning] = useState(false);
	const [showReport, setShowReport] = useState(false);
	const [lastRunId, setLastRunId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [assignmentStats, setAssignmentStats] =
		useState<AssignmentStats | null>(null);
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

				{assignmentStats && (
					<div className={styles.statsCard}>
						<h3 className={styles.statsTitle}>📊 Estadísticas de Asignación</h3>
						<div className={styles.statsGrid}>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>Total de estudiantes:</span>
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
								<span className={styles.statLabel}>Neurodivergentes:</span>
								<span className={styles.statValue}>
									{assignmentStats.neurodivergentAssignments} cursos
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>4to medio:</span>
								<span className={styles.statValue}>
									{assignmentStats.fourthYearAssignments} cursos
								</span>
							</div>
							<div className={styles.statItem}>
								<span className={styles.statLabel}>3ro medio:</span>
								<span className={styles.statValue}>
									{assignmentStats.thirdYearAssignments} cursos
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
