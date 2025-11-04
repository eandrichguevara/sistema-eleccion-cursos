# 🎨 Ejemplo Visual: Flujo de Asignación

## Escenario de Ejemplo

### 👥 Estudiantes:

- **Ana** (Neurodivergente, 3ro medio)
- **Bruno** (4to medio)
- **Carlos** (4to medio)
- **Diana** (3ro medio)
- **Elena** (3ro medio)

### 📚 Cursos Disponibles:

**Paralelo 1:**

- Matemáticas Avanzadas (Cupos: 2)
- Literatura Contemporánea (Cupos: 2)

**Paralelo 2:**

- Física Cuántica (Cupos: 2)
- Química Orgánica (Cupos: 2)

**Paralelo 3:**

- Historia del Arte (Cupos: 2)
- Programación (Cupos: 2)

### 📝 Selecciones de Estudiantes:

**Ana (Neurodivergente):**

- P1: 1. Matemáticas, 2. Literatura
- P2: 1. Física, 2. Química
- P3: 1. Historia, 2. Programación

**Bruno (4to medio):**

- P1: 1. Matemáticas, 2. Literatura
- P2: 1. Física, 2. Química
- P3: 1. Programación, 2. Historia

**Carlos (4to medio):**

- P1: 1. Matemáticas, 2. Literatura
- P2: 1. Química, 2. Física
- P3: 1. Programación, 2. Historia

**Diana (3ro medio):**

- P1: 1. Literatura, 2. Matemáticas
- P2: 1. Química, 2. Física
- P3: 1. Historia, 2. Programación

**Elena (3ro medio):**

- P1: 1. Literatura, 2. Matemáticas
- P2: 1. Física, 2. Química
- P3: 1. Historia, 2. Programación

---

## 🎬 Ejecución del Algoritmo

### 🌟 GRUPO 1: NEURODIVERGENTES (Ana)

#### Paralelo 1:

```
📝 Preferencia 1: Matemáticas Avanzadas
   • Ana solicita → 1 estudiante, 2 cupos
   ✅ ASIGNADO: Ana → Matemáticas Avanzadas

Resultado:
   Matemáticas: 1/2 cupos (Ana)
   Literatura: 0/2 cupos
```

#### Paralelo 2:

```
📝 Preferencia 1: Física Cuántica
   • Ana solicita → 1 estudiante, 2 cupos
   ✅ ASIGNADO: Ana → Física Cuántica

Resultado:
   Física: 1/2 cupos (Ana)
   Química: 0/2 cupos
```

#### Paralelo 3:

```
📝 Preferencia 1: Historia del Arte
   • Ana solicita → 1 estudiante, 2 cupos
   ✅ ASIGNADO: Ana → Historia del Arte

Resultado:
   Historia: 1/2 cupos (Ana)
   Programación: 0/2 cupos
```

**✅ Ana completamente asignada: 3/3 cursos**

---

### 🎓 GRUPO 2: 4TO MEDIO (Bruno, Carlos)

#### Paralelo 1:

```
📝 Preferencia 1: Matemáticas Avanzadas
   • Bruno solicita
   • Carlos solicita
   → 2 estudiantes, 1 cupo disponible (Ana ya ocupó 1)

   🎲 SORTEO:
      Candidatos: [Bruno, Carlos]
      Cupos: 1

      🎰 Aleatorización Fisher-Yates...

      ✅ GANADOR: Carlos
      ❌ PIERDE: Bruno → pasa a 2ª preferencia

📝 Preferencia 2: Literatura Contemporánea
   • Bruno (perdió sorteo anterior)
   → 1 estudiante, 2 cupos disponibles
   ✅ ASIGNADO: Bruno → Literatura Contemporánea

Resultado:
   Matemáticas: 2/2 LLENO (Ana, Carlos)
   Literatura: 1/2 cupos (Bruno)
```

#### Paralelo 2:

```
📝 Preferencia 1:
   • Bruno solicita Física (1/2 cupos usado por Ana)
   • Carlos solicita Química (0/2 cupos)

   ✅ ASIGNADO: Bruno → Física Cuántica (había cupo)
   ✅ ASIGNADO: Carlos → Química Orgánica (había cupo)

Resultado:
   Física: 2/2 LLENO (Ana, Bruno)
   Química: 1/2 cupos (Carlos)
```

#### Paralelo 3:

```
📝 Preferencia 1: Programación
   • Bruno solicita
   • Carlos solicita
   → 2 estudiantes, 2 cupos disponibles

   ✅ ASIGNADO: Bruno → Programación
   ✅ ASIGNADO: Carlos → Programación

Resultado:
   Historia: 1/2 cupos (Ana)
   Programación: 2/2 LLENO (Bruno, Carlos)
```

**✅ Bruno completamente asignado: 3/3 cursos**
**✅ Carlos completamente asignado: 3/3 cursos**

---

### 📚 GRUPO 3: 3RO MEDIO (Diana, Elena)

#### Paralelo 1:

```
📝 Preferencia 1: Literatura Contemporánea
   • Diana solicita
   • Elena solicita
   → 2 estudiantes, 1 cupo disponible (Bruno ocupó 1)

   🎲 SORTEO:
      Candidatos: [Diana, Elena]
      Cupos: 1

      🎰 Aleatorización Fisher-Yates...

      ✅ GANADORA: Elena
      ❌ PIERDE: Diana → pasa a 2ª preferencia

📝 Preferencia 2: Matemáticas Avanzadas
   • Diana (perdió sorteo anterior)
   → 1 estudiante, 0 cupos (LLENO)
   ❌ Sin cupos → pasa a asignación por disponibilidad

⚠️ Asignación por disponibilidad:
   • Cursos en P1: Matemáticas (LLENO), Literatura (LLENO)
   ❌ No hay cupos en Paralelo 1
   ⚠️ Diana sin curso en este paralelo

Resultado:
   Matemáticas: 2/2 LLENO (Ana, Carlos)
   Literatura: 2/2 LLENO (Bruno, Elena)
```

#### Paralelo 2:

```
📝 Preferencia 1: Química Orgánica
   • Diana solicita (1/2 usado por Carlos)
   • Elena solicita Física (LLENO)

   ✅ ASIGNADO: Diana → Química Orgánica
   ❌ Elena → Física lleno, pasa a 2ª preferencia

📝 Preferencia 2: Química Orgánica
   • Elena
   → 1 estudiante, 0 cupos (Diana completó el curso)
   ❌ Sin cupos → asignación por disponibilidad

⚠️ Todos los cursos de P2 están llenos
   ❌ Elena sin curso en este paralelo

Resultado:
   Física: 2/2 LLENO (Ana, Bruno)
   Química: 2/2 LLENO (Carlos, Diana)
```

#### Paralelo 3:

```
📝 Preferencia 1: Historia del Arte
   • Diana solicita (1/2 usado por Ana)
   • Elena solicita
   → 2 estudiantes, 1 cupo disponible

   🎲 SORTEO:
      Candidatos: [Diana, Elena]
      Cupos: 1

      🎰 Aleatorización Fisher-Yates...

      ✅ GANADORA: Diana
      ❌ PIERDE: Elena → pasa a 2ª preferencia

📝 Preferencia 2: Programación
   • Elena (perdió sorteo)
   → 1 estudiante, 0 cupos (LLENO)
   ❌ Todos los cursos de P3 llenos
   ⚠️ Elena sin curso en este paralelo

Resultado:
   Historia: 2/2 LLENO (Ana, Diana)
   Programación: 2/2 LLENO (Bruno, Carlos)
```

---

## 📊 Resumen Final

### Asignaciones Completas:

| Estudiante | Tipo      | P1          | P2      | P3           | Total  |
| ---------- | --------- | ----------- | ------- | ------------ | ------ |
| **Ana**    | Neurodiv. | Matemáticas | Física  | Historia     | ✅ 3/3 |
| **Bruno**  | 4to       | Literatura  | Física  | Programación | ✅ 3/3 |
| **Carlos** | 4to       | Matemáticas | Química | Programación | ✅ 3/3 |
| **Diana**  | 3ro       | ❌          | Química | Historia     | ⚠️ 2/3 |
| **Elena**  | 3ro       | Literatura  | ❌      | ❌           | ⚠️ 1/3 |

### Estadísticas:

```
📚 Total de estudiantes: 5
✅ Total de asignaciones: 11

Por grupo:
   • Neurodivergentes: 3 cursos (100%)
   • 4to medio: 6 cursos (100%)
   • 3ro medio: 2 cursos (33%)

🎲 Sorteos ejecutados: 3
   1. Matemáticas P1 (Bruno vs Carlos)
   2. Literatura P1 (Diana vs Elena)
   3. Historia P3 (Diana vs Elena)

👥 Cobertura:
   • Completamente asignados: 3/5 (60%)
   • Parcialmente asignados: 2/5 (40%)
   • Sin asignar: 0/5 (0%)
```

### 🎲 Registro de Sorteos:

```sql
-- Sorteo 1: Matemáticas Avanzadas
{
  course: "Matemáticas Avanzadas",
  parallel: 1,
  preference: 1,
  candidates: 2,
  available_spots: 1,
  winners: ["Carlos"],
  losers: ["Bruno"]
}

-- Sorteo 2: Literatura Contemporánea
{
  course: "Literatura Contemporánea",
  parallel: 1,
  preference: 1,
  candidates: 2,
  available_spots: 1,
  winners: ["Elena"],
  losers: ["Diana"]
}

-- Sorteo 3: Historia del Arte
{
  course: "Historia del Arte",
  parallel: 3,
  preference: 1,
  candidates: 2,
  available_spots: 1,
  winners: ["Diana"],
  losers: ["Elena"]
}
```

---

## 💡 Observaciones Importantes

1. **Priorización funcionó**: Ana (neurodivergente) obtuvo todas sus 1as preferencias

2. **Sorteos justos**:

   - Cada sorteo usó Fisher-Yates shuffle
   - Los perdedores pasaron automáticamente a su siguiente preferencia

3. **Problema de capacidad**:

   - Diana y Elena quedaron parcialmente asignadas
   - **Causa**: Cursos con cupo insuficiente (2 cupos vs 5 estudiantes)
   - **Solución**: Aumentar capacidad de cursos o agregar más secciones

4. **Escalado a la realidad**:
   - Con 300 estudiantes y 12 cursos (42 cupos c/u)
   - Capacidad total: 504 cupos (suficiente para 168 asignaciones completas)
   - Para 300 estudiantes × 3 cursos = 900 asignaciones necesarias
   - Se necesitaría aumentar la capacidad o agregar más cursos
