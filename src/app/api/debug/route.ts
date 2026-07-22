// src/app/api/debug/route.ts — Diagnostic endpoint untuk cek DB & env vars
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    N8N_BASE_URL: Boolean(process.env.N8N_BASE_URL),
  };

  const suggestions: string[] = [];
  let dbConnected = false;
  let dbError: string | undefined;
  let agentCount: number | undefined;
  let sampleAgent: string | undefined;

  // Test DB connection
  try {
    if (!env.DATABASE_URL) {
      dbError = "DATABASE_URL tidak di-set di environment variables";
      suggestions.push("Set DATABASE_URL di Vercel → Settings → Environment Variables. Format: postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1");
    } else {
      try {
        agentCount = await db.agent.count();
        dbConnected = true;
        const first = await db.agent.findFirst({ orderBy: { orchestratorOrder: "asc" } });
        if (first) sampleAgent = `${first.name} (${first.id})`;
        if (agentCount === 0) {
          suggestions.push("Database terhubung tapi kosong. Jalankan seed: `bun run db:push && bun run db:seed` dari local, atau via Vercel CLI.");
        }
      } catch (e: any) {
        dbError = String(e?.message || e);
        if (dbError.includes("prepared statement")) {
          suggestions.push("Error 'prepared statement already exists' — tambahkan ?pgbouncer=true&connection_limit=1 di akhir DATABASE_URL (pakai pooler port 6543, bukan 5432).");
        } else if (dbError.includes("authentication failed") || dbError.includes("password")) {
          suggestions.push("Password database salah. Cek DATABASE_URL di Vercel env vars. Reset password di Supabase Dashboard → Settings → Database.");
        } else if (dbError.includes("connect ECONNREFUSED") || dbError.includes("timeout")) {
          suggestions.push("Tidak bisa connect ke Supabase. Cek region & host URL. Untuk Supabase Japan: aws-0-ap-northeast-1.pooler.supabase.com");
        } else if (dbError.includes("schema") || dbError.includes("does not exist")) {
          suggestions.push("Schema 'artech' belum ada. Jalankan: `bun run db:push` dari local dengan DATABASE_URL & DIRECT_URL yang benar.");
        } else {
          suggestions.push(`DB Error: ${dbError}. Pastikan DATABASE_URL format benar dan Supabase project aktif.`);
        }
      }
    }
  } catch (e: any) {
    dbError = e?.message || String(e);
  }

  // Test Settings
  let settingsLoaded = false;
  let settingsError: string | undefined;
  let n8nBaseUrl: string | undefined;
  try {
    const s = await db.settings.findUnique({ where: { id: "singleton" } });
    if (s) {
      settingsLoaded = true;
      n8nBaseUrl = s.n8nBaseUrl || undefined;
    } else {
      suggestions.push("Settings belum di-seed. Jalankan `bun run db:seed` untuk setup default.");
    }
  } catch (e: any) {
    settingsError = e?.message?.slice(0, 100);
  }

  // General suggestions
  if (!env.SUPABASE_URL) suggestions.push("Set SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_URL di Vercel env vars.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) suggestions.push("Set SUPABASE_SERVICE_ROLE_KEY untuk fitur upload file ke Supabase Storage.");
  if (!env.N8N_BASE_URL) suggestions.push("Set N8N_BASE_URL dengan URL n8n Anda (mis. https://artha.loophole.site).");
  if (suggestions.length === 0) suggestions.push("✅ Semua sistem normal. Tidak ada saran perbaikan.");

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env,
    db: {
      connected: dbConnected,
      error: dbError,
      agentCount,
      sampleAgent,
    },
    settings: {
      loaded: settingsLoaded,
      error: settingsError,
      n8nBaseUrl,
    },
    suggestions,
  });
}
