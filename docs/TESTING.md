# 🧪 Testing - Guía de Pruebas

## Usuario de Prueba

Se ha creado un usuario de prueba en la base de datos:

```
📧 Email: estudiante@institucion.edu
🔑 Password: password123
```

## Datos de Prueba en la Base de Datos

### 👤 Estudiante

- **ID**: 64f8442a-562c-4cf1-a27a-9ee697bd40a4
- **Email**: estudiante@institucion.edu
- **Level**: 1
- **Neurodivergente**: No
- **Electivos Previos**: []

### 📚 Cursos (12 cursos en total)

**Paralelo 1:**

- Matemáticas Avanzadas
- Física Cuántica
- Química Orgánica
- Programación I

**Paralelo 2:**

- Literatura Contemporánea
- Historia Universal
- Biología Molecular
- Inglés Avanzado

**Paralelo 3:**

- Economía Global
- Estadística Aplicada
- Diseño Digital
- Bases de Datos

## 🚀 Cómo Probar

### 1. Iniciar el servidor de desarrollo

```bash
npm run dev
```

### 2. Probar el Login

1. Ve a `http://localhost:3000`
2. Ingresa las credenciales:
   - **Email**: `estudiante@institucion.edu`
   - **Password**: `password123`
3. Click en "Ingresar"
4. Deberías ser redirigido al dashboard

### 3. Probar la API de Cursos

Abre en tu navegador o usa curl:

```bash
curl http://localhost:3000/api/courses
```

Deberías ver un JSON con los 12 cursos ordenados por paralelo.

### 4. Ver la Base de Datos

```bash
npm run db:studio
```

Esto abrirá Prisma Studio en `http://localhost:5555` donde puedes:

- Ver todos los estudiantes
- Ver todos los cursos
- Ver las selecciones
- Editar datos directamente

## 🔄 Resetear Datos de Prueba

Si necesitas resetear los datos de prueba, ejecuta:

```bash
npm run db:seed
```

Este comando:

1. Crea/actualiza el usuario de prueba
2. Crea/actualiza los 12 cursos
3. Muestra las credenciales y URLs útiles

## 📝 Scripts Disponibles

```bash
# Seed de la base de datos (usuario + cursos)
npm run db:seed

# Abrir Prisma Studio
npm run db:studio

# Crear solo el usuario de prueba
npx tsx scripts/create-test-user.ts

# Crear solo los cursos de prueba
npx tsx scripts/create-test-courses.ts
```

## ✅ Checklist de Pruebas

- [ ] Login funciona con credenciales correctas
- [ ] Login falla con credenciales incorrectas
- [ ] Dashboard muestra cursos después del login
- [ ] API `/api/courses` devuelve los 12 cursos
- [ ] Prisma Studio muestra los datos correctamente
- [ ] Logout funciona correctamente
