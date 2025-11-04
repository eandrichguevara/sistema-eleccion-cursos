"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./AssignmentReportViewer.module.css";

type LotteryDetail = {
	lotteryId: string;
	courseName: string;
	preference: number;
	candidates: Array<{ studentId: string; email: string; won: boolean }>;
};

type PriorityChange = {
	studentId: string;
	email: string;
	fromPreference: number;
	toPreference: number;
	assignedCourseName?: string;
};

type DashboardJSON = Record<string, unknown>;

export default function AssignmentReportViewer({
	initialRunId,
}: {
	initialRunId?: string;
}) {
	const [runId, setRunId] = useState<string | undefined>(initialRunId);
	const [summaryText, setSummaryText] = useState<string | null>(null);
	const [lotteries, setLotteries] = useState<LotteryDetail[] | null>(null);
	const [priorityChanges, setPriorityChanges] = useState<
		PriorityChange[] | null
	>(null);
	const [dashboard, setDashboard] = useState<DashboardJSON | null>(null);
	const [activeTab, setActiveTab] = useState<string>("summary");

	// filters
	const [prefFilter, setPrefFilter] = useState<string>("");
	const [courseFilter, setCourseFilter] = useState<string>("");
	const [emailFilter, setEmailFilter] = useState<string>("");

	useEffect(() => {
		// fetch summary to get latest run if runId not provided
		const fetchSummary = async () => {
			try {
				const res = await fetch("/api/admin/assignments/report", {
					cache: "no-store",
				});
				if (!res.ok) return;
				const data = await res.json();
				if (data?.success) {
					if (data.runId) setRunId(data.runId);
					setSummaryText(data.report ?? null);
				}
			} catch {
				// ignore
			}
		};
		fetchSummary();
	}, []);

	useEffect(() => {
		if (!runId) return;
		// try to load detailed endpoints; they may not exist if migrations aren't applied
		const fetchDetails = async () => {
			try {
				const [lotRes, priRes, dashRes] = await Promise.all([
					fetch(
						`/api/admin/assignments/lottery-details?runId=${encodeURIComponent(
							runId
						)}`,
						{ cache: "no-store" }
					),
					fetch(
						`/api/admin/assignments/priority-changes?runId=${encodeURIComponent(
							runId
						)}`,
						{ cache: "no-store" }
					),
					fetch(
						`/api/admin/assignments/dashboard?runId=${encodeURIComponent(
							runId
						)}`,
						{ cache: "no-store" }
					),
				]);

				if (lotRes.ok) {
					const d = await lotRes.json();
					setLotteries(d?.details ?? null);
				}
				if (priRes.ok) {
					const d = await priRes.json();
					setPriorityChanges(d?.changes ?? null);
				}
				if (dashRes.ok) {
					const d = await dashRes.json();
					setDashboard(d ?? null);
				}
			} catch {
				// ignore failures — endpoints are optional
			}
		};
		fetchDetails();
	}, [runId]);

	const filteredLotteries = useMemo(() => {
		if (!lotteries) return [];
		return lotteries.filter((l) => {
			if (prefFilter) {
				const pf = Number(prefFilter);
				if (Number.isFinite(pf) && l.preference !== pf) return false;
			}
			if (courseFilter) {
				if (!l.courseName.toLowerCase().includes(courseFilter.toLowerCase()))
					return false;
			}
			if (emailFilter) {
				const q = emailFilter.toLowerCase();
				if (!l.candidates.some((c) => c.email.toLowerCase().includes(q)))
					return false;
			}
			return true;
		});
	}, [lotteries, prefFilter, courseFilter, emailFilter]);

	const filteredPriority = useMemo(() => {
		if (!priorityChanges) return [];
		return priorityChanges.filter((p) => {
			if (emailFilter)
				if (!p.email.toLowerCase().includes(emailFilter.toLowerCase()))
					return false;
			return true;
		});
	}, [priorityChanges, emailFilter]);

	return (
		<div className={styles.container}>
			<div className={styles.tabs}>
				<button
					className={`${styles.tab} ${
						activeTab === "summary" ? styles.tabActive : ""
					}`}
					onClick={() => setActiveTab("summary")}
				>
					Resumen
				</button>
				<button
					className={`${styles.tab} ${
						activeTab === "lotteries" ? styles.tabActive : ""
					}`}
					onClick={() => setActiveTab("lotteries")}
				>
					Sorteos
				</button>
				<button
					className={`${styles.tab} ${
						activeTab === "priority" ? styles.tabActive : ""
					}`}
					onClick={() => setActiveTab("priority")}
				>
					Cambios de Preferencia
				</button>
				<button
					className={`${styles.tab} ${
						activeTab === "dashboard" ? styles.tabActive : ""
					}`}
					onClick={() => setActiveTab("dashboard")}
				>
					Dashboard
				</button>
			</div>

			{activeTab === "summary" && (
				<div>
					{!summaryText ? (
						<div className={styles.empty}>No hay resumen disponible.</div>
					) : (
						<pre className={styles.muted}>{summaryText}</pre>
					)}
				</div>
			)}

			{activeTab === "lotteries" && (
				<div>
					<div className={styles.filters}>
						<input
							className={styles.filterInput}
							placeholder="Preferencia (ej. 1)"
							value={prefFilter}
							onChange={(e) => setPrefFilter(e.target.value)}
						/>
						<input
							className={styles.filterInput}
							placeholder="Buscar curso"
							value={courseFilter}
							onChange={(e) => setCourseFilter(e.target.value)}
						/>
						<input
							className={styles.filterInput}
							placeholder="Buscar email"
							value={emailFilter}
							onChange={(e) => setEmailFilter(e.target.value)}
						/>
					</div>

					{!lotteries ? (
						<div className={styles.empty}>
							No hay detalles de sorteos disponibles. (Endpoint opcional no
							presente)
						</div>
					) : (
						<table className={styles.table}>
							<thead>
								<tr>
									<th className={styles.th}>Curso</th>
									<th className={styles.th}>Preferencia</th>
									<th className={styles.th}>Candidatos</th>
								</tr>
							</thead>
							<tbody>
								{filteredLotteries.map((l) => (
									<tr key={l.lotteryId}>
										<td className={styles.td}>{l.courseName}</td>
										<td className={styles.td}>{l.preference}</td>
										<td className={styles.td}>
											{l.candidates
												.map((c) => `${c.email}${c.won ? " (W)" : ""}`)
												.join(", ")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			)}

			{activeTab === "priority" && (
				<div>
					<div className={styles.filters}>
						<input
							className={styles.filterInput}
							placeholder="Buscar email"
							value={emailFilter}
							onChange={(e) => setEmailFilter(e.target.value)}
						/>
					</div>
					{!priorityChanges ? (
						<div className={styles.empty}>
							No hay detalles de cambios de prioridad disponibles.
						</div>
					) : (
						<table className={styles.table}>
							<thead>
								<tr>
									<th className={styles.th}>Email</th>
									<th className={styles.th}>De</th>
									<th className={styles.th}>A</th>
									<th className={styles.th}>Curso asignado</th>
								</tr>
							</thead>
							<tbody>
								{filteredPriority.map((p) => (
									<tr key={p.studentId}>
										<td className={styles.td}>{p.email}</td>
										<td className={styles.td}>{p.fromPreference}</td>
										<td className={styles.td}>{p.toPreference}</td>
										<td className={styles.td}>{p.assignedCourseName ?? "-"}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			)}

			{activeTab === "dashboard" && (
				<div>
					{!dashboard ? (
						<div className={styles.empty}>
							No hay dashboard JSON disponible.
						</div>
					) : (
						<pre className={styles.muted}>
							{JSON.stringify(dashboard, null, 2)}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}
