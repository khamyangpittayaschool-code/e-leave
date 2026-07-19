/**
 * Supabase Storage Provider — stores files in a Supabase Storage bucket.
 *
 * FOR PRODUCTION USE.
 * Requires env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_STORAGE_BUCKET   (default: "repair-photos")
 *
 * Set STORAGE_PROVIDER=supabase in .env to activate.
 */

import type { StorageProvider } from "./provider.interface";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "repair-photos";
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage ยังไม่ได้ตั้งค่า\n" +
      "ต้องการ: SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY\n" +
      "ดู Project Settings → API ใน Supabase Dashboard"
    );
  }
  // Dynamic import so the package is not bundled when not used
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export class SupabaseStorageProvider implements StorageProvider {
  async upload({
    buffer,
    mimeType,
    storageKey,
  }: {
    buffer: Buffer;
    mimeType: string;
    storageKey: string;
  }): Promise<void> {
    const client = getClient();
    const { error } = await client.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  }

  async getUrl(storageKey: string): Promise<string> {
    const client = getClient();
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(storageKey, SIGNED_URL_EXPIRY_SECONDS);
    if (error || !data?.signedUrl) {
      throw new Error(`Supabase signed URL failed: ${error?.message}`);
    }
    return data.signedUrl;
  }

  async delete(storageKey: string): Promise<void> {
    const client = getClient();
    const { error } = await client.storage.from(BUCKET).remove([storageKey]);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }
}
