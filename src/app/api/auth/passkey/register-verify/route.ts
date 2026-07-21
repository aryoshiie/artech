// src/app/api/auth/passkey/register-verify/route.ts
// Verify registration response dari browser + simpan credential ke DB.

import { NextRequest, NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getCurrentUser, logAccess } from "@/lib/auth";
import {
  clearChallengeCookie,
  getChallengeCookie,
  uint8ArrayToBase64url,
} from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — login diperlukan" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { credential, name } = body as {
      credential?: RegistrationResponseJSON;
      name?: string;
    };

    if (!credential || !credential.id || !credential.rawId) {
      return NextResponse.json(
        { error: "Field wajib: credential (PublicKeyCredentialJSON)" },
        { status: 400 }
      );
    }

    const expectedChallenge = await getChallengeCookie();
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge tidak ditemukan atau sudah kedaluwarsa. Ulangi registrasi." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const rpID = url.hostname;
    const origin = url.origin;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false, // preferred, bukan required (UX lebih santai)
    });

    if (!verification.verified || !verification.registrationInfo) {
      await logAccess("passkey_register_failed", user.id, req, {
        reason: "verification_failed",
      });
      return NextResponse.json(
        { error: "Verifikasi registrasi gagal" },
        { status: 400 }
      );
    }

    const info = verification.registrationInfo;
    const credentialId = info.credential.id;
    const publicKeyB64url = uint8ArrayToBase64url(info.credential.publicKey);
    const counter = info.credential.counter;
    const transports = info.credential.transports ?? [];
    const deviceType = info.credentialDeviceType; // "singleDevice" | "multiDevice"

    // Cek duplikat (sama-sama credential ID)
    const existing = await db.passkey.findUnique({ where: { id: credentialId } });
    if (existing) {
      return NextResponse.json(
        { error: "Passkey dengan credential ID ini sudah terdaftar" },
        { status: 409 }
      );
    }

    const passkey = await db.passkey.create({
      data: {
        id: credentialId,
        userId: user.id,
        publicKey: publicKeyB64url,
        counter,
        deviceType,
        transports: JSON.stringify(transports),
        name: name?.trim() || null,
      },
    });

    await clearChallengeCookie();
    await logAccess("passkey_register", user.id, req, {
      passkeyId: passkey.id,
      deviceType,
      name: passkey.name ?? undefined,
    });

    return NextResponse.json({ success: true, passkeyId: passkey.id });
  } catch (err: any) {
    console.error("[API POST /auth/passkey/register-verify]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal verifikasi registrasi passkey" },
      { status: 500 }
    );
  }
}
