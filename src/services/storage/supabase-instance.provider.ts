/**
 * Supabase Storage Provider (Multi-instance version)
 *
 * เหมือน supabase.provider.ts แต่รับ credentials ผ่าน constructor
 * เพื่อรองรับหลาย Supabase project ใน FailoverStorageProvider
 */

import type { StorageProvider } from "./provider.interface";

const SIGNED_URL_EXPIRY_SECONDS = 3600;

export class SupabaseInstanceProvider implements StorageProvider {
  private url: string;
  private key: string;
  private bucket: string;

  constructor(url: string, key: string, bucket: string) {
    this.url    = url;
    this.key    = key;
    this.bucket = bucket;
  }

  private getClient() {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(this.url, this.key);
  }

  async upload({ buffer, mimeType, storageKey }: {
    buffer: Buffer;
    mimeType: string;
    storageKey: string;
  }): Promise<void> {
    const { error } = await this.getClient().storage
      .from(this.bucket)
      .upload(storageKey, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error(error.message);
  }

  async getUrl(storageKey: string): Promise<string> {
    const { data, error } = await this.getClient().storage
      .from(this.bucket)
      .createSignedUrl(storageKey, SIGNED_URL_EXPIRY_SECONDS);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Signed URL failed");
    return data.signedUrl;
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.getClient().storage
      .from(this.bucket)
      .remove([storageKey]);
    if (error) throw new Error(error.message);
  }
}
