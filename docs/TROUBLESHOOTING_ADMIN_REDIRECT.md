# 🔧 Solución: Middleware redirige a Dashboard en lugar de Admin

## ❌ Problema

Cuando un administrador intenta acceder a `/admin`, el middleware lo redirige a `/dashboard` en lugar de permitir el acceso.

## 🔍 Causa Raíz

El **token JWT almacenado en las cookies NO incluye el campo `role`**. Esto sucede cuando:

1. El usuario inició sesión ANTES de que se agregara el campo `role` al sistema
2. El token JWT se genera al momento del login y se guarda en cookies
3. El middleware lee el token de las cookies, pero el campo `role` no existe en ese token antiguo
4. Sin el campo `role`, el middleware no puede determinar si es admin o estudiante
5. Por defecto, el sistema asume que es estudiante y lo redirige a `/dashboard`

## ✅ Solución: Cerrar Sesión y Volver a Iniciar

### Opción 1: Página de Logout (Recomendada)

1. **Ve a la página de logout:**

   ```
   http://localhost:3001/logout
   ```

2. **La sesión se cerrará automáticamente** y serás redirigido al login

3. **Vuelve a iniciar sesión:**

   - Email: `admin@institucion.edu`
   - Password: `admin123`

4. **Ahora deberías ser redirigido a `/admin`** ✅

### Opción 2: Borrar Cookies Manualmente

#### Chrome/Edge:

1. Presiona `F12` para abrir DevTools
2. Ve a la pestaña **Application**
3. En el menú lateral, expande **Cookies**
4. Selecciona `http://localhost:3001`
5. Encuentra y elimina: `next-auth.session-token` o `__Secure-next-auth.session-token`
6. Recarga la página
7. Inicia sesión nuevamente

#### Firefox:

1. Presiona `F12` para abrir DevTools
2. Ve a la pestaña **Storage**
3. Expande **Cookies**
4. Selecciona `http://localhost:3001`
5. Elimina las cookies de NextAuth
6. Recarga y vuelve a iniciar sesión

#### Safari:

1. Presiona `⌘ + ,` para abrir Preferencias
2. Ve a **Privacidad**
3. Haz clic en **Administrar datos de sitios web**
4. Busca `localhost`
5. Elimina los datos
6. Recarga y vuelve a iniciar sesión

### Opción 3: Modo Incógnito

1. **Abre una ventana de incógnito/privada**
2. **Ve a** `http://localhost:3001`
3. **Inicia sesión con:**
   - Email: `admin@institucion.edu`
   - Password: `admin123`
4. **Deberías ser redirigido a `/admin`** ✅

## 🔐 Verificar que el Rol está Correcto en la Base de Datos

Ejecuta este comando para verificar:

```bash
npx tsx src/lib/check-admin-role.ts
```

Deberías ver:

```
✅ Usuario encontrado:
   📧 Email: admin@institucion.edu
   🔑 ID: [UUID]
   📊 Nivel: 4
   👤 Rol: admin
   🧠 Neurodivergente: false

✅ El rol está correctamente configurado como "admin"
```

Si el rol NO es "admin", ejecuta:

```bash
npm run db:create-admin
```

## 🧪 Verificar que Funciona

Después de cerrar sesión y volver a iniciar:

1. **Login como admin** → Debería redirigir a `/admin` ✅
2. **Intenta ir a `/dashboard`** → Debería redirigir de vuelta a `/admin` ✅
3. **Ve a `/admin`** → Debería mostrar el panel de administración ✅

## 📝 ¿Por qué sucedió esto?

### Cronología del Problema:

1. **Inicialmente**: El sistema no tenía campo `role` en el token JWT
2. **Usuario admin inició sesión**: Se creó un token SIN el campo `role`
3. **Se agregó el campo `role`**:
   - Se actualizó NextAuth para incluir `role` en el token
   - Se actualizó la base de datos con el campo `role`
   - Se actualizó el middleware para verificar `role`
4. **Sesión antigua sigue activa**: El token en las cookies NO tiene el campo `role`
5. **Middleware falla**: Sin `role`, el middleware no puede distinguir admin de estudiante

### ¿Cómo se soluciona?

- **Cerrando sesión** se elimina el token antiguo de las cookies
- **Iniciando sesión nuevamente** se genera un nuevo token JWT con el campo `role` incluido
- **El middleware ahora puede leer el rol** y hacer las redirecciones correctas

## 🛠️ Prevención Futura

En producción, si cambias la estructura del token JWT:

1. **Invalida todas las sesiones activas**
2. **Fuerza a todos los usuarios a volver a iniciar sesión**
3. **O usa un mecanismo de migración de tokens**

Para este proyecto de desarrollo, simplemente cerrar sesión es suficiente.

---

**Última actualización**: 18 de octubre, 2025
