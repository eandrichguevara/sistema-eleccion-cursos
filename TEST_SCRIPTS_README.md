# Scripts de Prueba del Sistema de Asignación

Este directorio contiene scripts para probar el algoritmo de asignación de cursos con datos falsos.

## Scripts Disponibles

### 1. Seed de la Base de Datos

Pobla la base de datos con 300 estudiantes, 12 cursos y selecciones aleatorias.

```bash
npm run db:seed
```

**¿Qué hace?**

- Limpia datos existentes (excepto el usuario admin)
- Crea 12 cursos (4 por paralelo, capacidad de 42 cada uno)
- Genera 300 estudiantes con distribución realista:
  - 20% de 4to medio (prioritarios)
  - 30% de 3ro medio (algunos neurodivergentes)
  - 50% de otros niveles
- Genera 3 selecciones aleatorias por estudiante (una por paralelo)
- Muestra estadísticas de demanda por curso

**Salida esperada:**

```
🌱 Iniciando seed de la base de datos...

🗑️  Limpiando datos existentes...

📚 Creando 12 cursos...
   ✓ Matemáticas Avanzadas (Paralelo 1) - Capacidad: 42
   ✓ Física Cuántica (Paralelo 1) - Capacidad: 42
   ...

👥 Creando 300 estudiantes...
   ✓ Creados 50/300 estudiantes...
   ✓ Creados 100/300 estudiantes...
   ...

🎯 Generando selecciones para estudiantes...
   ✓ Selecciones generadas para 50/300 estudiantes...
   ...

📊 Estadísticas de datos generados:
   • Total de estudiantes: 300
   • Estudiantes prioritarios: 75
   • Estudiantes regulares: 225
   • Total de cursos: 12
   • Total de selecciones: 900

📈 Demanda por curso:
   ⚠️ SOBRECUPO Matemáticas Avanzadas (P1): 85/42 (202%)
   ✓ OK Física Cuántica (P1): 38/42 (90%)
   ...

✅ Seed completado exitosamente!
```

### 2. Prueba del Algoritmo de Asignación

Ejecuta el algoritmo de asignación e imprime resultados detallados en consola.

```bash
npm run db:test-assignment
```

**¿Qué hace?**

- Obtiene todas las selecciones de la base de datos
- Clasifica estudiantes en prioritarios y regulares
- Ejecuta el algoritmo de asignación completo
- Aplica desempate aleatorio cuando hay sobrecupo
- Guarda las asignaciones en la tabla `assignments`
- Muestra estadísticas detalladas paso a paso

**Salida esperada:**

```
🎯 INICIANDO PRUEBA DE ALGORITMO DE ASIGNACIÓN
================================================================================

📥 PASO 1: Obteniendo datos de la base de datos...
   ✓ Estudiantes con selecciones: 300

📊 PASO 2: Clasificando estudiantes...
   ✓ Estudiantes prioritarios: 75
     - 4to medio: 60
     - 3ro neurodivergentes: 15
   ✓ Estudiantes regulares: 225
   ✓ Cursos disponibles: 12
   ✓ Capacidad total: 504 cupos

🎯 PASO 3: Asignando a estudiantes prioritarios...
   ✓ juan.garcia1 → Matemáticas Avanzadas (Preferencia 1)
   ✓ maria.rodriguez2 → Física Cuántica (Preferencia 2)
   ...

   Resumen prioritarios:
   ✓ Asignados: 75/75
   ⚠️  Sin asignar: 0/75

🎯 PASO 4: Asignando a estudiantes regulares...
   Procesando preferencias del 1 al 3...

   📌 Procesando preferencia 1:
      ⚡ DESEMPATE: Matemáticas Avanzadas - 45 candidatos, 10 cupos
      ✓ Asignados 10 estudiantes a Matemáticas Avanzadas
   ...

   Resumen regulares:
   ✓ Asignados: 200/225
   ⚠️  Sin asignar: 25/225
   ⚡ Desempates aplicados: 8

💾 PASO 5: Guardando asignaciones en la base de datos...
   ✓ 275 asignaciones guardadas exitosamente

📊 ESTADÍSTICAS FINALES
================================================================================

📈 General:
   • Total de estudiantes: 300
   • Total asignados: 275 (92%)
   • Sin asignar: 25
   • Desempates aplicados: 8

🎯 Por categoría:
   • Prioritarios asignados: 75/75
   • Regulares asignados: 200/225

📚 Utilización de cursos:
   🔴 Matemáticas Avanzadas          42/42 [████████████████████] 100%
   🔴 Literatura Contemporánea       42/42 [████████████████████] 100%
   🟢 Física Cuántica                 38/42 [███████████████████ ] 90%
   🟢 Química Orgánica                35/42 [█████████████████   ] 83%
   ...

🎲 Distribución de preferencias asignadas:
   1ª preferencia: 180 estudiantes (65%)
   2ª preferencia: 70 estudiantes (25%)
   3ª preferencia: 25 estudiantes (9%)

✅ PRUEBA COMPLETADA EXITOSAMENTE!
```

## Flujo de Trabajo Recomendado

### Primera vez

```bash
# 1. Ejecutar migraciones de Prisma (si es necesario)
npx prisma db push

# 2. Crear usuario administrador
node create-admin.mjs

# 3. Poblar la base de datos con datos de prueba
npm run db:seed

# 4. Ejecutar el algoritmo de asignación
npm run db:test-assignment
```

### Pruebas iterativas

```bash
# Limpiar y recrear datos
npm run db:seed

# Probar el algoritmo nuevamente
npm run db:test-assignment
```

## Credenciales de Acceso

### Administrador

- **Email:** admin@institucion.edu
- **Password:** admin123
- **Permisos:** Puede ejecutar `/api/admin/assign-courses`

### Estudiantes (generados por seed)

- **Email:** [nombre].[apellido][número]@institucion.edu
- **Password:** estudiante123
- **Ejemplo:** juan.garcia1@institucion.edu

## Verificación de Resultados

### Usando Prisma Studio

```bash
npm run db:studio
```

Abre una interfaz visual en http://localhost:5555 para explorar:

- Tabla `students`: Ver estudiantes generados
- Tabla `courses`: Ver cursos y capacidades
- Tabla `selections`: Ver selecciones de estudiantes
- Tabla `assignments`: Ver resultados de la asignación

### Usando consultas SQL directas

```sql
-- Ver estudiantes asignados con su curso
SELECT
  s.email,
  s.level,
  s.is_neurodivergent,
  c.name as course_name,
  c.parallel,
  a.preference_order,
  a.is_priority
FROM assignments a
JOIN students s ON a.student_id = s.id
JOIN courses c ON a.course_id = c.id
ORDER BY a.is_priority DESC, a.preference_order ASC;

-- Ver cursos con ocupación
SELECT
  c.name,
  c.parallel,
  c.capacity,
  COUNT(a.id) as assigned,
  ROUND((COUNT(a.id)::numeric / c.capacity * 100), 2) as utilization_percent
FROM courses c
LEFT JOIN assignments a ON c.id = a.course_id
GROUP BY c.id, c.name, c.parallel, c.capacity
ORDER BY utilization_percent DESC;

-- Ver estudiantes sin asignar
SELECT
  s.email,
  s.level,
  s.is_neurodivergent,
  COUNT(sel.id) as selections_made
FROM students s
LEFT JOIN assignments a ON s.id = a.student_id
JOIN selections sel ON s.id = sel.student_id
WHERE a.id IS NULL
GROUP BY s.id, s.email, s.level, s.is_neurodivergent;
```

## Troubleshooting

### Error: "Property 'assignment' does not exist"

El cliente de Prisma no está actualizado. Ejecutar:

```bash
npx prisma generate
```

### Error: "No hay selecciones para procesar"

La base de datos está vacía. Ejecutar:

```bash
npm run db:seed
```

### Seed muy lento

El script crea 300 estudiantes uno por uno. Es normal que tome 30-60 segundos.

### Desempates muy frecuentes

Esto es esperado. Con 300 estudiantes y 504 cupos totales (12 cursos × 42), algunos cursos populares estarán en sobrecupo.

## Notas Técnicas

- **Aleatoriedad:** El seed genera datos aleatorios. Cada ejecución producirá resultados diferentes.
- **Desempate:** El algoritmo usa Fisher-Yates shuffle para garantizar equidad en el desempate.
- **Prioridad:** Los estudiantes de 4to medio y 3ro neurodivergentes siempre se asignan primero.
- **Idempotencia:** Ambos scripts pueden ejecutarse múltiples veces sin problemas.
