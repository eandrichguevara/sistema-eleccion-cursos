# Guía de mantenimiento y extensión del algoritmo de asignación

Esta guía explica la arquitectura del motor de asignación, cómo mantenerlo, cómo añadir o modificar fases del algoritmo, y buenas prácticas para despliegue, pruebas y auditoría.

## 1. Resumen de arquitectura (alto nivel)

- Stack principal: TypeScript, Next.js (App Router), Prisma ORM, PostgreSQL.
- Componentes clave:
  - `src/lib/assignment-runner.ts` — Orquestador principal. Ejecuta fases en orden, coordina transacción y persiste reportes.
  - `src/lib/priority-assignments.ts` — Implementa fases de prioridad (neurodivergentes, 4º, 3º, fallback, backup).
  - `src/lib/lottery-runner.ts` — Lógica de sorteos, usa shuffle/pickWinners.
  - `src/lib/shuffle.ts` — RNG reproducible (xmur3 + mulberry32) y Fisher–Yates con registro de swaps.
  - `src/lib/audit-logger.ts` — Persiste `lotteries`, `lottery_results` y `assignment_logs`.
  - `src/lib/assignment-report.ts` — Genera reportes de texto/JSON/CSV.
  - `src/lib/ports.ts` — Interfaces (AuditClient) para inyección de dependencias (mocks en tests).
  - `prisma/migrations/*` — Migraciones DB (incluye `assignment_runs` y `assignment_logs`).
  - API endpoints bajo `src/app/api/admin/assignments/...` para ejecutar y descargar reportes.
- Datos de auditoría:
  - `assignment_runs` con `metadata` JSON — ahora contiene `started_at`, `completed_at`, `duration_seconds`, `status`, `checkpoints`, `problems_count`, etc.
  - Checkpoints persistidos en `assignment_runs.metadata.checkpoints` para inspección y reanudación.

---

## 2. Quick start (desarrollo local)

- Iniciar app:

```bash
# instalar dependencias (si corresponde)
npm install

# correr Next.js en modo dev
npm run dev
```

- Correr tests:

```bash
npm test
# o si usas vitest:
npx vitest
```

- Ejecutar migraciones (nota: migraciones pueden estar bloqueadas por issue del shadow DB — ver sección 4):

```bash
npx prisma migrate dev --name add_audit_fields
npx prisma generate
```

---

## 3. Cómo añadir o modificar una fase del algoritmo (ejemplo: nueva prioridad "teacher_recommendation")

**Contrato/contratos a respetar:**

- Input: array de estudiantes con sus `selections` y `level`, y mapa de `CourseCapacity`.
- Efectos: asignaciones actualizadas en memoria (arrays `studentAssignments`, `allAssignments`) y llamadas de auditoría (via AuditClient/prisma tx) con `assignmentRunId`.
- Debe ser idempotente dentro de la ejecución: si se ejecuta dos veces en la misma run no debe duplicar logs o causar over-assignment.

**Pasos concretos:**

1. Añade una función en `src/lib/priority-assignments.ts` con firma similar a las otras:
   - `async function assignTeacherRecommendations(students, courseCapMap, studentAssignments, allAssignments, assignmentRunId, { requestIp, userAgent, prismaClient })`
2. Dentro de la función:
   - Filtra a los estudiantes relevantes.
   - Usa `lottery-runner` o `shuffle` si hay competencia por cupos.
   - Registra decisiones con `auditClient` (o `prismaClient` dentro de la tx) llamando a la función de log existente.
   - Actualiza `studentAssignments` y `allAssignments` in-memory.
3. Desde `executeAssignmentAlgorithm`:
   - Inserta la llamada a la nueva fase en el orden deseado.
   - Llama a `persistCheckpoint(assignmentRunId, "teacher_recommendation", res)` inmediatamente después.
4. Añade tests unitarios que:
   - Simulen conflicto por cupo y verifiquen la selección reproducible (seeded).
   - Mockeen `AuditClient` y verifiquen que se llamen los métodos de log esperados.

**Checklist de PR:**

- Añade docstring en la función explicando invariants.
- Añade una entrada en `docs/ASSIGNMENT_ALGORITHM.md` describiendo la fase.
- Añade test(s) para happy path y 1-2 edge cases.
- Ejecuta linter/TS y corrige errores.

---

## 4. Resolver problemas comunes con Prisma (shadow DB P3006)

**Sintoma:** `npx prisma migrate dev` o `npx prisma generate` falla con P3006: shadow DB relation 'students' already exists.

**Causas comunes:**

- Shadow DB no limpia correctamente y contiene objetos antiguos.
- Múltiples procesos concurrentes utilizando la misma shadow DB.
- Cambios manuales en la BD que confunden migración.

**Soluciones:**

- Opción segura (no preserva datos): reset local DB (si puedes perder datos):

```bash
npx prisma migrate reset --force
npx prisma generate
```

- Opción con shadow DB separado (recomendado cuando no quieres resetear BD):
  1. Crea una nueva BD vacía en tu Postgres (ej: `sistema_shadow`).
  2. Ejecuta migrate especificando shadow DB:

```bash
npx prisma migrate dev --name add_audit_fields --shadow-database-url="postgresql://user:pass@localhost:5432/sistema_shadow"
npx prisma generate
```

- Si usas Docker Compose, puedes temporalmente levantar un contenedor Postgres adicional y usar su URL como shadow DB.
- Si el problema persiste, inspecciona la relación objeto mencionada, y considera dropear manualmente la relación en el shadow DB si sabes lo que haces.

**Notas:**

- Tras aplicar migraciones correctamente, reemplaza cualquier `(prisma as any)` por el cliente tipado y corrige warnings TS.
- Añade `SHADOW_DATABASE_URL` a tus .env para evitar repetir el flag en comandos.

---

## 5. Checkpoints — cómo funcionan y cómo extenderlos

- Implementación actual: helper `persistCheckpoint(assignmentRunId, phase, payload)` que añade entries a `assignment_runs.metadata.checkpoints` con { phase, timestamp, payload }.
- Uso:
  - Tras cada fase en `executeAssignmentAlgorithm` se llama a `persistCheckpoint(...)`.
  - Checkpoints sirven para:
    - Auditar decisiones intermedias.
    - Habilitar "resume" (futuro): si una ejecución falla, podemos leer checkpoints y saltar fases ya completadas.
- Extender:
  - Reduce el payload para evitar almacenar grandes objetos; preferir resúmenes (counts, sample ids) y/o paths a artefactos en almacenamiento (S3) si necesitas dumps pesados.
  - Asegúrate de que `payload` sea JSON-serializable. Evita referencias circulares o funciones.

**Resumen checkpoint payload sugerido:**

- `phase`: string
- `timestamp`: ISO
- `summary`: { assignedCount, unassignedCount, topConflicts: [...], seedUsed (opcional) }
- optional: `linkToDump` (if you store larger data externally)

---

## 6. Reanudación desde checkpoint (opcional — diseño)

- Idea: si existe checkpoint para fase X, marcar que puedes saltar todas las fases <= X.
- Requisitos:
  - El orquestador debe leer los checkpoints iniciales y calcular `lastCompletedPhase`.
  - Cada fase debe confirmar que no re-aplica efectos duplicados: preferir que las escrituras definitivas se hagan solo cuando la fase declare "commit" (o registrar un idempotency key).
- Recomendación incremental:
  1. Implementar lectura de checkpoints en `executeAssignmentAlgorithm` al inicio.
  2. Añadir un `if (lastCompletedPhase >= phaseIndex) { skip }` antes de ejecutar cada fase.
  3. Mantener audit logs idempotentes: por ejemplo, incluir `assignment_run_id` y `phase` en logs para evitar duplicados al reintentar.
  4. Agregar endpoint admin `POST /api/admin/assignments/resume` que acepte `assignmentRunId` y trate de reanudar.

---

## 7. Métricas y performance

- Ya se registra `duration_seconds` por run (in `assignment_runs.metadata`).
- Métricas adicionales a considerar:
  - Time per phase (add to metadata: `phase_durations: { neuro_first: 10, fourth_first: 5, ... }`)
  - Memory/peak RSS (if relevant) — require process instrumentation
  - Counts: students processed, lotteries executed, swaps logged
- Añadir time-per-phase:
  - Coloca un timer antes y después de cada fase y llama a `persistCheckpoint` con duration or aggregate durations into `metadata.phase_durations`.
- Exponer métricas:
  - Endpoint admin `GET /api/admin/assignments/metrics?runId=...`
  - Export to Prometheus / pushgateway if needed (for scheduled runs).

---

## 8. Auditoría y reproducibilidad

- Seed: derive seed from `assignmentRunId` or explicit seed stored in `assignment_runs.seed` for full reproducibility.
- Shuffle logs: `shuffle.ts` records swaps — persist these in `lotteries`/`lottery_results` to be able to replay the sorteo.
- To replay:
  - Load seed and swap log, apply swaps to initial ordering and reproduce winners.
- Ensure every change that affects randomness records a seed and optional swap log.

---

## 9. Tests recomendados

- Unit tests:
  - `shuffle` deterministic: same seed → same order (repeat 50 runs).
  - `pickWinners` with ties and edge sizes.
  - `priority-assignments` logic for small synthetic data sets.
- Integration tests:
  - Run `executeAssignmentAlgorithm` in-memory with mock `AuditClient` and assert:
    - Final integrity (3 assignments per student or explicit handling)
    - Correct `assignment_runs.metadata` fields exist: started_at, completed_at, duration_seconds, checkpoints
  - E2E in-memory: `scripts/run-e2e-inmemory.ts`
- Regression tests:
  - Add a snapshot test for the textual report after a fixed seed run.
- Test utilities:
  - Provide mocks for AuditClient and for `prismaClient` (transaction) so integration tests don't need DB.

---

## 10. Inyección de dependencias y mejor aislamiento (próximo refactor)

- Ya existe `AuditClient` en `src/lib/ports.ts`. Sugerencia:
  - Añadir `StorageClient` que agrupe operaciones DB que el runner usa (updateAssignmentRunMetadata, createAssignmentLog, createLotteries, etc.). Esto simplifica el mocking y reduce el uso de `(prisma as any)`.
  - Cambiar `executeAssignmentAlgorithm` para aceptar `context: { auditClient, storageClient }` con defaults al cliente real.
- Beneficio: tests pueden inyectar fakes que persisten a memoria; reduce fricción al corregir el Prisma shadow DB.

---

## 11. Buenas prácticas para PRs y cambios en producción

- PR Checklist mínimo:
  - Tests: añadir unidad o integración para la nueva lógica.
  - Documentación: actualizar `docs/ASSIGNMENT_ALGORITHM.md`.
  - Migraciones: si cambias schema, añade migración y describe cómo aplicarla localmente.
  - Seguridad: revisar que request IP / user agent / PII se registran solo según políticas.
  - Linter/TS: pasar `npm run lint` y `npm run build` localmente.
  - Remove temporary `(prisma as any)` before final merge if possible.
- Deploy checklist:
  - Ejecutar migraciones en staging con SHADOW_DATABASE_URL configurado.
  - Ejecutar full assignment run in staging with a copy of production-like dataset (or subset) and verify report & metadata.
  - Run smoke tests and check `assignment_runs` metadata fields.
  - If long-running, add monitoring/alerting (duration increases by X).

---

## 12. Seguridad y privacidad

- PII: `assignment_runs.metadata` may store `student counts` and non-sensitive summary. Avoid storing raw emails or sensitive data in free-form metadata unless necessary and ensure encryption/ACLs.
- Audit logs: treat `assignment_logs` as sensitive—they contain student assignment decisions; limit access.
- Access control: endpoints under `/api/admin` must be admin-only (already in code).

---

## 13. Ejemplo práctico: añadir medición por fase

1. En `executeAssignmentAlgorithm`, antes de fase:

```ts
const phaseStart = Date.now();
// run phase...
const phaseEnd = Date.now();
const phaseDuration = Math.round((phaseEnd - phaseStart) / 1000);
await persistCheckpoint(assignmentRunId, "neuro_first", {
	duration_seconds: phaseDuration,
	assignedCount: res1.count,
});
```

2. Agrega aggregación final:

- Actualiza `assignment_runs.metadata.phase_durations` con cada duración.

3. Exponer vía endpoint de métricas/report.

---

## 14. Troubleshooting rápido

- Si ves `Unexpected any` linter warnings: esto es temporal mientras el typed client no ha sido regenerado. Ejecuta `npx prisma generate` y reemplaza `(prisma as any)` por `prisma`.
- Si migraciones fallan con P3006: usa shadow db separado o reset local DB según tolerancia a pérdida de datos (ver sección 4).
- Si reportes no se guardan: revisar el bloque post-transaction en `assignment-runner` que llama a `saveAssignmentReportToAudit`. Revisar logs `assignment_report_error`.

---

## 15. Recursos y próximos pasos recomendados

- Prioridad inmediata:
  1. Resolver la incidencia de Prisma (P3006) para regenerar el cliente.
  2. Añadir un test de integración que verifique `duration_seconds` y `checkpoints`.
  3. (Opcional) Implementar resume-from-checkpoint básico.
- Mejoras a medio plazo:
  - Introducir `StorageClient`.
  - Exponer endpoint read-only para checkpoints y métricas.
  - Exportar métricas a Prometheus o similar para seguimiento histórico.
- Documentación viva:
  - Mantener `docs/ASSIGNMENT_ALGORITHM.md` y agregar ejemplos de uso y reproducción de sorteos.

---

Si quieres, puedo:

- A) Añadir un endpoint admin `GET /api/admin/assignments/:id/checkpoints` para leer checkpoints (implementar y testear).
- B) Escribir el test Vitest que confirme `duration_seconds` y al menos 1 checkpoint por run.
- C) Guiarte paso a paso para resolver el problema de Prisma (necesito que pegues tu DATABASE_URL / políticas o confirmes que puedes crear una DB temporal).

¿Qué quieres que haga ahora?
