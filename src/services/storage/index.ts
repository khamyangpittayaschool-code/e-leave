/**
 * Storage Provider Factory
 *
 * Returns the correct provider based on STORAGE_PROVIDER env var.
 *   "r2"       → R2StorageProvider       (production — Cloudflare R2, zero egress, free 10GB)
 *   "neon"     → NeonStorageProvider    (production — Neon Object Storage, branch-aware)
 *   "supabase" → SupabaseStorageProvider
 *   "local"    → LocalStorageProvider   (dev fallback)
 *
 * Usage:
 *   import { getStorageProvider } from "@/services/storage";
 *   const storage = getStorageProvider();
 *   await storage.upload({ buffer, mimeType, storageKey });
 *   const url = await storage.getUrl(storageKey);
 */

import type { StorageProvider } from "./provider.interface";

let _instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_instance) return _instance;

  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "failover") {
    const { FailoverStorageProvider } = require("./failover.provider");
    const { SupabaseInstanceProvider } = require("./supabase-instance.provider");
    const providers: StorageProvider[] = [];

    // Dynamically load failover instances
    let index = 0;
    while (true) {
      const url = process.env[`SUPABASE_FAILOVER_${index}_URL`];
      const key = process.env[`SUPABASE_FAILOVER_${index}_KEY`];
      const bucket = process.env[`SUPABASE_FAILOVER_${index}_BUCKET`] ?? "repair-photos";

      if (!url || !key) {
        break;
      }

      providers.push(new SupabaseInstanceProvider(url, key, bucket));
      index++;
    }

    if (providers.length === 0) {
      // Fallback to standard Supabase settings if no indexed credentials are set
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "repair-photos";
      if (url && key) {
        providers.push(new SupabaseInstanceProvider(url, key, bucket));
      } else {
        throw new Error(
          "Failover storage provider require at least one configured Supabase instance."
        );
      }
    }

    _instance = new FailoverStorageProvider(providers);
  } else if (provider === "r2") {
    const { R2StorageProvider } = require("./r2.provider");
    _instance = new R2StorageProvider();
  } else if (provider === "neon") {
    const { NeonStorageProvider } = require("./neon.provider");
    _instance = new NeonStorageProvider();
  } else if (provider === "supabase") {
    const { SupabaseStorageProvider } = require("./supabase.provider");
    _instance = new SupabaseStorageProvider();
  } else {
    const { LocalStorageProvider } = require("./local.provider");
    _instance = new LocalStorageProvider();
  }

  return _instance!;
}

export type { StorageProvider } from "./provider.interface";
