// src/lib/webauthn.ts — Helper untuk WebAuthn (challenge cookie + base64url conversions)
import { cookies } from "next/headers";

export const CHALLENGE_COOKIE = "artech-webauthn-challenge";
const CHALLENGE_MAX_AGE = 300; // 5 menit (detik)

/**
 * Simpan challenge WebAuthn ke cookie httpOnly sementara (TTL 5 menit).
 */
export async function setChallengeCookie(challenge: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_MAX_AGE,
    path: "/",
  });
}

/**
 * Ambil challenge dari cookie. Return null kalau tidak ada.
 */
export async function getChallengeCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CHALLENGE_COOKIE)?.value ?? null;
}

/**
 * Hapus challenge cookie.
 */
export async function clearChallengeCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CHALLENGE_COOKIE);
}

/**
 * Decode base64url string ke Uint8Array (dibackend oleh ArrayBuffer fresh, bukan view).
 *
 * Penting: pakai `new Uint8Array(length)` + `.set()` (bukan `new Uint8Array(buffer)`),
 * karena TS mengetik hasil `new Uint8Array(buffer)` sebagai `Uint8Array<ArrayBufferLike>`,
 * sementara @simplewebauthn/server expect `Uint8Array<ArrayBuffer>`.
 */
export function base64urlToUint8Array(b64url: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(b64url, "base64url");
  const out = new Uint8Array(buf.length);
  out.set(buf);
  return out;
}

/**
 * Encode Uint8Array ke base64url string.
 */
export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
