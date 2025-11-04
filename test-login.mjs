async function testLogin(email, password, role) {
  console.log(`\n🔐 Probando login: ${email}`);
  console.log(`   Contraseña: ${password}`);
  console.log(`   Rol esperado: ${role}\n`);

  try {
    const response = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      redirect: 'manual'
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 302 || response.status === 200) {
      console.log('   ✅ Autenticación EXITOSA');
      const location = response.headers.get('location');
      if (location) {
        console.log(`   📍 Redirección: ${location}`);
      }
    } else {
      console.log('   ❌ Autenticación FALLIDA');
      const text = await response.text();
      console.log(`   Respuesta: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🧪 PRUEBA DE INICIO DE SESIÓN\n');
  console.log('='.repeat(60));

  await testLogin('admin@institucion.edu', 'admin123', 'admin');
  
  console.log('\n' + '='.repeat(60));
  
  await testLogin('jose.perez3@institucion.edu', 'estudiante123', 'student');
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Pruebas completadas\n');
}

main();
