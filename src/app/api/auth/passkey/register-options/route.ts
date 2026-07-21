// src/app/api/auth/passkey/register-options/route.ts
// Generate registration options untuk WebAuthn (user harus sudah login).

import { NextRequest, NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getCurrentUser, logAccess } from "@/lib/auth";
import { setChallengeCookie } from "@/lib/webauthn";

export const runtime = "nodejs";

const RP_NAME = "ARTECH";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — login diperlukan" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const rpID = url.hostname;
    const origin = url.origin;

    // Ambil passkey yang sudah ada untuk di-exclude
    const existingPasskeys = await db.passkey.findMany({
      where: { userId: user.id },
      select: { id: true, transports: true },
    });

    const excludeCredentials = existingPasskeys.map((p) => ({
      id: p.id,
      transports: p.transports
        ? (JSON.parse(p.transports) as AuthenticatorTransportFuture[])
        : undefined,
    }));

    // Generate user ID yang stabil (hash username → bytes)
    // userID harus unik per user, tidak boleh identifiable (PII).
    const userID = new Uint8Array(
      Buffer.from(`artech:${user.id}`).slice(0, 32)
    );

    const options: PublicKeyCredentialCreationOptionsJSON =
      await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName: user.username,
        userID,
        userDisplayName: user.username,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
        excludeCredentials,
      });

    // Simpan challenge ke cookie httpOnly sementara
    await setChallengeCookie(options.challenge);

    await logAccess("passkey_register_options", user.id, req, { rpID, origin });

    return NextResponse.json({ options });
  } catch (err: any) {
    console.error("[API POST /auth/passkey/register-options]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal generate registration options" },
      { status: 500 }
    );
  }
}
