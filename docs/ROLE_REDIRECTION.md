# Prueba de Redirección por Roles

## 🎯 Comportamiento Esperado

### **Administrador (role: "admin")**

| Acción                          | Resultado              |
| ------------------------------- | ---------------------- |
| Iniciar sesión desde `/`        | ✅ Redirige a `/admin` |
| Navegar directamente a `/admin` | ✅ Permite acceso      |
| Intentar acceder a `/dashboard` | ⚠️ Redirige a `/admin` |

### **Estudiante (role: "student")**

| Acción                              | Resultado                  |
| ----------------------------------- | -------------------------- |
| Iniciar sesión desde `/`            | ✅ Redirige a `/dashboard` |
| Navegar directamente a `/dashboard` | ✅ Permite acceso          |
| Intentar acceder a `/admin`         | ⚠️ Redirige a `/dashboard` |

## 🧪 Pasos para Probar

### Prueba 1: Administrador

1. **Cerrar sesión** (o abrir navegador en modo incógnito)
2. **Ir a** http://localhost:3001
3. **Iniciar sesión con:**
   - Email: `admin@institucion.edu`
   - Password: `admin123`
4. **Verificar:** Debería redirigir automáticamente a `/admin`
5. **Intentar ir a** http://localhost:3001/dashboard
6. **Verificar:** Debería redirigir de vuelta a `/admin`

### Prueba 2: Estudiante

1. **Cerrar sesión**
2. **Ir a** http://localhost:3001
3. **Iniciar sesión con:**
   - Email: `francisco.lópez3@institucion.edu`
   - Password: `estudiante123`
4. **Verificar:** Debería redirigir automáticamente a `/dashboard`
5. **Intentar ir a** http://localhost:3001/admin
6. **Verificar:** Debería redirigir de vuelta a `/dashboard`

## 🔧 Cambios Implementados

### Middleware (`src/middleware.ts`)

```typescript
// Nuevo comportamiento
if (isAuthPage && isAuth) {
	// Redirigir según rol después del login
	if (userRole === "admin") {
		return NextResponse.redirect(new URL("/admin", req.url));
	}
	return NextResponse.redirect(new URL("/dashboard", req.url));
}

// Bloquear dashboard para admins
if (isDashboardPage && isAuth && userRole === "admin") {
	return NextResponse.redirect(new URL("/admin", req.url));
}

// Bloquear admin para estudiantes
if (isAdminPage && isAuth && userRole !== "admin") {
	return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

## ✅ Resultado

- ✅ **Administradores** → Solo pueden acceder a `/admin`
- ✅ **Estudiantes** → Solo pueden acceder a `/dashboard`
- ✅ **Cada rol tiene su espacio exclusivo**
- ✅ **Redirecciones automáticas según rol**

---

**Última actualización**: 18 de octubre, 2025
