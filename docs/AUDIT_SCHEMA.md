# Esquema de Auditoría: Registro de decisiones de asignación y sorteos

Este documento describe el diseño del esquema de auditoría que registra las ejecuciones
del algoritmo de asignación, los sorteos (lotteries) y los resultados por participante.
También cubre cambios asociados a la prioridad y el contexto de ejecución (IP, user agent,
metadatos), y proporciona ejemplos de uso con Prisma.

## Objetivos

- Trazabilidad completa de cada ejecución (batch) del algoritmo.
- Registro auditable de todos los sorteos que se ejecutan (quién participó y ganó/perdió).
- Capacidad de reconstruir por qué un estudiante no obtuvo una plaza concreta.
- Guardar contexto de la petición (IP, user-agent, metadata) para auditoría y detección de abusos.

## Modelos principales (resumen)

- `assignment_runs` — Registro por cada ejecución (batch) del algoritmo.
- `lotteries` — Sorteos ejecutados; ahora referencian `assignment_runs`.
- `lottery_results` — Resultado individual por estudiante dentro de un sorteo (campos de contexto opcionales).
- `assignments` — Asignaciones finales; ahora referencian `assignment_runs`.

> Nota: las relaciones y tipos están definidas en `prisma/schema.prisma`. Aquí explicamos el propósito y
> cómo usar cada campo desde la perspectiva de auditoría y operaciones.

---

## `assignment_runs` (registro de ejecución)

Propósito: representar una ejecución completa del algoritmo. Cada vez que se lanza la asignación (p. ej. vía API
administrador o CLI), se debe crear un `assignment_runs` y usar su `id` para relacionar las `assignments` y `lotteries`
generadas en esa ejecución.

Campos clave:

- `id` (UUID): identificador de la ejecución.
- `initiated_by` (UUID?) : id del usuario administrador que inició la ejecución (opcional).
- `initiated_by_email` (String?) : email del iniciador (útil para auditoría cuando `initiated_by` no esté disponible).
- `seed` (String?) : semilla usada para los RNG (si aplica). Guardar la semilla permite reproducir sorteos si fuera necesario.
- `notes` (String?) : notas libres sobre la ejecución (por ejemplo: "Prueba con capacidades ajustadas").
- `metadata` (Json?) : campo JSON para cualquier dato adicional (parámetros, flags, duración, versión de algoritmo).
- `executed_at` (DateTime): timestamp de ejecución.

Relaciones:

- `lotteries[]` y `assignments[]` : asociación inversa a los sorteos y asignaciones generados por este run.

Uso recomendado:

1. Crear `assignment_runs` al inicio del proceso.
2. Pasar `assignment_run_id` en cada `lotteries` y en cada `assignments` (p. ej. en `createMany` o en `create`).
3. Al final, enlazar cualquier reporte/CSV/export con el `assignment_run` correspondiente.

---

## Cambios en `lotteries` y `assignments`

Se añadieron columnas `assignment_run_id` (nullable) que referencian `assignment_runs(id)`.

Razonamiento:

- Permite consultar "todos los sorteos generados por la ejecución X" o "todas las asignaciones creadas por X".
- Mantiene compatibilidad hacia atrás (nullable), así los registros históricos sin run seguirán existiendo.

Índices recomendados (sugerencia para optimizar consultas de auditoría):

- `CREATE INDEX ON lotteries (assignment_run_id);`
- `CREATE INDEX ON assignments (assignment_run_id);`
- `CREATE INDEX ON lotteries (executed_at);`

---

## Cambios en `lottery_results`

Se añadieron campos opcionales para capturar el contexto de la petición que originó el sorteo:

- `request_ip` (String?) — Dirección IP, útil en auditoría y detección de abusos o automatización.
- `user_agent` (String?) — Cadena del agente de usuario.
- `execution_context` (Json?) — Campo JSON para añadir información arbitraria (por ejemplo: versión de la app,
  opciones de ejecución, conteos adicionales).

Uso:

- Cuando se crea cada fila de `lottery_results`, si está disponible el contexto de la petición, rellenarlo.
- Estos campos deben considerarse sensibles; restringir acceso en interfaces y no exponerlos públicamente.

Índices recomendados:

- `CREATE INDEX ON lottery_results (lottery_id);`
- `CREATE INDEX ON lottery_results (student_id);`

---

## Ejemplo del flujo de creación (Prisma Client)

1. Crear `assignment_runs` al iniciar la ejecución:

```ts
const run = await prisma.assignment_runs.create({
	data: {
		initiated_by: adminId, // opcional
		initiated_by_email: adminEmail,
		seed: seedValue, // opcional, útil para reproducibilidad
		notes: "Ejecución 2025-11-03: ajuste de capacidades",
		metadata: { env: "dev", algorithmVersion: "1.1" },
	},
});
```

2. Al crear sorteos (lotteries) dentro del proceso, incluir `assignment_run_id`:

```ts
await prisma.lotteries.create({
	data: {
		course_id: courseId,
		course_name: courseName,
		parallel: parallel,
		preference: preferenceLevel,
		candidates: candidateCount,
		available_spots: availableSpots,
		assignment_run_id: run.id,
		lottery_results: {
			create: participantRows, // cada row incluye student_id, student_email, won, request_ip, user_agent, execution_context
		},
	},
});
```

3. Para `assignments`, si usas `createMany` (más eficiente), asegúrate de poblar la columna escalar `assignment_run_id` en cada objeto de datos:

```ts
await prisma.assignments.createMany({
	data: assignmentsData.map((a) => ({
		student_id: a.student_id,
		course_id: a.course_id,
		preference_order: a.preference_order,
		is_priority: a.is_priority,
		assignment_run_id: run.id,
	})),
});
```

> Importante: `createMany` ignora relaciones anidadas, pero acepta columnas escalares (UUIDs) — por eso pasamos `assignment_run_id` directo.

---

## Consultas útiles de auditoría (SQL / Prisma)

- Obtener todos los sorteos y sus resultados para una ejecución específica:

```sql
SELECT l.*, lr.student_id, lr.student_email, lr.won
FROM lotteries l
JOIN lottery_results lr ON lr.lottery_id = l.id
WHERE l.assignment_run_id = '<RUN_ID>'
ORDER BY l.preference, l.course_name;
```

- Con Prisma (obtener run con relaciones):

```ts
const runWithDetails = await prisma.assignment_runs.findUnique({
	where: { id: runId },
	include: {
		lotteries: { include: { lottery_results: true } },
		assignments: true,
	},
});
```

- Ver historial de sorteos en los que participó un estudiante:

```ts
const studentLotteries = await prisma.lottery_results.findMany({
	where: { student_id: studentId },
	include: { lotteries: true },
});
```

---

## Política de retención y privacidad

- Los campos `request_ip` y `user_agent` pueden considerarse datos personales en algunos contextos. Definir una política de retención (p. ej. conservar 1 año) y eliminar/anonimizar datos según la normativa local.
- Controlar acceso: sólo cuentas administrativas o procesos de auditoría deben poder consultar `lottery_results` con campos de contexto.

---

## Recomendaciones operativas y de migración

1. Corregir el encabezado `generator` en `prisma/schema.prisma` si quedó corrupto (ya realizado en este commit).
2. Ejecutar migraciones en una copia local o entorno de staging si no desear perder datos reales.
3. Si estás en desarrollo y puedes resetear la DB local, usar:

```bash
npx prisma migrate reset --force
npx prisma migrate dev --name add_audit_fields
npx prisma generate
```

4. Para entornos con datos reales, planificar migración no destructiva y backup previo.

---

## Índices y performance (resumen)

- Índices recomendados:
  - `lotteries(assignment_run_id)` — para listar sorteos por ejecución
  - `assignments(assignment_run_id)` — para listar asignaciones por ejecución
  - `lottery_results(lottery_id)` y `lottery_results(student_id)` — para consultar resultados por sorteo o estudiante
  - `assignment_runs(executed_at)` — para ordenar ejecuciones por fecha

-- Considerar particionar `lottery_results` si hay millones de filas (sharding/particionado por año o run_id).

---

Si quieres, puedo:

- Añadir los índices SQL concretos como migración adicional.
- Implementar el cambio en `src/lib/course-assignment.ts` para crear el `assignment_runs` y propagar `assignment_run_id` automáticamente.
- Añadir un endpoint o script de auditoría que permita consultar ejecuciones y exportar a CSV.

Dime cuál de estos pasos quieres que implemente ahora.

---

_Documento generado el: 2025-11-03_
