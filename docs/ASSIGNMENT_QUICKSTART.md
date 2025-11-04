# 🚀 Guía Rápida: Sistema de Asignación de Cursos

## ¿Qué hace este sistema?

Asigna cursos a estudiantes de forma **justa y priorizada**, garantizando que cada estudiante obtenga **1 curso de cada paralelo**.

## 🏆 Orden de Prioridad

```
1. 🌟 NEURODIVERGENTES (primero)
2. 🎓 4TO MEDIO (segundo)
3. 📚 3RO MEDIO (tercero)
```

Dentro de cada grupo, se respetan las preferencias (1ª, 2ª, 3ª, 4ª).

## 🎲 ¿Cuándo hay sorteo?

Cuando **más estudiantes quieren un curso** que cupos disponibles:

```
Ejemplo:
  Curso: "Programación I"
  Cupos: 10
  Estudiantes que lo pusieron como 1ª preferencia: 20

  → SORTEO automático
  → 10 ganadores obtienen el curso
  → 10 perdedores pasan a su 2ª preferencia
```

## ⚡ Ejecutar Asignación

### Opción 1: Línea de Comandos (Recomendado)

```bash
npm run assign
```

### Opción 2: API REST

```bash
curl -X POST http://localhost:3000/api/admin/assign
```

## 📊 Ver Resultados

### Ver sorteos ejecutados:

```bash
npm run db:view-lotteries
```

### Exportar a CSV:

```bash
npm run db:generate-csv
```

### Ver en interfaz web:

```bash
npm run db:studio
```

## 🔍 Estadísticas que Obtendrás

Después de ejecutar la asignación verás:

- ✅ Total de estudiantes procesados
- ✅ Total de asignaciones creadas
- ✅ Asignaciones por grupo (neurodivergentes, 4to, 3ro)
- ✅ Cantidad de sorteos ejecutados
- ✅ Estudiantes completamente asignados (3 cursos)
- ✅ Tasa de éxito de asignación

## ⚠️ Importante

- El algoritmo **limpia asignaciones previas** antes de ejecutar
- Asegúrate de tener **suficientes cupos** en los cursos
- Los estudiantes deben tener **selecciones completas** (preferencias en cada paralelo)

## 📚 Documentación Completa

Ver: [`docs/ASSIGNMENT_SYSTEM.md`](./ASSIGNMENT_SYSTEM.md)

## 🆘 Solución de Problemas

### "No hay estudiantes con selecciones"

→ Ejecuta `npm run db:seed` para crear datos de prueba

### "Estudiantes sin asignar completamente"

→ Verifica que hay suficientes cupos en los cursos
→ Revisa que todos tienen 4 preferencias por paralelo

### Ver logs detallados

→ El script `npm run assign` muestra todo el proceso paso a paso
