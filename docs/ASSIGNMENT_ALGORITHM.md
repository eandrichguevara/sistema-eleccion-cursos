## Assignment algorithm — technical documentation

This document describes the deterministic, transactional and auditable assignment algorithm implemented in this repository. It explains the high-level flow, the data contracts, the reproducible RNG mechanics, validation and failure modes, and where to find key code modules.

---

## Quick summary

- Purpose: assign up to 3 courses per student (one per parallel 1..3) using prioritized phases and reproducible lotteries when courses are oversubscribed.
- Properties: deterministic (seeded RNG), transactional (single DB transaction for main assignment writes + audit logs), auditable (lotteries, swaps and per-student logs persisted).

## Contract (inputs / outputs)

- Inputs

  - students: Array of Student objects with fields: `id`, `email`, `is_neurodivergent`, `level`, `selections[]` (each selection contains `course_id`, `preference_order`, `courses:{id,name,parallel}`).
  - courses: Array of CourseCapacity objects: `{ courseId, courseName, parallel, capacity, assignedCount }`.
  - assignmentRunId?: string (optional run id for auditing).
  - requestIp, userAgent: optional metadata for audit logs.
  - dryRun?: boolean — if true the endpoint may return success but will not finalize side-effects (some audit writes may still occur depending on implementation).

- Outputs
  - summary: object containing totals per phase and integrity status.
  - problems: array of integrity/conflict objects if any students are missing assignments or there are duplicates.

## High-level flow (phases)

1. Start run: create `assignment_run` record (metadata.status = "running").
2. Build internal maps: Course capacity map and empty studentAssignments map.
3. Phase A — Priority assignments
   - 1st preference: neurodivergent students (per parallel 1..3). If oversubscribed => lottery.
   - 1st preference: 4th year non-neurodivergent.
   - 1st preference: 3rd year non-neurodivergent.
4. Phase B — Fallbacks for those who lost earlier lotteries
   - For neurodivergent: try preference 2, then 3; per parallel with lottery when needed.
   - For 4th year, then 3rd year: same fallback logic.
5. Phase C — Backup fill
   - For remaining students who still lack assignments, perform reproducible shuffle and allocate remaining seats by round-robin over shuffled courses.
6. Validation and audit
   - Detect and record conflicts (missing parallels, duplicate course assignments, multiple courses in same parallel).
   - Assert final integrity; if failures exist, record them and mark `assignment_runs` metadata accordingly.
7. Finalize run
   - Persist textual report to `assignment_logs` and update `assignment_runs.metadata` with `completed_at`, `duration_seconds`, `lotteries_executed`.

## Detailed flowchart (Mermaid)

```mermaid
flowchart TD
  A[Start assignment run] --> B[Load students & courses]
  B --> C[Build course capacity map]
  C --> D[Phase A: Priority - Neurodivergent 1st prefs]
  D --> E{Oversubscription?}
  E -- yes --> F[Pick winners (seeded RNG)]
  E -- no --> G[Assign all eligible]
  F --> H[Record lottery & per-student logs]
  G --> H
  H --> I[Update assigned counts & studentAssignments]
  I --> J[Phase A: 4th year 1st prefs]
  J --> K[Phase A: 3rd year 1st prefs]
  K --> L[Identify students needing assignments]
  L --> M[Phase B: Fallbacks (2nd then 3rd) per group]
  M --> N[Phase C: Backup fill remaining]
  N --> O[Detect & record conflicts]
  O --> P{problems?}
  P -- yes --> Q[Mark run completed_with_issues + persist report]
  P -- no --> R[Mark run completed + persist report]
  Q --> S[Return result (422 if not dryRun, else 200 with warning)]
  R --> S
  S --> T[End]

```

## Reproducible RNG and audit details

- RNG elements: `xmur3` (seed -> int) + `mulberry32` (uint32 PRNG) implement deterministic shuffles.
- Utility functions:
  - `shuffleWithSeed(array, seed)` returns `{ shuffled, swaps, seedUsed }`.
  - `pickWinners(array, winnersCount, seed)` returns `{ winners, losers, seedUsed, swaps }`.
- Every lottery records:
  - `lotteries` row (with `lottery_results` children), and
  - `assignment_logs` summary and per-student entries with `details` containing `seedUsed` and `swaps` for full reproducibility.

Files: see `src/lib/shuffle.ts` and `src/lib/audit-logger.ts`.

## Validation rules (business invariants)

- Each student must have exactly 3 assigned courses (one for each parallel 1,2,3).
- No duplicate course assignment per student.
- No more than one course assigned to the same parallel for a student.
- Each course must not exceed its capacity (enforced during assignment updates).

Validation helpers:

- `validateFinalAssignmentsIntegrity(prismaClient?)` — returns array of per-student problems.
- `assertFinalAssignmentsIntegrity(prismaClient?)` — throws if any problems exist.
- `detectAndRecordAssignmentConflicts({...})` — runs validation and persists `assignment_logs` for conflicts.

Files: `src/lib/assignment-validators.ts`, `src/lib/audit-logger.ts`.

## Failure and rollback behavior

- The main assignment orchestration runs inside `prisma.$transaction(...)`. If any error is thrown inside that callback, Prisma rolls back all DB changes made within the transaction.
- After a transaction failure the runner attempts to write a failure log outside the transaction (best-effort) to keep an audit trail.
- If audits or report persistence fail after the transaction (e.g., missing tables due to migrations), the code logs the error but does not rethrow, to avoid masking the original run result.

## Where the code lives (key modules)

- Orchestrator: `src/lib/assignment-runner.ts`
- Priority phase logic + fallbacks + backup: `src/lib/priority-assignments.ts`
- Shuffle & RNG: `src/lib/shuffle.ts`
- Audit logging (lotteries + logs): `src/lib/audit-logger.ts`
- Validators: `src/lib/assignment-validators.ts`
- Report generation: `src/lib/assignment-report.ts`
- Endpoint to trigger run: `src/app/api/admin/assignments/execute/route.ts`
- Debug logger for structured JSON logs: `src/lib/debug-logger.ts`

## Edge cases and notes

- Missing tables (migrations not applied): code attempts best-effort writes using `(prisma as any)` and guards — until migrations are applied the typed client may be unavailable.
- Determinism requires using the exact same seeds and input ordering; seeds are derived from `assignmentRunId`, course id and timestamps. For strict reproducibility use the debug runner `scripts/run-assignment-debug.ts` which accepts `--seed`.
- Race conditions: endpoint prevents concurrent runs by checking `assignment_runs` metadata where possible (best-effort if table exists).

## Testing & verification

1. Unit tests: see `src/lib/*.test.ts` (shuffle, validators, priority groups).
2. Integration test: `src/lib/integration-assignment.test.ts` runs the full flow in-memory for a mocked dataset.
3. Debug runner: `scripts/run-assignment-debug.ts --seed <value>` reproduces shuffles and logs swaps for inspection.
4. Manual: trigger endpoint `POST /api/admin/assignments/execute` (prefer `dryRun: true` when validating) and inspect `assignment_logs` and `lotteries` tables.

## Quick troubleshooting

- If `npx prisma migrate dev` fails with shadow DB errors, set `SHADOW_DATABASE_URL` to a fresh DB and re-run (see repo notes and previous instructions in this workspace).
- If `prisma generate` has not run, code may use `(prisma as any)` casts; after running migrations/generate, replace `any` casts and re-run TypeScript build.

## Suggested next improvements

- Add an endpoint to download per-run conflict details and the textual report (there is a download endpoint for reports, but a dedicated `/:runId/problems` endpoint would be useful).
- Add a deterministic seed policy (e.g., store `seed` in `assignment_runs` at creation so all derived seeds are deterministic without Date.now calls).
- Add e2e tests that run the endpoint against a disposable test database to assert transactional behavior.

---

Revision: 2025-11-03 — created by automation. For clarifications or additional diagrams (sequence diagrams, swimlanes), request which view you prefer.
