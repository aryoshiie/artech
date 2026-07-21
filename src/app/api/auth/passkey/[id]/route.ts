// src/app/api/auth/passkey/[id]/route.ts
// Hapus passkey by id (harus milik user yang login).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, logAccess } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — login diperlukan" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const passkey = await db.passkey.findUnique({ where: { id } });
    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey tidak ditemukan" },
        { status: 404 }
      );
    }
    if (passkey.userId !== user.id) {
      await logAccess("access_denied", user.id, req, {
        reason: "passkey_not_owned",
        passkeyId: id,
      });
      return NextResponse.json(
        { error: "Forbidden — passkey bukan milik user ini" },
        { status: 403 }
      );
    }

    await db.passkey.delete({ where: { id } });
    await logAccess("passkey_delete", user.id, req, { passkeyId: id });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("[API DELETE /auth/passkey/[id]]", err);
    if (err?.code === "P2025") {
      return NextResponse.json(
        { error: "Passkey tidak ditemukan" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Gagal menghapus passkey" },
      { status: 500 }
    );
  }
}
