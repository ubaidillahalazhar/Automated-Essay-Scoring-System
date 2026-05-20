const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Memulai proses seeding data...');

  // Kita tentukan urutan ID dan nama Role secara mutlak
  const roles = [
    { role_id: 1, role_name: 'admin', description: 'Administrator Sistem' },
    { role_id: 2, role_name: 'teacher', description: 'Guru (Pembuat Kuis)' },
    { role_id: 3, role_name: 'student', description: 'Murid (Penjawab Kuis)' }
  ];

  for (const role of roles) {
    // Kita gunakan upsert: 
    // Jika role_name sudah ada, update datanya.
    // Jika role_name belum ada, buat baru dengan ID yang kita tentukan.
    await prisma.role.upsert({
      where: { role_name: role.role_name },
      update: { 
        role_id: role.role_id, 
        description: role.description 
      },
      create: { 
        role_id: role.role_id, 
        role_name: role.role_name, 
        description: role.description 
      },
    });
  }

  console.log('✅ Data Role berhasil diseragamkan!');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Memutuskan koneksi database setelah selesai
    await prisma.$disconnect();
  });