// src/app/api/agents/sync-registry/route.ts
// Sinkronisasi data Agent (nama, role, desc, isActive) ke schema "Artha" di Supabase
// agar workflow n8n Artha bisa baca daftar agent terbaru otomatis.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    // 1. Baca semua agent aktif dari schema Artech
    const agents = await db.agent.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        desc: true,
        isActive: true,
      },
    });

    // 2. Kirim data ke schema Artha (tabel Agent Registry)
    // Karena Prisma tidak bisa cross-schema upsert langsung,
    // kita pakai $executeRaw untuk UPSERT ke tabel "Agent Registry" schema Artha
    // Asumsi tabel "Agent Registry" sudah ada di schema Artha dengan kolom: id, name, role, description, is_active
    
    // Hapus data lama dulu (opsional, bisa diubah jadi UPSERT)
    await db.$executeRaw`DELETE FROM artha."Agent Registry";`;

    // Insert data baru
    for (const agent of agents) {
      await db.$executeRaw`
        INSERT INTO artha."Agent Registry" (id, name, role, description, is_active)
        VALUES (${agent.id}, ${agent.name}, ${agent.role}, ${agent.desc}, ${agent.isActive})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active;
      `;
    }

    return NextResponse.json({
      success: true,
      synced: agents.length,
      message: `Berhasil sync ${agents.length} agent ke schema Artha (Agent Registry)`,
    });
  } catch (err: any) {
    console.error("[API POST /agents/sync-registry]", err);
    return NextResponse.json(
      {
        error: "Gagal sync ke Agent Registry",
        details: err?.message || String(err),
        note: "Pastikan tabel 'Agent Registry' sudah ada di schema 'artha' Supabase Anda dengan kolom: id, name, role, description, is_active",
      },
      { status: 500 }
    );
  }
}
