// src/lib/db.ts — Prisma client singleton
// Penting: di environment ini, DATABASE_URL sistem di-set ke SQLite path.
// Kita perlu force-override dengan nilai dari .env (PostgreSQL Supabase).

import { config } from "dotenv";
config({ path: ".env", override: true });

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
