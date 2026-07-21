// src/app/api/auth/passkey/login-options/route.ts
// Generate authentication options untuk login dengan passkey.

import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { logAccess } from "@/lib/auth";
import { setChallengeCookie } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rpID = url.hostname;

    // Ambil semua passkey untuk allowCredentials (login discoverable juga didukung,
    // tapi kita kirim allowCredentials supaya browser/prompt lebih cepat)
    const passkeys = await db.passkey.findMany({
      select: { id: true, transports: true },
    });

    const allowCredentials = passkeys.map((p) => ({
      id: p.id,
      transports: p.transports
        ? (JSON.parse(p.transports) as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options: PublicKeyCredentialRequestOptionsJSON =
      await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: "preferred",
        timeout: 60000,
      });

    // Simpan challenge ke cookie httpOnly sementara
    await setChallengeCookie(options.challenge);

    await logAccess("passkey_login_options", null, req, { rpID });

    return NextResponse.json({ options });
  } catch (err: any) {
    console.error("[API POST /auth/passkey/login-options]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal generate authentication options" },
      { status: 500 }
    );
  }
}
