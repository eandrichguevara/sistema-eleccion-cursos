"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./AssignmentProgressLog.module.css";

type RunStatus = "idle" | "running" | "completed" | "failed";

type StatusResponse = {
	runId?: string;
	status?: RunStatus;
	progress?: number; // 0..100
	logs?: string[];
	lastUpdated?: string;
};

interface AssignmentProgressLogProps {
	runId?: string;
	// URL to poll; defaults to /api/admin/assignments/status?runId=...
	pollUrl?: string;
	pollIntervalMs?: number;
}

export default function AssignmentProgressLog({
	runId,
	pollUrl,
	pollIntervalMs = 2000,
}: AssignmentProgressLogProps) {
	const [status, setStatus] = useState<RunStatus>("idle");
	const [progress, setProgress] = useState<number>(0);
	const [logs, setLogs] = useState<string[]>([]);
	const [isPolling, setIsPolling] = useState<boolean>(true);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const effectivePollUrl = (rid?: string) => {
			if (pollUrl)
				return pollUrl + (rid ? `?runId=${encodeURIComponent(rid)}` : "");
			return `/api/admin/assignments/status${
				rid ? `?runId=${encodeURIComponent(rid)}` : ""
			}`;
		};

		let mounted = true;
		let intervalId: number | undefined;
		const pollOnce = async () => {
			try {
				const url = effectivePollUrl(runId);
				const res = await fetch(url, { cache: "no-store" });
				if (!res.ok) {
					// ignore non-200 for now
					return;
				}
				const data: StatusResponse = await res.json();
				if (!mounted) return;
				if (data.status) setStatus(data.status);
				if (typeof data.progress === "number")
					setProgress(Math.max(0, Math.min(100, Math.round(data.progress))));
				if (Array.isArray(data.logs)) {
					setLogs((prev) => {
						// append new logs, but dedupe by exact string to avoid duplicates
						const merged = [...prev];
						for (const ln of data.logs ?? []) {
							if (!merged.includes(ln)) merged.push(ln);
						}
						return merged;
					});
				}
			} catch {
				// ignore poll errors
			}
		};

		if (isPolling) {
			// initial poll immediately
			pollOnce();
			intervalId = window.setInterval(pollOnce, pollIntervalMs);
		}

		return () => {
			mounted = false;
			if (intervalId) window.clearInterval(intervalId);
		};
	}, [isPolling, runId, pollUrl, pollIntervalMs]);

	useEffect(() => {
		// auto-scroll when logs change
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [logs]);

	const handleClear = () => setLogs([]);
	const togglePolling = () => setIsPolling((v) => !v);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div>
					<div className={styles.title}>
						Registro de Progreso de Asignaciones
					</div>
					<div className={styles.smallMuted}>
						{runId ? `Run: ${runId}` : "Run: (no especificado)"}
					</div>
				</div>
				<div className={styles.controls}>
					<button className={styles.button} onClick={togglePolling}>
						{isPolling ? "Pausar" : "Continuar"}
					</button>
					<button
						className={styles.button}
						onClick={handleClear}
						disabled={logs.length === 0}
					>
						Limpiar
					</button>
				</div>
			</div>

			<div className={styles.statusLine}>
				Estado: <strong>{status}</strong> — Progreso:{" "}
				<strong>{progress}%</strong>
			</div>

			<div className={styles.progressBar} aria-hidden>
				<div
					className={styles.progressFill}
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div ref={scrollRef} className={styles.logList}>
				{logs.length === 0 ? (
					<div className={styles.logLine}>No hay eventos todavía.</div>
				) : (
					logs.map((ln, idx) => (
						<div key={idx} className={styles.logLine}>
							{ln}
						</div>
					))
				)}
			</div>
		</div>
	);
}
