# 🧪 Prueba de Flujo Completo - Sistema de Elección de Cursos

## Estado Actual de la Base de Datos

✅ **Estudiante de prueba:** EXISTE

- Email: `estudiante@institucion.edu`
- Password: `password123`
- ID: `64f8442a-562c-4cf1-a27a-9ee697bd40a4`

✅ **Cursos:** 12 cursos disponibles (distribuidos en 3 paralelos)

📋 **Selecciones guardadas:** 0 (base de datos limpia, lista para pruebas)

---

## 📝 Pasos para la Prueba Completa

### 1️⃣ Verificar Página de Login

- [x] Navega a: http://localhost:3000
- [x] Deberías ver el formulario de login
- [x] Verifica que tenga campos de email y password

### 2️⃣ Iniciar Sesión

1. Ingresa las credenciales:
   - **Email:** `estudiante@institucion.edu`
   - **Password:** `password123`
2. Haz clic en **"Ingresar"**
3. **Resultado esperado:** Redirección automática a `/dashboard`

### 3️⃣ Verificar Dashboard Inicial

- Deberías ver:
  - ✅ Botón "Cerrar Sesión" en la esquina superior derecha
  - ✅ Título "Selección de Cursos"
  - ✅ 3 secciones de paralelos con 4 cursos cada uno
  - ✅ NO deberías ver selecciones previas (base de datos vacía)
  - ✅ Botón "Enviar Selección" deshabilitado (gris)

### 4️⃣ Seleccionar Cursos

Selecciona al menos 1 curso por paralelo. Por ejemplo:

**Paralelo 1:**

1. Haz clic en "Matemáticas Avanzadas" → Ver badge "🥇 1ra opción" (fondo dorado)
2. Haz clic en "Física Cuántica" → Ver badge "2da opción" (fondo gris)
3. Haz clic en "Química Orgánica" → Ver badge "3ra opción" (fondo beige)

**Paralelo 2:**

1. Haz clic en "Literatura Contemporánea" → Ver badge "🥇 1ra opción"

**Paralelo 3:**

1. Haz clic en "Economía Global" → Ver badge "🥇 1ra opción"
2. Haz clic en "Estadística Aplicada" → Ver badge "2da opción"

**Resultado esperado:**

- ✅ Aparece sección "Tus selecciones:" abajo
- ✅ Muestra las selecciones agrupadas por paralelo en columnas
- ✅ Cada opción tiene su indicador de posición (1°, 2°, 3°)
- ✅ El botón "Enviar Selección" se habilita
- ✅ Muestra el contador: "Enviar Selección (6)"

### 5️⃣ Probar Reordenamiento Automático

1. Haz clic en "Matemáticas Avanzadas" nuevamente (remover la 1ra opción)
2. **Resultado esperado:**
   - ✅ "Física Cuántica" pasa a ser 1ra opción (🥇 dorado)
   - ✅ "Química Orgánica" pasa a ser 2da opción (gris)
   - ✅ El contador cambia a "Enviar Selección (5)"

### 6️⃣ Guardar Selecciones en Base de Datos

1. Haz clic en **"Enviar Selección"**
2. **Durante el guardado:**
   - ✅ Botón cambia a "Guardando..."
   - ✅ Botón se deshabilita
3. **Después del guardado:**
   - ✅ Aparece alert: "Selección guardada correctamente!"
   - ✅ Muestra el resumen de selecciones por paralelo
   - ✅ Botón vuelve a "Enviar Selección (5)"

### 7️⃣ Verificar Persistencia de Datos

1. Recarga la página (F5 o Cmd+R)
2. **Resultado esperado:**
   - ✅ El dashboard carga automáticamente
   - ✅ Todas tus selecciones aparecen marcadas
   - ✅ Los badges de posición están correctos
   - ✅ La sección "Tus selecciones:" muestra todo

### 8️⃣ Cerrar Sesión

1. Haz clic en **"Cerrar Sesión"**
2. **Resultado esperado:**
   - ✅ Redirección a `/` (página de login)
   - ✅ No se puede acceder a `/dashboard` sin autenticación

### 9️⃣ Verificar Protección de Rutas

1. Intenta navegar manualmente a: http://localhost:3000/dashboard
2. **Resultado esperado:**
   - ✅ Redirección automática a `/` (login)

### 🔟 Verificar Auto-Login

1. Inicia sesión nuevamente
2. Con la sesión activa, navega a: http://localhost:3000
3. **Resultado esperado:**
   - ✅ Redirección automática a `/dashboard` (sin ver el login)

---

## 🔍 Verificación en Base de Datos

Para verificar que los datos se guardaron correctamente, ejecuta:

```bash
node test-db.mjs
```

**Deberías ver:**

```
📚 Estado de la base de datos:
================================
✅ Estudiante de prueba: EXISTE
   Email: estudiante@institucion.edu
   ID: 64f8442a-562c-4cf1-a27a-9ee697bd40a4

📋 Selecciones guardadas: 5
   1° opción: Física Cuántica (Paralelo 1)
   2° opción: Química Orgánica (Paralelo 1)
   1° opción: Literatura Contemporánea (Paralelo 2)
   1° opción: Economía Global (Paralelo 3)
   2° opción: Estadística Aplicada (Paralelo 3)

📚 Cursos en la base de datos: 12
```

---

## ✅ Checklist de Funcionalidades

- [ ] Login con NextAuth funciona
- [ ] Redirección automática al dashboard después del login
- [ ] Dashboard protegido (middleware)
- [ ] Auto-redirect al dashboard si ya está autenticado
- [ ] Selección de cursos con sistema de preferencias
- [ ] Indicadores visuales (1ra=oro, 2da=plata, 3ra=bronce)
- [ ] Reordenamiento automático al remover opciones
- [ ] Validación: mínimo 1 curso por paralelo
- [ ] Botón "Enviar" solo habilitado cuando hay selecciones válidas
- [ ] Guardado en base de datos con feedback visual
- [ ] Carga automática de selecciones previas
- [ ] Persistencia de datos al recargar
- [ ] Logout funciona correctamente
- [ ] Protección de rutas sin autenticación

---

## 🐛 Posibles Problemas y Soluciones

### Problema: "Error al conectar con el servidor"

**Solución:** Verifica que el servidor Next.js esté corriendo en `localhost:3000`

### Problema: "Unauthorized" al guardar

**Solución:** Asegúrate de estar autenticado. Cierra sesión y vuelve a iniciar.

### Problema: Las selecciones no cargan al recargar

**Solución:** Verifica que el guardado fue exitoso con `node test-db.mjs`

### Problema: Base de datos no responde

**Solución:** Verifica la variable `DATABASE_URL` en `.env`

---

## 🎯 Resultado Final Esperado

Al completar todos los pasos, deberías tener:

1. ✅ Sistema de autenticación completo y funcional
2. ✅ Protección de rutas con middleware
3. ✅ Interfaz de selección de cursos intuitiva
4. ✅ Persistencia de datos en PostgreSQL
5. ✅ Carga automática de selecciones previas
6. ✅ Experiencia de usuario fluida y sin errores

**¡El sistema está completamente funcional!** 🎉
