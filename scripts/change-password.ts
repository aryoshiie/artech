/**
 * Script: Ganti password owner via terminal
 *
 * Cara pakai:
 *   cd ~/artech-deploy
 *   npx tsx scripts/change-password.ts
 *
 * Atau dengan argumen:
 *   npx tsx scripts/change-password.ts username password_baru
 *
 * Jika tanpa argumen, akan prompt interaktif.
 */
import { config } from "dotenv";
config({ path: ".env", override: true });

// Force override system env (di beberapa environment, system DATABASE_URL tidak bisa di-override)
const envConfig = config({ path: ".env", override: true });
if (envConfig.parsed?.DATABASE_URL) {
  process.env.DATABASE_URL = envConfig.parsed.DATABASE_URL;
}
if (envConfig.parsed?.DIRECT_URL) {
  process.env.DIRECT_URL = envConfig.parsed.DIRECT_URL;
}

import { createInterface } from "readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Swap ke direct connection (port 5432) untuk operasi admin (hindari pgbouncer)
if (process.env.DATABASE_URL?.includes(":6543")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(":6543", ":5432").replace("?pgbouncer=true&connection_limit=1", "");
}

const prisma = new PrismaClient();

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: hidden ? undefined : process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      // Sembunyikan input untuk password
      const onData = (char: string) => {
        const chars = char.split("");
        chars.forEach((c) => {
          if (c === "\r" || c === "\n" || c === "\u0004") {
            // Enter atau Ctrl+D
          } else if (c === "\u0003") {
            // Ctrl+C
            process.exit(0);
          } else {
            // Sembunyikan — jangan echo
            process.stdout.write("*");
          }
        });
      };
      process.stdin.on("data", onData);

      rl.question(question, (answer) => {
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        resolve(answer);
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("  ARTECH — Ganti Password Owner");
  console.log("=".repeat(60));
  console.log();

  // Cek apakah ada user
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log("❌ Belum ada user. Buka /setup di browser untuk buat owner pertama.");
    console.log("   URL: https://artech-al13r0tov-arthatech.vercel.app/setup");
    process.exit(0);
  }

  // List semua user
  const users = await prisma.user.findMany({ select: { id: true, username: true, createdAt: true } });
  console.log("📋 User yang ada:");
  users.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.username} (dibuat: ${u.createdAt.toISOString().split("T")[0]})`);
  });
  console.log();

  // Ambil argumen atau prompt
  let username = process.argv[2];
  let newPassword = process.argv[3];

  if (!username) {
    username = await prompt("👤 Username yang ingin ganti password: ");
  }

  if (!username) {
    console.log("❌ Username tidak boleh kosong.");
    process.exit(1);
  }

  // Cek user exist
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.log(`❌ User "${username}" tidak ditemukan.`);
    console.log("   User yang tersedia:", users.map((u) => u.username).join(", "));
    process.exit(1);
  }

  if (!newPassword) {
    newPassword = await prompt("🔒 Password baru (min 8 karakter): ", true);
  }

  if (!newPassword || newPassword.length < 8) {
    console.log("❌ Password minimal 8 karakter.");
    process.exit(1);
  }

  // Hash password
  console.log();
  console.log("⏳ Hashing password...");
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Update
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Hapus semua session user tsb (force re-login)
  await prisma.authSession.deleteMany({ where: { userId: user.id } });

  // Log access
  await prisma.accessLog.create({
    data: {
      userId: user.id,
      event: "password_changed",
      metadata: { via: "terminal_script" },
    },
  });

  console.log();
  console.log("=".repeat(60));
  console.log("  ✅ PASSWORD BERHASIL DIGANTI!");
  console.log("=".repeat(60));
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${"*".repeat(newPassword.length)}`);
  console.log();
  console.log("   Semua session aktif user ini sudah dihapus.");
  console.log("   User perlu login ulang di browser.");
  console.log();
  console.log("   Buka: https://artech-al13r0tov-arthatech.vercel.app/login");
  console.log("=".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
