// src/app/api/auth/passkey/login-verify/route.ts
// Verify authentication response + login user (createSession).

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import {
  createSession,
  logAccess,
  SESSION_COOKIE,
} from "@/lib/auth";
import {
  base64urlToUint8Array,
  clearChallengeCookie,
  getChallengeCookie,
} from "@/lib/webauthn";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 hari (detik)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { credential } = body as { credential?: AuthenticationResponseJSON };

    if (!credential || !credential.id || !credential.rawId) {
      return NextResponse.json(
        { error: "Field wajib: credential (PublicKeyCredentialJSON)" },
        { status: 400 }
      );
    }

    const expectedChallenge = await getChallengeCookie();
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge tidak ditemukan atau sudah kedaluwarsa. Ulangi login passkey." },
        { status: 400 }
      );
    }

    // Cari passkey by credential ID
    const passkey = await db.passkey.findUnique({
      where: { id: credential.id },
      include: { user: true },
    });

    if (!passkey) {
      await logAccess("login_failed", null, req, {
        reason: "passkey_not_found",
        credentialId: credential.id,
      });
      return NextResponse.json(
        { error: "Passkey tidak dikenali" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const rpID = url.hostname;
    const origin = url.origin;

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: base64urlToUint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports
          ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      await logAccess("login_failed", passkey.userId, req, {
        reason: "passkey_verification_failed",
        credentialId: credential.id,
      });
      return NextResponse.json(
        { error: "Verifikasi passkey gagal" },
        { status: 401 }
      );
    }

    // Update counter + lastUsedAt
    await db.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    // Create session + set cookie
    const token = await createSession(passkey.userId, req);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    await clearChallengeCookie();
    await logAccess("passkey_login", passkey.userId, req, {
      username: passkey.user.username,
      passkeyId: passkey.id,
    });

    return NextResponse.json({ success: true, username: passkey.user.username });
  } catch (err: any) {
    console.error("[API POST /auth/passkey/login-verify]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal verifikasi login passkey" },
      { status: 500 }
    );
  }
}
