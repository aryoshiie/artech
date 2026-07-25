// src/lib/supabase-storage.ts — Local filesystem storage (replaces Supabase)
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "upload");

export async function uploadFile(
  buffer: Buffer,
  relativePath: string
): Promise<{ url: string; path: string }> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  // Sanitize: only keep filename, ignore subdirs
  const safeName = path
    .basename(relativePath)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")}-${safeName}`;
  const fullPath = path.join(UPLOAD_DIR, uniqueName);
  await fs.writeFile(fullPath, buffer);
  return { url: `/upload/${uniqueName}`, path: uniqueName };
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const fullPath = path.join(UPLOAD_DIR, path.basename(filePath));
    await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}
