# API de Asignación de Cursos para Administradores

## Descripción

Esta API permite a los administradores ejecutar el algoritmo de asignación automática de cursos a estudiantes basándose en sus preferencias registradas.

## Endpoint

```
POST /api/admin/assign-courses
```

## Autenticación

Esta ruta está protegida y requiere:

1. **Autenticación**: El usuario debe estar autenticado con NextAuth
2. **Autorización**: El usuario debe tener rol de `admin`

### Credenciales de Administrador

Para acceder como administrador, usa:

- **Email**: `admin@institucion.edu`
- **Password**: `admin123`

## Algoritmo de Asignación

El algoritmo ejecuta los siguientes pasos:

### 1. Obtención de Selecciones

- Recupera todas las selecciones de cursos de todos los estudiantes
- Incluye información del estudiante (nivel, neurodivergencia) y del curso (capacidad)

### 2. Clasificación de Estudiantes

Separa a los estudiantes en dos grupos:

**Prioritarios:**

- Estudiantes de 4to medio (level = 4)
- Estudiantes de 3ro medio neurodivergentes (level = 3 AND is_neurodivergent = true)

**Regulares:**

- Todos los demás estudiantes

### 3. Asignación a Estudiantes Prioritarios

- Se procesan primero los estudiantes prioritarios
- Se intenta asignar el curso con la preferencia más alta disponible
- Se respeta el orden de preferencia (1ra, 2da, 3ra, etc.)
- Si un curso tiene cupo, se asigna inmediatamente

### 4. Asignación a Estudiantes Regulares

- Se procesan por orden de preferencia (todos los 1ros, luego todos los 2dos, etc.)
- **Desempate aleatorio**: Si hay más estudiantes que cupos disponibles para un curso:
  - Se aplica un shuffle aleatorio (algoritmo Fisher-Yates)
  - Se seleccionan aleatoriamente los estudiantes hasta llenar el cupo

### 5. Persistencia de Resultados

- Se limpian las asignaciones anteriores (si existen)
- Se guardan todas las nuevas asignaciones en la tabla `assignments`
- Cada asignación incluye:
  - `student_id`: ID del estudiante
  - `course_id`: ID del curso asignado
  - `is_priority`: Indica si fue asignado como estudiante prioritario
  - `preference_order`: Qué preferencia del estudiante fue asignada
  - `assigned_at`: Timestamp de la asignación

## Respuesta de la API

### Éxito (200)

```json
{
	"success": true,
	"message": "Asignación de cursos completada exitosamente",
	"stats": {
		"totalStudents": 100,
		"priorityStudents": 25,
		"regularStudents": 75,
		"totalAssignments": 95,
		"studentsAssigned": 95,
		"studentsUnassigned": 5,
		"courseUtilization": [
			{
				"courseId": "uuid-del-curso",
				"assigned": 40,
				"capacity": 42,
				"utilizationPercent": 95
			}
			// ... más cursos
		]
	}
}
```

### Errores

**401 - No autenticado**

```json
{
	"error": "No autenticado"
}
```

**403 - No autorizado**

```json
{
	"error": "No autorizado. Solo administradores pueden asignar cursos."
}
```

**400 - Sin selecciones**

```json
{
	"error": "No hay selecciones para procesar"
}
```

**500 - Error del servidor**

```json
{
	"error": "Error al procesar asignaciones",
	"details": "Descripción del error"
}
```

## Ejemplo de Uso con curl

```bash
# 1. Primero autenticarse (obtener cookie de sesión)
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@institucion.edu",
    "password": "admin123"
  }' \
  -c cookies.txt

# 2. Ejecutar la asignación
curl -X POST http://localhost:3000/api/admin/assign-courses \
  -b cookies.txt \
  -H "Content-Type: application/json"
```

## Ejemplo de Uso con JavaScript (fetch)

```javascript
// Asumiendo que el admin ya está autenticado
async function assignCourses() {
	try {
		const response = await fetch("/api/admin/assign-courses", {
			method: "POST",
			credentials: "include", // Incluir cookies de sesión
		});

		const data = await response.json();

		if (response.ok) {
			console.log("✅ Asignación exitosa:", data);
			console.log(`Estudiantes asignados: ${data.stats.studentsAssigned}`);
			console.log(`Estudiantes sin asignar: ${data.stats.studentsUnassigned}`);
		} else {
			console.error("❌ Error:", data.error);
		}
	} catch (error) {
		console.error("❌ Error de red:", error);
	}
}

assignCourses();
```

## Modelo de Datos

### Tabla `assignments`

| Campo              | Tipo     | Descripción                                 |
| ------------------ | -------- | ------------------------------------------- |
| `id`               | UUID     | ID único de la asignación                   |
| `student_id`       | UUID     | ID del estudiante asignado                  |
| `course_id`        | UUID     | ID del curso asignado                       |
| `assigned_at`      | DateTime | Timestamp de la asignación                  |
| `is_priority`      | Boolean  | Si fue asignado como estudiante prioritario |
| `preference_order` | Integer  | Número de preferencia asignada (1, 2, 3...) |

## Consideraciones

1. **Idempotencia**: La API limpia asignaciones anteriores antes de crear nuevas. Puede ejecutarse múltiples veces.

2. **Transaccionalidad**: Si ocurre un error durante la asignación, las asignaciones parciales se revierten.

3. **Desempate Justo**: El desempate aleatorio garantiza equidad entre estudiantes con las mismas preferencias.

4. **Logs**: El servidor imprime logs detallados durante el proceso de asignación para debugging.

5. **Estudiantes sin asignar**: Algunos estudiantes pueden quedar sin asignación si:
   - Todos sus cursos preferidos están llenos
   - No registraron suficientes preferencias

## Próximos Pasos

Después de ejecutar la asignación, puedes:

1. **Consultar asignaciones**: Crear endpoint `GET /api/admin/assignments` para ver resultados
2. **Notificar estudiantes**: Enviar emails con los cursos asignados
3. **Exportar resultados**: Generar CSV o Excel con las asignaciones
4. **Permitir ajustes manuales**: Crear interfaz para que admins puedan modificar asignaciones
