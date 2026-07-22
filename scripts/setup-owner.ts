/**
 * Script: Setup owner pertama via terminal
 *
 * Cara pakai:
 *   cd ~/artech-deploy
 *   npx tsx scripts/setup-owner.ts
 *
 * Atau dengan argumen:
 *   npx tsx scripts/setup-owner.ts username password
 *
 * Berguna kalau halaman /setup di Vercel error atau Anda mau setup langsung via terminal.
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
      const onData = (char: string) => {
        const chars = char.split("");
        chars.forEach((c) => {
          if (c === "\r" || c === "\n" || c === "\u0004") {
            // enter
          } else if (c === "\u0003") {
            process.exit(0);
          } else {
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
  console.log("  ARTECH — Setup Owner Pertama");
  console.log("=".repeat(60));
  console.log();

  // Cek apakah sudah ada user
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("⚠️  Owner sudah ada! Tidak bisa setup ulang.");
    console.log();
    const users = await prisma.user.findMany({ select: { username: true } });
    console.log("📋 User yang sudah ada:");
    users.forEach((u, i) => console.log(`   ${i + 1}. ${u.username}`));
    console.log();
    console.log("💡 Untuk ganti password, jalankan:");
    console.log("   npx tsx scripts/change-password.ts");
    process.exit(0);
  }

  // Ambil argumen atau prompt
  let username = process.argv[2];
  let password = process.argv[3];

  if (!username) {
    username = await prompt("👤 Username owner: ");
  }

  if (!username) {
    console.log("❌ Username tidak boleh kosong.");
    process.exit(1);
  }

  if (!password) {
    password = await prompt("🔒 Password (min 8 karakter): ", true);
  }

  if (!password || password.length < 8) {
    console.log("❌ Password minimal 8 karakter.");
    process.exit(1);
  }

  // Hash password
  console.log();
  console.log("⏳ Hashing password...");
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: { username, passwordHash },
  });

  // Log access
  await prisma.accessLog.create({
    data: {
      userId: user.id,
      event: "setup_complete",
      metadata: { via: "terminal_script" },
    },
  });

  console.log();
  console.log("=".repeat(60));
  console.log("  ✅ OWNER BERHASIL DIBUAT!");
  console.log("=".repeat(60));
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${"*".repeat(password.length)}`);
  console.log();
  console.log("   Sekarang login di browser:");
  console.log("   https://artech-al13r0tov-arthatech.vercel.app/login");
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
