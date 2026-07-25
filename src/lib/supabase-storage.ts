// src/lib/supabase-storage.ts — Supabase Storage adapter (PRODUCTION)
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY env vars required");
    }
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

const BUCKET = "artech-uploads";

export async function uploadFile(
  buffer: Buffer,
  relativePath: string
): Promise<{ url: string; path: string }> {
  const supabase = getClient();
  // Sanitize path — keep subdir structure but clean filename
  const safePath = relativePath
    .split("/")
    .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .join("/");
  const uniquePath = `${Date.now()}-${safePath}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(uniquePath, buffer, { upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(uniquePath);

  return { url: urlData.publicUrl, path: uniquePath };
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const supabase = getClient();
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    return !error;
  } catch {
    return false;
  }
}
