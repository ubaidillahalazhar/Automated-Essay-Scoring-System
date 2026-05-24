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

  await prisma.grade.createMany({
    data: [
{ grade_name: 'Kelas 1', school_level: 'SD' },
      { grade_name: 'Kelas 2', school_level: 'SD' },
      { grade_name: 'Kelas 3', school_level: 'SD' },
      { grade_name: 'Kelas 4', school_level: 'SD' },
      { grade_name: 'Kelas 5', school_level: 'SD' },
      { grade_name: 'Kelas 6', school_level: 'SD' },
      { grade_name: 'Kelas 7', school_level: 'SMP' },
      { grade_name: 'Kelas 8', school_level: 'SMP' },
      { grade_name: 'Kelas 9', school_level: 'SMP' },
      { grade_name: 'Kelas 10', school_level: 'SMA' },
      { grade_name: 'Kelas 11', school_level: 'SMA' },
      { grade_name: 'Kelas 12', school_level: 'SMA' },
    ],
    skipDuplicates: true, // Abaikan jika kelas sudah pernah dibuat
  });

  console.log('🌱 Data master kelas berhasil ditanam!');
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