/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";

type DebugOptions = {
	enabled?: boolean;
	file?: string | null;
};

let _enabled = false;
let _file: string | null = null;

export function init(options?: DebugOptions) {
	_enabled = options?.enabled ?? false;
	_file = options?.file ?? null;
	if (_file) {
		// ensure directory exists
		try {
			fs.mkdirSync(path.dirname(_file), { recursive: true });
		} catch {
			// ignore
		}
	}
}

export function isEnabled() {
	return _enabled;
}

export function log(event: string, payload: any) {
	if (!_enabled) return;

	const record = {
		ts: new Date().toISOString(),
		event,
		payload,
	};

	// Console-friendly output
	// Print to console (best-effort)
	try {
		console.log("[debug-log]", event, JSON.stringify(payload));
	} catch {
		// swallow
	}

	if (_file) {
		try {
			fs.appendFileSync(_file, JSON.stringify(record) + "\n", {
				encoding: "utf8",
			});
		} catch {
			// swallow file errors for robustness
		}
	}
}

const debugLogger = { init, isEnabled, log };
export default debugLogger;
