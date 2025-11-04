import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.students.findFirst({
    where: { role: 'admin' }
  });

  console.log('🔍 VERIFICACIÓN DE ADMIN:\n');
  
  if (admin) {
    console.log('✅ Usuario admin encontrado:');
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   🔑 Role: ${admin.role}`);
    console.log(`   🆔 ID: ${admin.id}`);
    
    // Verificar si la contraseña coincide
    const passwordMatch = await bcrypt.compare('admin123', admin.password);
    console.log(`   ✓ Contraseña "admin123" es válida: ${passwordMatch ? '✅ SÍ' : '❌ NO'}`);
    
    if (!passwordMatch) {
      console.log('\n⚠️  La contraseña no coincide. Necesitas recrear el admin.');
    }
  } else {
    console.log('❌ NO existe un usuario admin en la base de datos');
    console.log('\n💡 Necesitas crear el usuario admin');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
