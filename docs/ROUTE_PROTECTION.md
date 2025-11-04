# Prueba de Protección de Rutas

## 🔐 Escenarios de Prueba

### 1. Usuario No Autenticado

**Ruta**: `/admin`

- ❌ Debe redirigir a `/` (página de login)
- ✅ Middleware bloquea el acceso

**Ruta**: `/dashboard`

- ❌ Debe redirigir a `/` (página de login)
- ✅ Middleware bloquea el acceso

### 2. Usuario Autenticado (Estudiante Regular)

**Credenciales de prueba**:

- Email: `francisco.lópez3@institucion.edu`
- Password: `estudiante123`
- Rol: `student`

**Ruta**: `/dashboard`

- ✅ Debe permitir acceso
- ✅ Muestra interfaz de selección de cursos

**Ruta**: `/admin`

- ❌ Debe redirigir a `/dashboard`
- ✅ Middleware bloquea acceso por rol

**API**: `GET /api/admin/export`

- ❌ Debe devolver 403 (Forbidden)
- ✅ API verifica rol de administrador

### 3. Usuario Autenticado (Administrador)

**Credenciales de prueba**:

- Email: `admin@institucion.edu`
- Password: `admin123`
- Rol: `admin`

**Ruta**: `/dashboard`

- ✅ Debe permitir acceso
- ✅ Muestra interfaz de selección de cursos (admin también puede seleccionar)

**Ruta**: `/admin`

- ✅ Debe permitir acceso
- ✅ Muestra panel de administración

**API**: `GET /api/admin/export`

- ✅ Debe devolver 200 con archivo CSV
- ✅ API permite descarga

## 🧪 Cómo Probar

### Opción 1: Navegador

1. **Cerrar todas las sesiones**:

   ```bash
   # Eliminar cookies en el navegador o usar modo incógnito
   ```

2. **Probar sin autenticación**:

   - Navegar a http://localhost:3001/admin
   - Debería redirigir a http://localhost:3001/

3. **Iniciar sesión como estudiante**:

   - Email: `francisco.lópez3@institucion.edu`
   - Password: `estudiante123`
   - Intentar navegar a http://localhost:3001/admin
   - Debería redirigir a http://localhost:3001/dashboard

4. **Cerrar sesión e iniciar como admin**:
   - Email: `admin@institucion.edu`
   - Password: `admin123`
   - Navegar a http://localhost:3001/admin
   - Debería mostrar el panel de administración

### Opción 2: curl (API)

```bash
# Sin autenticación - Debe devolver 401
curl -X GET http://localhost:3001/api/admin/export

# Con sesión de estudiante - Debe devolver 403
curl -X GET http://localhost:3001/api/admin/export \
  --cookie "next-auth.session-token=STUDENT_TOKEN"

# Con sesión de admin - Debe devolver 200 y CSV
curl -X GET http://localhost:3001/api/admin/export \
  --cookie "next-auth.session-token=ADMIN_TOKEN" \
  -o asignaciones.csv
```

## 📋 Checklist de Seguridad

- [x] Middleware protege `/dashboard`
- [x] Middleware protege `/admin`
- [x] Middleware verifica rol de administrador para `/admin`
- [x] Middleware redirige usuarios no autenticados a `/`
- [x] Middleware redirige estudiantes de `/admin` a `/dashboard`
- [x] API `/api/admin/export` verifica autenticación (401)
- [x] API `/api/admin/export` verifica rol de administrador (403)
- [x] Token JWT incluye campo `role`
- [x] Session incluye campo `role`
- [x] TypeScript types actualizados con `role`

## 🔧 Implementación

### Middleware (`src/middleware.ts`)

```typescript
// Verificar si es página de admin
const isAdminPage = req.nextUrl.pathname.startsWith("/admin");

// Redirigir si no es admin
if (isAdminPage && isAuth) {
	const userRole = token?.role as string | undefined;
	if (userRole !== "admin") {
		return NextResponse.redirect(new URL("/dashboard", req.url));
	}
}
```

### NextAuth Callbacks (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
// Incluir role en el objeto user
return {
  id: student.id,
  email: student.email,
  role: student.role,
  // ...
};

// Incluir role en JWT token
async jwt({ token, user }) {
  if (user) {
    token.role = user.role;
  }
  return token;
}

// Incluir role en session
async session({ session, token }) {
  if (session.user) {
    session.user.role = token.role;
  }
  return session;
}
```

### TypeScript Types (`src/types/next-auth.d.ts`)

```typescript
interface User {
	role: string;
}

interface Session {
	user: {
		role: string;
	};
}

interface JWT {
	role: string;
}
```

## ✅ Resultado Esperado

- ✅ Usuarios no autenticados son redirigidos a login
- ✅ Estudiantes no pueden acceder a `/admin`
- ✅ Solo administradores pueden acceder a `/admin`
- ✅ API verifica doble capa: sesión + rol
- ✅ Sistema de roles completamente funcional

---

**Última actualización**: 18 de octubre, 2025
