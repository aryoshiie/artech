import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword || newPassword.length < 8) {
    console.log("❌ Format salah!");
    console.log("Penggunaan: npx tsx scripts/force-change-password.ts <username> <password_baru>");
    console.log("Contoh: npx tsx scripts/force-change-password.ts artech PasswordBaru123");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.log(`❌ User '${username}' tidak ditemukan di database.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash }
  });

  console.log(`\n✅ SUKSES! Password untuk user '${username}' berhasil diperbarui.`);
  console.log(`🔗 Silakan login di: http://localhost:3000/login\n`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
