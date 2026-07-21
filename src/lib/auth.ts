// src/lib/auth.ts — Helper untuk auth (session, password, access log)
import { db } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "artech-session";
const SESSION_EXPIRY_DAYS = 30;

/**
 * Generate random token untuk session cookie.
 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash password dengan bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password terhadap hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get user dari session cookie (server-side).
 * Returns null kalau tidak login / session expired.
 */
export async function getCurrentUser(): Promise<{ id: string; username: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await db.authSession.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.authSession.delete({ where: { id: session.id } });
      return null;
    }
    return { id: session.user.id, username: session.user.username };
  } catch {
    return null;
  }
}

/**
 * Create session baru untuk user + set cookie.
 */
export async function createSession(userId: string, request?: Request): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || undefined;
  const userAgent = request?.headers.get("user-agent") || undefined;

  await db.authSession.create({
    data: { userId, token, expiresAt, ipAddress, userAgent },
  });
  return token;
}

/**
 * Logout: hapus session dari DB + clear cookie.
 */
export async function deleteSession(token: string): Promise<void> {
  try {
    await db.authSession.deleteMany({ where: { token } });
  } catch { /* ignore */ }
}

/**
 * Log access event ke DB + kirim notifikasi ke owner via webhook (kalau ada).
 */
export async function logAccess(
  event: string,
  userId?: string | null,
  request?: Request,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || undefined;
    const userAgent = request?.headers.get("user-agent") || undefined;

    await db.accessLog.create({
      data: {
        userId: userId || null,
        event,
        ipAddress,
        userAgent,
        metadata: metadata || undefined,
      },
    });

    // Kirim notifikasi ke owner kalau event = login_failed atau access_denied
    if (event === "login_failed" || event === "access_denied") {
      await notifyOwner(event, { ipAddress, userAgent, ...metadata });
    }
  } catch (e) {
    console.error("[logAccess] error:", e);
  }
}

/**
 * Kirim notifikasi ke owner via n8n webhook (kalau ownerNotifyWebhook di-set).
 */
async function notifyOwner(event: string, data: Record<string, any>): Promise<void> {
  try {
    const settings = await db.settings.findUnique({ where: { id: "singleton" } });
    const webhookUrl = settings?.ownerNotifyWebhook;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "security_alert",
        event,
        timestamp: new Date().toISOString(),
        ...data,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* silent fail */ }
}

/**
 * Setup owner user pertama kali (dipakai di /setup page).
 * Hanya bisa dipanggil kalau belum ada user di DB.
 */
export async function createOwnerUser(username: string, password: string): Promise<{ id: string }> {
  const existing = await db.user.count();
  if (existing > 0) {
    throw new Error("Owner user sudah ada. Tidak bisa setup ulang.");
  }
  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { username, passwordHash },
  });
  return { id: user.id };
}

/**
 * Cek apakah setup sudah dilakukan (ada user).
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const count = await db.user.count();
    return count > 0;
  } catch {
    return false;
  }
}
