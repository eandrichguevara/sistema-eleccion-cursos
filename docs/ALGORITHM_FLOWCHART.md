# 🔄 Diagrama de Flujo del Algoritmo de Asignación

## Flujo Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                     INICIO DEL ALGORITMO                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: Cargar estudiantes con selecciones                    │
│  └─> Si no hay estudiantes: TERMINAR con error                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: Clasificar estudiantes en 3 grupos                    │
│  ┌────────────────────────────────────────────────┐            │
│  │ GRUPO 1: Neurodivergentes (prioridad 1)       │            │
│  │ GRUPO 2: 4to medio (prioridad 2)              │            │
│  │ GRUPO 3: 3ro medio (prioridad 3)              │            │
│  └────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: Inicializar capacidades de cursos                     │
│  └─> Crear mapa de cupos por curso                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: Limpiar asignaciones y sorteos previos                │
│  └─> DELETE FROM assignments                                   │
│  └─> DELETE FROM lotteries                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PASO 5: ASIGNACIONES                         │
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ PROCESAR GRUPO 1: NEURODIVERGENTES             │            │
│  │ └─> Llamar a assignCoursesToStudentGroup()    │            │
│  └────────────────────────────────────────────────┘            │
│              │                                                  │
│              ▼                                                  │
│  ┌────────────────────────────────────────────────┐            │
│  │ PROCESAR GRUPO 2: 4TO MEDIO                    │            │
│  │ └─> Llamar a assignCoursesToStudentGroup()    │            │
│  └────────────────────────────────────────────────┘            │
│              │                                                  │
│              ▼                                                  │
│  ┌────────────────────────────────────────────────┐            │
│  │ PROCESAR GRUPO 3: 3RO MEDIO                    │            │
│  │ └─> Llamar a assignCoursesToStudentGroup()    │            │
│  └────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 6: Guardar asignaciones en base de datos                 │
│  └─> INSERT INTO assignments (todas las asignaciones)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 7: Guardar sorteos en base de datos                      │
│  └─> INSERT INTO lotteries (con lottery_results)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 8: Calcular y retornar estadísticas                      │
│  └─> Retornar { success, stats }                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                            FIN ✅
```

---

## Subproceso: assignCoursesToStudentGroup()

```
┌─────────────────────────────────────────────────────────────────┐
│           ASIGNAR CURSOS A UN GRUPO DE ESTUDIANTES              │
│           (Se ejecuta 3 veces: neurodiv, 4to, 3ro)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │  Obtener lista de paralelos      │
           │  (ej: [1, 2, 3])                 │
           └──────────────────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │  PARA CADA PARALELO:             │
           └──────────────────────────────────┘
                              │
                              ▼
    ╔═══════════════════════════════════════════════════╗
    ║            PROCESAR PARALELO N                    ║
    ╚═══════════════════════════════════════════════════╝
                              │
                              ▼
    ┌──────────────────────────────────────────────────┐
    │ Filtrar estudiantes que NO tienen curso en      │
    │ este paralelo                                    │
    └──────────────────────────────────────────────────┘
                              │
                              ▼
    ┌──────────────────────────────────────────────────┐
    │ PARA CADA PREFERENCIA (1, 2, 3, 4):             │
    └──────────────────────────────────────────────────┘
                              │
                              ▼
        ╔═════════════════════════════════════════════════╗
        ║       PROCESAR PREFERENCIA P                    ║
        ╚═════════════════════════════════════════════════╝
                              │
                              ▼
        ┌────────────────────────────────────────────────┐
        │ Agrupar estudiantes por curso solicitado      │
        │ en esta preferencia                            │
        │ Map<courseId, Student[]>                       │
        └────────────────────────────────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────────────────┐
        │ PARA CADA CURSO CON SOLICITUDES:               │
        └────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │ ¿Hay cupos disponibles?                 │
            └─────────────────────────────────────────┘
                      │              │
                 NO   │              │  SÍ
                      │              │
                      ▼              ▼
            ┌──────────────┐  ┌─────────────────────────┐
            │  SALTAR      │  │ ¿Solicitudes > Cupos?   │
            └──────────────┘  └─────────────────────────┘
                                    │              │
                               NO   │              │  SÍ
                                    │              │
                                    ▼              ▼
                    ┌─────────────────────┐  ┌──────────────────┐
                    │ ASIGNAR A TODOS     │  │ 🎲 EJECUTAR      │
                    │ (cupo suficiente)   │  │    SORTEO        │
                    └─────────────────────┘  └──────────────────┘
                                │                       │
                                │                       ▼
                                │        ┌──────────────────────────┐
                                │        │ performLottery()         │
                                │        │ (Fisher-Yates shuffle)   │
                                │        └──────────────────────────┘
                                │                       │
                                │                       ▼
                                │        ┌──────────────────────────┐
                                │        │ Separar ganadores        │
                                │        │ y perdedores             │
                                │        └──────────────────────────┘
                                │                       │
                                │                       ▼
                                │        ┌──────────────────────────┐
                                │        │ Registrar sorteo en      │
                                │        │ lotteryRecords[]         │
                                │        └──────────────────────────┘
                                │                       │
                                └───────────┬───────────┘
                                            │
                                            ▼
                            ┌───────────────────────────────┐
                            │ Crear asignaciones para       │
                            │ estudiantes seleccionados     │
                            └───────────────────────────────┘
                                            │
                                            ▼
                            ┌───────────────────────────────┐
                            │ Actualizar:                   │
                            │ - capacity.assignedCount++    │
                            │ - studentAssignments[id].add()│
                            └───────────────────────────────┘
                                            │
                                            ▼
                         (Continuar con siguiente curso)

                              │
                              ▼
    ┌──────────────────────────────────────────────────┐
    │ ¿Estudiantes sin asignar en este paralelo?       │
    └──────────────────────────────────────────────────┘
                      │              │
                 NO   │              │  SÍ
                      │              │
                      ▼              ▼
            ┌──────────────┐  ┌─────────────────────────┐
            │  CONTINUAR   │  │ ASIGNACIÓN POR          │
            │  AL SIGUIENTE│  │ DISPONIBILIDAD          │
            │  PARALELO    │  │                         │
            └──────────────┘  │ 1. Buscar cursos con    │
                              │    cupos en este paralelo│
                              │ 2. Asignar al curso con │
                              │    más cupos disponibles │
                              │ 3. preference_order = 99│
                              └─────────────────────────┘

                              │
                              ▼
                    (Continuar con siguiente paralelo)
```

---

## Subproceso: performLottery()

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎲 EJECUTAR SORTEO                           │
│                  (Fisher-Yates Shuffle)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │ Input:                       │
                │ - candidates: Student[]      │
                │ - availableSpots: number     │
                └──────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │ Copiar array de candidatos   │
                │ shuffled = [...candidates]   │
                └──────────────────────────────┘
                              │
                              ▼
        ╔═══════════════════════════════════════════╗
        ║      ALGORITMO FISHER-YATES              ║
        ║                                           ║
        ║  for i = length-1 down to 1:             ║
        ║    j = random(0, i)                      ║
        ║    swap(shuffled[i], shuffled[j])        ║
        ╚═══════════════════════════════════════════╝
                              │
                              ▼
                ┌──────────────────────────────┐
                │ Dividir array aleatorizado:  │
                │                              │
                │ winners = shuffled[0..N-1]   │
                │ losers = shuffled[N..end]    │
                │                              │
                │ donde N = availableSpots     │
                └──────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │ Return:                      │
                │ { winners, losers }          │
                └──────────────────────────────┘
```

---

## Flujo de Decisión: ¿Qué preferencia obtiene un estudiante?

```
                    ESTUDIANTE
                        │
                        ▼
        ┌───────────────────────────────┐
        │ ¿Tiene cupo su 1ª preferencia?│
        └───────────────────────────────┘
                │              │
            SÍ  │              │  NO
                │              │
                ▼              ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ ¿Sobrecupo?      │  │ Pasar a 2ª pref. │
    └──────────────────┘  └──────────────────┘
        │          │               │
    NO  │          │  SÍ           │
        │          │               ▼
        │          ▼       ┌────────────────────┐
        │   ┌──────────┐   │ ¿Tiene cupo su     │
        │   │ SORTEO   │   │ 2ª preferencia?    │
        │   └──────────┘   └────────────────────┘
        │          │               │          │
        │     ┌────┴────┐      SÍ │          │  NO
        │     │         │         │          │
        ▼     ▼         ▼         ▼          ▼
    ┌─────┐ ┌─────┐ ┌─────┐  (repetir)  ┌──────────┐
    │ 1ª  │ │ 1ª  │ │ 2ª  │   proceso   │ Pasar a  │
    │pref │ │pref │ │pref │             │ 3ª pref. │
    └─────┘ └─────┘ └─────┘             └──────────┘
  ASIGNADO  (ganó)   ASIGNADO                │
                                              ▼
                                    ┌─────────────────┐
                                    │ ¿Tiene cupo su  │
                                    │ 3ª preferencia? │
                                    └─────────────────┘
                                          │          │
                                      SÍ  │          │  NO
                                          │          │
                                          ▼          ▼
                                    ┌─────────┐  ┌────────────┐
                                    │ ASIGNAR │  │ Pasar a 4ª │
                                    │ 3ª pref.│  │ preferencia│
                                    └─────────┘  └────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │ Si no hay cupo   │
                                            │ en 4ª pref:      │
                                            │                  │
                                            │ ASIGNAR AL CURSO │
                                            │ CON MÁS CUPOS    │
                                            │ DISPONIBLES      │
                                            │ (pref = 99)      │
                                            └──────────────────┘
```

---

## Estados de un Estudiante durante el Proceso

```
┌──────────────────────────────────────────────────────────────┐
│                    ESTADOS DEL ESTUDIANTE                    │
└──────────────────────────────────────────────────────────────┘

    INICIO
      │
      ▼
┌───────────────┐
│ SIN PROCESAR  │  ← Aún no se ha intentado asignarle cursos
└───────────────┘
      │
      ▼
┌───────────────┐
│ EN PROCESO    │  ← Se están evaluando sus preferencias
└───────────────┘
      │
      ├─────────────────────────────────────┐
      │                                     │
      ▼                                     ▼
┌────────────────┐                 ┌─────────────────┐
│ ASIGNADO (1/3) │                 │ PERDIÓ SORTEO   │
│ Tiene 1 curso  │                 │ Pasa a siguiente│
└────────────────┘                 │ preferencia     │
      │                            └─────────────────┘
      ▼                                     │
┌────────────────┐                         │
│ ASIGNADO (2/3) │ ←───────────────────────┘
│ Tiene 2 cursos │
└────────────────┘
      │
      ▼
┌────────────────┐
│ COMPLETO (3/3) │  ← OBJETIVO: Todos llegan aquí
│ Tiene 3 cursos │
└────────────────┘
      │
      ▼
     FIN ✅


POSIBLES RESULTADOS FINALES:

    ✅ COMPLETO (3/3)
       → Tiene 1 curso de cada paralelo

    ⚠️ PARCIAL (1/3 o 2/3)
       → Falta cupo en algunos paralelos
       → Requiere intervención manual

    ❌ SIN ASIGNAR (0/3)
       → No tenía selecciones válidas
       → Error en el proceso
```

---

## Diagrama de Prioridades

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDEN DE PROCESAMIENTO                       │
└─────────────────────────────────────────────────────────────────┘

                      TIEMPO →

  ┌─────────────────┬─────────────────┬─────────────────┐
  │   PRIORIDAD 1   │   PRIORIDAD 2   │   PRIORIDAD 3   │
  │                 │                 │                 │
  │  🌟 NEURO-      │  🎓 4TO MEDIO   │  📚 3RO MEDIO   │
  │  DIVERGENTES    │                 │                 │
  │                 │                 │                 │
  │  Procesan       │  Procesan       │  Procesan       │
  │  PRIMERO        │  DESPUÉS        │  AL FINAL       │
  │                 │                 │                 │
  │  Acceso a       │  Acceso a       │  Acceso a       │
  │  TODOS los      │  cupos          │  cupos          │
  │  cupos          │  restantes      │  finales        │
  └─────────────────┴─────────────────┴─────────────────┘

Dentro de cada grupo:

  PARALELO 1 → PARALELO 2 → PARALELO 3
      │             │             │
      ▼             ▼             ▼
  Pref 1        Pref 1        Pref 1
  Pref 2        Pref 2        Pref 2
  Pref 3        Pref 3        Pref 3
  Pref 4        Pref 4        Pref 4
  Disponible    Disponible    Disponible
```

---

## Leyenda de Símbolos

```
✅  Operación exitosa / Asignado
❌  Error / Sin cupos / No asignado
⚠️  Advertencia / Asignación parcial
🎲  Sorteo ejecutado
🌟  Neurodivergente (máxima prioridad)
🎓  4to medio
📚  3ro medio
│   Flujo secuencial
├─  Ramificación
▼   Dirección del flujo
```
