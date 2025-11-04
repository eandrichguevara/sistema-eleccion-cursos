# Sistema de Elección de Cursos Electivos

Sistema completo para la gestión de selección y asignación de cursos electivos en instituciones educativas.

## 🎯 Características Principales

### Para Estudiantes

- ✅ Autenticación segura con NextAuth.js
- ✅ Interfaz intuitiva para seleccionar 3 cursos (uno por cada paralelo)
- ✅ Vista de resultados con cursos asignados
- ✅ Sistema de preferencias (1ª, 2ª, 3ª)
- ✅ Toggle entre vista de selección y resultados

### Para Administradores

- ✅ Algoritmo de asignación automático con prioridades
- ✅ Sistema de sorteo justo (Fisher-Yates shuffle)
- ✅ Exportación de resultados en CSV
- ✅ Panel de administración completo
- ✅ Auditoría de sorteos en base de datos

## 🏗️ Tecnologías

- **Frontend**: Next.js 15.5.5 (App Router), React 19, TypeScript
- **Backend**: Next.js API Routes, Prisma ORM 6.17.1
- **Base de Datos**: PostgreSQL (Vercel Postgres Accelerate)
- **Autenticación**: NextAuth.js 4.24.11
- **Estilos**: CSS Modules

## 📦 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/eandrichguevara/sistema-eleccion-cursos.git
cd sistema-eleccion-cursos

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar migraciones de Prisma
npx prisma migrate deploy
npx prisma generate

# Poblar la base de datos
npm run db:seed

# Iniciar servidor de desarrollo
npm run dev
```

## 🗄️ Base de Datos

### Modelos Principales

- **Student**: Estudiantes con nivel, neurodivergencia, y credenciales
- **Course**: Cursos con nombre, paralelo y capacidad
- **Selection**: Preferencias de cursos de cada estudiante
- **Assignment**: Asignaciones finales de cursos
- **Lottery**: Registro de sorteos realizados
- **LotteryResult**: Resultados individuales de cada sorteo

## 🚀 Comandos Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo (puerto 3000)
npm run build            # Compilar para producción
npm run start            # Iniciar servidor de producción

# Base de Datos
npm run db:seed          # Poblar con datos de prueba (168 estudiantes, 12 cursos)
npm run db:studio        # Abrir Prisma Studio

# Algoritmos y Pruebas
npm run db:test-assignment    # Ejecutar algoritmo de asignación
npm run db:view-lotteries     # Ver historial de sorteos
npm run db:test-export        # Preview del formato CSV
npm run db:generate-csv       # Generar CSV completo de asignaciones
```

## 📚 Documentación Completa

- [**Sistema de Sorteo**](docs/LOTTERY_SYSTEM.md) - Documentación del sistema de sorteo y auditoría
- [**Sistema de Exportación**](docs/EXPORT_SYSTEM.md) - Guía de exportación de resultados en CSV

## 🎓 Flujo de Uso

### 1. Configuración Inicial (Administrador)

```bash
# Poblar base de datos con estudiantes y cursos
npm run db:seed
```

### 2. Selección de Cursos (Estudiantes)

1. Ingresar a http://localhost:3000
2. Iniciar sesión con credenciales institucionales
3. Seleccionar 3 cursos (uno por cada paralelo)
4. Confirmar selección

### 3. Asignación (Administrador)

```bash
# Opción 1: Ejecutar desde terminal
npm run db:test-assignment

# Opción 2: Desde interfaz web
# Navegar a /admin y hacer clic en "Ejecutar Asignación"
```

### 4. Visualización de Resultados (Estudiantes)

1. Iniciar sesión
2. Ir al dashboard
3. Hacer clic en "Ver Resultados"
4. Ver los 3 cursos asignados con badges de preferencia

### 5. Exportación (Administrador)

```bash
# Opción 1: Desde interfaz web
# Navegar a /admin y hacer clic en "Descargar CSV"

# Opción 2: Desde terminal
npm run db:generate-csv
```

## 🔐 Autenticación

### Usuarios de Prueba

Después de ejecutar `npm run db:seed`:

**Administrador:**

- Email: `admin@institucion.edu`
- Password: `admin123`

**Estudiantes (ejemplos):**

- Email: `francisco.lópez3@institucion.edu`
- Email: `diego.díaz4@institucion.edu`
- Password (todos): `estudiante123`

## 🎯 Algoritmo de Asignación

El sistema implementa un algoritmo de asignación justo que:

1. **Prioriza Estudiantes**: 4º medio y 3º neurodivergentes tienen prioridad
2. **Respeta Preferencias**: Intenta asignar cursos según el orden de preferencia
3. **Sorteo Justo**: Fisher-Yates shuffle para desempatar cuando hay más demanda que cupos
4. **Asigna 3 Cursos**: Cada estudiante recibe exactamente 3 cursos (uno por paralelo)
5. **Registra Auditoría**: Todos los sorteos quedan registrados en la base de datos

### Estadísticas Típicas

Tras ejecutar el algoritmo con 168 estudiantes:

- ~18% obtienen 1ª preferencia
- ~17% obtienen 2ª preferencia
- ~17% obtienen 3ª preferencia
- ~48% asignados por disponibilidad
- ~58% son asignaciones prioritarias

## 📊 Panel de Administración

Acceso: `http://localhost:3000/admin` (requiere rol de administrador)

### Funciones Disponibles

1. **Ejecutar Asignación**

   - Elimina asignaciones previas
   - Ejecuta algoritmo con sorteos
   - Registra auditoría completa

2. **Exportar CSV**
   - Descarga archivo con todas las asignaciones
   - Incluye 9 columnas de información
   - Formato compatible con Excel/Google Sheets

## 🔧 Configuración Avanzada

### Variables de Entorno

```env
# Base de datos
DATABASE_URL="postgresql://..."
POSTGRES_PRISMA_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

### Personalización

- **Capacidad de cursos**: Editar `capacity` en modelo Course (default: 42)
- **Número de paralelos**: Modificar lógica en algoritmo (actualmente: 3)
- **Criterios de prioridad**: Ajustar en `assignment-test.ts`

## 🐛 Solución de Problemas

### Error: "Property 'assignment' does not exist"

- **Causa**: Cache de TypeScript
- **Solución**: Reiniciar TypeScript server o ejecutar `npx prisma generate`

### Puerto 3000 en uso

- El sistema automáticamente usa puerto 3001 si 3000 está ocupado

### No aparecen resultados en dashboard

- Verificar que se hayan creado asignaciones: `npm run db:test-assignment`
- Verificar sesión del estudiante

## 📈 Próximas Mejoras

- [ ] Exportación en formato XLSX
- [ ] Filtros y búsqueda en panel admin
- [ ] Notificaciones por email
- [ ] Historial de asignaciones previas
- [ ] Reportes estadísticos avanzados
- [ ] Sistema de conflictos/reasignaciones

## 🤝 Contribución

Este es un proyecto educativo. Las contribuciones son bienvenidas.

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles

## 👨‍💻 Autor

Emilio Andrich Guevara

- GitHub: [@eandrichguevara](https://github.com/eandrichguevara)

---

**Desarrollado con Next.js 15 + Prisma + PostgreSQL**
