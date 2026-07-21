// src/lib/supabase-storage.ts — Upload file ke Supabase Storage
// File upload (Opsi B): upload ke Supabase Storage, kirim URL ke n8n

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _client: ReturnType<typeof createClient> | null = null;

function client() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum di-set di env");
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

const BUCKET = "artech-uploads";

/**
 * Init bucket Supabase Storage kalau belum ada.
 * Dipanggil sekali saat startup (atau pertama upload).
 */
export async function ensureBucket(): Promise<void> {
  try {
    const c = client();
    const { data, error } = await c.storage.getBucket(BUCKET);
    if (error && error.message.includes("not found")) {
      await c.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "50MB" });
    }
  } catch (e) {
    // Silent fail — bucket mungkin sudah ada
  }
}

/**
 * Upload file ke Supabase Storage.
 *
 * @param file Buffer atau Blob
 * @param path Path lengkap di bucket, mis. "session-abc/file.txt"
 * @returns { url, path } — signed URL (50 tahun) untuk akses dari n8n
 */
export async function uploadFile(
  file: Blob | Buffer | ArrayBuffer,
  path: string
): Promise<{ url: string; path: string }> {
  await ensureBucket();
  const c = client();

  // Upload
  const { error: upErr } = await c.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "application/octet-stream",
  });
  if (upErr) throw new Error(`Upload gagal: ${upErr.message}`);

  // Buat signed URL (valid 50 tahun = 18250 hari) supaya n8n bisa fetch tanpa auth
  const { data, error: urlErr } = await c.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 50);
  if (urlErr || !data?.signedUrl) throw new Error(`Gagal buat signed URL: ${urlErr?.message}`);

  return { url: data.signedUrl, path };
}

/**
 * Hapus file dari Supabase Storage.
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    await client().storage.from(BUCKET).remove([path]);
  } catch {
    // Silent fail
  }
}
