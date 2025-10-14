# NextAuth.js Configuration

## Autenticación con Credenciales

Este proyecto usa NextAuth.js para autenticación con el proveedor de Credentials.

### Configuración

1. **Variables de entorno** (ya configuradas en `.env`):

   ```bash
   NEXTAUTH_SECRET="your-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

2. **Proveedor configurado**: Credentials (email y password)

3. **Base de datos**: Verifica usuarios en la tabla `Student` usando Prisma

### Flujo de Autenticación

1. El usuario ingresa email y password en el formulario de login
2. NextAuth verifica las credenciales contra la tabla `Student` en la BD
3. La contraseña se compara usando bcrypt
4. Si es válido, se crea una sesión JWT con los datos del estudiante

### Crear un usuario de prueba

Para crear un usuario de prueba, puedes usar Prisma Studio o crear un script:

```typescript
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/utils/password";

async function createTestUser() {
	const hashedPassword = await hashPassword("password123");

	const user = await prisma.student.create({
		data: {
			email: "estudiante@institucion.edu",
			password: hashedPassword,
			level: 1,
			is_neurodivergent: false,
			previous_electives: [],
		},
	});

	console.log("Usuario creado:", user.email);
}

createTestUser();
```

### Datos de sesión disponibles

Cuando un usuario inicia sesión, la sesión incluye:

```typescript
{
  user: {
    id: string;
    email: string;
    name?: string;
    level: number;
    isNeurodivergent: boolean;
  }
}
```

### Endpoints de NextAuth

- **Sign In**: `POST /api/auth/signin`
- **Sign Out**: `POST /api/auth/signout`
- **Session**: `GET /api/auth/session`
- **CSRF Token**: `GET /api/auth/csrf`

### Uso en componentes

```typescript
import { useSession, signIn, signOut } from "next-auth/react";

export default function Component() {
	const { data: session, status } = useSession();

	if (status === "loading") return <div>Cargando...</div>;

	if (session) {
		return (
			<>
				<p>Conectado como {session.user.email}</p>
				<button onClick={() => signOut()}>Cerrar Sesión</button>
			</>
		);
	}

	return <button onClick={() => signIn()}>Iniciar Sesión</button>;
}
```
