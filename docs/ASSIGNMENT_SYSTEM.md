# 🎯 Sistema de Asignación de Cursos con Priorización

## Descripción General

Este sistema implementa un algoritmo de asignación de cursos que prioriza estudiantes según su condición y nivel académico. El objetivo es que cada estudiante obtenga **1 curso de cada paralelo**, respetando sus preferencias en la medida de lo posible.

## 🏆 Orden de Prioridad

La asignación se realiza en **3 grupos consecutivos** con prioridad estricta:

### 1️⃣ **NEURODIVERGENTES** (Máxima Prioridad)

- Estudiantes con neurodivergencia (cualquier nivel: 3ro o 4to medio)
- Se procesan **PRIMERO** antes que todos los demás
- Tienen acceso preferente a todos los cursos disponibles

### 2️⃣ **4TO MEDIO** (Segunda Prioridad)

- Estudiantes de 4to medio sin neurodivergencia
- Se procesan **DESPUÉS** de neurodivergentes
- Tienen prioridad sobre estudiantes de 3ro medio regulares

### 3️⃣ **3RO MEDIO** (Tercera Prioridad)

- Estudiantes de 3ro medio sin neurodivergencia
- Se procesan **AL FINAL**
- Acceden a los cupos restantes después de los grupos anteriores

## 📋 Algoritmo de Asignación

### Proceso por Grupo

Para cada grupo de prioridad, el algoritmo sigue estos pasos:

#### **Para cada Paralelo:**

```
Paralelo 1 → Paralelo 2 → Paralelo 3
```

Cada estudiante debe obtener exactamente **1 curso** de cada paralelo.

#### **Para cada Preferencia (dentro del paralelo):**

El sistema intenta asignar en este orden:

1. **1ª Preferencia** - Curso favorito del estudiante en ese paralelo
2. **2ª Preferencia** - Segunda opción en ese paralelo
3. **3ª Preferencia** - Tercera opción en ese paralelo
4. **4ª Preferencia** - Cuarta opción en ese paralelo
5. **Asignación por Disponibilidad** - Si no obtiene ninguna preferencia, se le asigna el curso con más cupos disponibles en ese paralelo

### Sistema de Sorteo

Cuando **más estudiantes solicitan un curso** que cupos disponibles:

1. ✅ Se aplica el algoritmo **Fisher-Yates shuffle** (aleatorización justa)
2. ✅ Los ganadores obtienen el curso solicitado
3. ❌ Los perdedores pasan a su **siguiente preferencia** en ese paralelo
4. 📊 El sorteo se **registra en la base de datos** para auditoría

#### Ejemplo de Sorteo:

```
Curso: "Programación Avanzada" (Paralelo 1)
Cupos disponibles: 5
Estudiantes de 4to medio que lo pusieron como 1ª preferencia: 12

🎲 SORTEO EJECUTADO:
   ✅ 5 ganadores → asignados a "Programación Avanzada"
   ❌ 7 perdedores → pasan a su 2ª preferencia del Paralelo 1
```

Si en la **2ª preferencia** también hay sobrecupo → **nuevo sorteo**

Si en la **3ª preferencia** también hay sobrecupo → **nuevo sorteo**

Si en la **4ª preferencia** también hay sobrecupo → **nuevo sorteo**

Si no obtiene ninguna preferencia → Se asigna **automáticamente** al curso con más cupos disponibles en ese paralelo

## 🔧 Uso del Sistema

### Opción 1: API Endpoint (Para Administradores)

```bash
POST /api/admin/assign
```

**Ejemplo con curl:**

```bash
curl -X POST http://localhost:3000/api/admin/assign \
  -H "Content-Type: application/json"
```

**Respuesta exitosa:**

```json
{
	"success": true,
	"message": "Asignación completada exitosamente",
	"stats": {
		"totalStudents": 300,
		"totalAssignments": 900,
		"neurodivergentAssignments": 75,
		"fourthYearAssignments": 450,
		"thirdYearAssignments": 375,
		"lotteriesExecuted": 18,
		"studentsFullyAssigned": 295,
		"studentsPartiallyAssigned": 5
	}
}
```

### Opción 2: Script de Línea de Comandos

```bash
npm run assign
```

Este script:

- ✅ Ejecuta el algoritmo completo
- ✅ Muestra progreso detallado en consola
- ✅ Registra todos los sorteos en la base de datos
- ✅ Muestra estadísticas finales

**Ejemplo de salida:**

```
🎯 INICIANDO SISTEMA DE ASIGNACIÓN DE CURSOS

📚 PASO 1: Cargando estudiantes y selecciones...
  ✓ 300 estudiantes con selecciones

👥 PASO 2: Clasificando estudiantes por prioridad...
  • Neurodivergentes: 25
  • 4to medio: 150
  • 3ro medio: 125

📊 PASO 3: Inicializando capacidades de cursos...
  ✓ 12 cursos disponibles
  ✓ 3 paralelos: 1, 2, 3

🧹 PASO 4: Limpiando asignaciones previas...
  ✓ Base de datos limpia

🎲 PASO 5: Ejecutando asignaciones...

═══════════════════════════════════════
🌟 GRUPO 1: ESTUDIANTES NEURODIVERGENTES
═══════════════════════════════════════

  📋 Procesando 25 estudiantes para 3 paralelos

    🔹 Paralelo 1
      → 25 estudiantes necesitan curso aquí
      Preferencia 1: 4 cursos con solicitudes
        📝 Matemáticas Avanzadas: 8 solicitudes, 10 cupos
           ✓ Asignación directa (cupos suficientes)
        📝 Física Cuántica: 12 solicitudes, 8 cupos
        🎲 SORTEO: 12 candidatos → 8 cupos
           ✓ 8 ganadores, 4 pierden
...

═══════════════════════════════════════
✅ ASIGNACIÓN COMPLETADA CON ÉXITO
═══════════════════════════════════════

📊 ESTADÍSTICAS FINALES:

📚 Total de estudiantes: 300
✅ Total de asignaciones: 900
   • Neurodivergentes: 75 cursos
   • 4to medio: 450 cursos
   • 3ro medio: 375 cursos

🎲 Sorteos ejecutados: 18

👥 Estudiantes completamente asignados: 295/300
   Parcialmente asignados: 5
   Sin asignar: 0

📈 Tasa de asignación completa: 98.3%
```

## 📊 Registro de Sorteos

Todos los sorteos se registran automáticamente en la tabla `lotteries` con:

- ✅ Curso y paralelo involucrados
- ✅ Nivel de preferencia (1ª, 2ª, 3ª, etc.)
- ✅ Número de candidatos
- ✅ Cupos disponibles
- ✅ Ganadores y perdedores (en `lottery_results`)
- ✅ Timestamp de ejecución

### Consultar sorteos:

```sql
-- Ver todos los sorteos
SELECT * FROM lotteries ORDER BY executed_at DESC;

-- Ver resultados de sorteos de un estudiante
SELECT
  l.course_name,
  l.parallel,
  l.preference,
  lr.won,
  l.executed_at
FROM lottery_results lr
JOIN lotteries l ON lr.lottery_id = l.id
WHERE lr.student_email = 'estudiante@example.com'
ORDER BY l.executed_at DESC;
```

## 🎯 Garantías del Sistema

1. ✅ **Priorización Estricta**: Los grupos se procesan en orden secuencial
2. ✅ **Un Curso por Paralelo**: Cada estudiante obtiene exactamente 1 curso de cada paralelo
3. ✅ **Respeto a Preferencias**: Se intenta asignar la mejor preferencia posible
4. ✅ **Sorteos Justos**: Fisher-Yates garantiza aleatoriedad imparcial
5. ✅ **Auditoría Completa**: Todos los sorteos quedan registrados
6. ✅ **Cobertura Máxima**: Si hay cupos suficientes, todos los estudiantes son asignados

## 🔍 Verificación de Resultados

### Ver asignaciones de un estudiante:

```bash
npm run db:studio
```

Luego buscar el estudiante en la tabla `assignments`.

### Verificar sorteos ejecutados:

```bash
npm run db:view-lotteries
```

### Exportar resultados a CSV:

```bash
npm run db:generate-csv
```

## ⚠️ Consideraciones Importantes

1. **Capacidad de Cursos**: Asegúrate de que la suma de capacidades de cursos por paralelo sea suficiente para todos los estudiantes

2. **Selecciones Completas**: Los estudiantes deben tener al menos 1 preferencia por cada paralelo

3. **Datos Limpios**: El algoritmo limpia asignaciones previas antes de ejecutar

4. **Ejecución Única**: Ejecuta el algoritmo solo cuando estés listo - las asignaciones anteriores se borran

## 🚀 Flujo Completo Recomendado

1. **Configuración Inicial**:

   ```bash
   npm run db:seed  # Crear datos de prueba
   ```

2. **Verificar Datos**:

   ```bash
   npm run db:studio  # Ver estudiantes y sus selecciones
   ```

3. **Ejecutar Asignación**:

   ```bash
   npm run assign
   ```

4. **Verificar Resultados**:

   ```bash
   npm run db:view-lotteries  # Ver sorteos ejecutados
   npm run db:generate-csv     # Exportar resultados
   ```

5. **Ajustar si es necesario**:
   - Modificar capacidades de cursos
   - Ajustar selecciones de estudiantes
   - Volver a ejecutar asignación

## 📝 Notas Técnicas

- **Implementación**: `/src/lib/course-assignment.ts`
- **API Endpoint**: `/src/app/api/admin/assign/route.ts`
- **Script CLI**: `/scripts/run-assignment.ts`
- **Base de datos**: PostgreSQL con Prisma ORM
- **Algoritmo de sorteo**: Fisher-Yates shuffle (O(n) complejidad)
