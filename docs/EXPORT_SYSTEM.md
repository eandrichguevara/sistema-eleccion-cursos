# Sistema de Exportación de Asignaciones

## 📋 Descripción General

El sistema de exportación permite a los administradores descargar un archivo CSV completo con todas las asignaciones de cursos realizadas, incluyendo información detallada de estudiantes y cursos.

## 🎯 Características

### 1. **API Endpoint de Exportación**

- **Ruta**: `GET /api/admin/export`
- **Autenticación**: Requiere sesión de administrador
- **Respuesta**: Archivo CSV descargable
- **Formato**: UTF-8 compatible con Excel y Google Sheets

### 2. **Información Incluida en el CSV**

Cada fila del CSV contiene los siguientes campos:

| Campo            | Descripción                         | Ejemplo                                                                |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Email Estudiante | Correo institucional del estudiante | `estudiante@institucion.edu`                                           |
| Nivel            | Nivel educativo (3 o 4)             | `4`                                                                    |
| Neurodivergente  | Estado de neurodivergencia          | `Sí` / `No`                                                            |
| Curso            | Nombre del curso asignado           | `"Programación I"`                                                     |
| Paralelo         | Número de paralelo (1, 2 o 3)       | `1`                                                                    |
| Tipo Asignación  | Categoría de la asignación          | `1ª Preferencia`, `2ª Preferencia`, `3ª Preferencia`, `Disponibilidad` |
| Preferencia      | Orden de preferencia original       | `1`, `2`, `3`, `N/A`                                                   |
| Prioritario      | Indicador de estudiante prioritario | `Sí` / `No`                                                            |
| Fecha Asignación | Timestamp de la asignación          | `17-10-2025, 08:34 p. m.`                                              |

### 3. **Nombre del Archivo**

El archivo se genera automáticamente con el formato:

```
asignaciones_YYYY-MM-DD_XXestudiantes.csv
```

Ejemplo: `asignaciones_2025-10-18_168estudiantes.csv`

## 🔐 Seguridad y Autenticación

### Verificación de Administrador

```typescript
// Paso 1: Verificar sesión
const session = await getServerSession(authOptions);
if (!session || !session.user?.email) {
	return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

// Paso 2: Verificar rol de administrador
const user = await prisma.student.findUnique({
	where: { email: session.user.email },
});

if (!user || user.role !== "admin") {
	return NextResponse.json(
		{ error: "No autorizado. Solo administradores pueden exportar." },
		{ status: 403 }
	);
}
```

## 📊 Uso del Sistema

### Opción 1: Desde la Interfaz Web

1. Inicia sesión como administrador
2. Navega a `/admin`
3. Haz clic en "📥 Descargar CSV de Asignaciones"
4. El archivo se descargará automáticamente

### Opción 2: Script de Línea de Comandos

```bash
# Generar archivo CSV directamente
npm run db:generate-csv
```

Este comando:

- ✅ Genera el archivo en el directorio raíz del proyecto
- ✅ Incluye estadísticas detalladas en la consola
- ✅ No requiere autenticación (para uso interno)

### Opción 3: API Request Directa

```bash
# Usando curl (requiere sesión de administrador)
curl -X GET http://localhost:3001/api/admin/export \
  --cookie "next-auth.session-token=YOUR_SESSION_TOKEN" \
  -o asignaciones.csv
```

## 📈 Estadísticas Incluidas

Al generar el CSV, el sistema proporciona estadísticas completas:

```
📈 ESTADÍSTICAS:
   • Asignaciones prioritarias: 291 (57.7%)
   • 1ª Preferencia: 89 (17.7%)
   • 2ª Preferencia: 87 (17.3%)
   • 3ª Preferencia: 85 (16.9%)
   • Por disponibilidad: 243 (48.2%)
```

## 🔧 Implementación Técnica

### Estructura de la Consulta

```typescript
const assignments = await prisma.assignment.findMany({
	include: {
		student: true, // Incluye datos del estudiante
		course: true, // Incluye datos del curso
	},
	orderBy: [
		{ student: { level: "asc" } }, // Por nivel
		{ student: { email: "asc" } }, // Por email
		{ course: { parallel: "asc" } }, // Por paralelo
	],
});
```

### Generación del CSV

```typescript
const csvHeader = [
	"Email Estudiante",
	"Nivel",
	"Neurodivergente",
	// ... más campos
].join(",");

const csvRows = assignments.map((assignment) => {
	// Formatear cada campo
	return [
		assignment.student.email,
		assignment.student.level,
		assignment.student.is_neurodivergent ? "Sí" : "No",
		// ... más campos
	].join(",");
});

const csvContent = [csvHeader, ...csvRows].join("\n");
```

### Respuesta HTTP

```typescript
return new NextResponse(csvContent, {
	status: 200,
	headers: {
		"Content-Type": "text/csv; charset=utf-8",
		"Content-Disposition": `attachment; filename="${filename}"`,
		"Cache-Control": "no-cache",
	},
});
```

## 🎨 Interfaz de Usuario

La página `/admin` proporciona:

- ✅ Botón de descarga con estado de carga
- ✅ Mensajes de éxito/error
- ✅ Descripción de los campos incluidos
- ✅ Diseño responsive y accesible
- ✅ Integración con el sistema de asignación

## 📝 Scripts Disponibles

| Comando                   | Descripción                                         |
| ------------------------- | --------------------------------------------------- |
| `npm run db:test-export`  | Muestra preview del formato CSV (primeras 10 filas) |
| `npm run db:generate-csv` | Genera archivo CSV completo en directorio raíz      |

## ⚠️ Consideraciones

### Formato de Datos

- **Nombres de cursos**: Entre comillas dobles para manejar comas internas
- **Fechas**: Formato chileno (dd-mm-yyyy, hh:mm a. m./p. m.)
- **Encoding**: UTF-8 para compatibilidad con caracteres especiales
- **Separador**: Coma (`,`)

### Manejo de Casos Especiales

```typescript
// Disponibilidad (sin preferencia original)
preference_order === 99 ? "N/A" : preference_order;

// Tipo de asignación
if (preference_order === 1) return "1ª Preferencia";
else if (preference_order === 2) return "2ª Preferencia";
else if (preference_order === 3) return "3ª Preferencia";
else if (preference_order === 99) return "Disponibilidad";
```

## 🚀 Próximas Mejoras

- [ ] Filtros por nivel, curso o fecha
- [ ] Exportación en formato XLSX
- [ ] Exportación de estadísticas agregadas
- [ ] Historial de exportaciones
- [ ] Exportación programada automática

## 📚 Referencias

- **API Route**: `src/app/api/admin/export/route.ts`
- **Interfaz Admin**: `src/app/admin/page.tsx`
- **Scripts**: `src/lib/generate-csv.ts`, `src/lib/test-export.ts`
- **Documentación DB**: `docs/LOTTERY_SYSTEM.md`

---

**Última actualización**: 18 de octubre, 2025
