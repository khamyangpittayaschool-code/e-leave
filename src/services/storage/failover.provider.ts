/**
 * Failover Storage Provider
 *
 * ลองอัปโหลดไปยัง provider ตามลำดับ — ถ้า provider แรกเต็มหรือ error
 * จะสลับไป provider ถัดไปโดยอัตโนมัติ (ผู้ใช้ไม่รู้ตัว)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * storageKey format: "p<index>:<actual_key>"
 *   "p0:REP-2026-000001/BEFORE-0.webp" → provider index 0
 *   "p1:REP-2026-000001/BEFORE-0.webp" → provider index 1
 *
 * prefix นี้ถูกเก็บใน DB และใช้ route getUrl()/delete()
 * ไปยัง provider ที่ถูกต้องในเวลา runtime
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * การตรวจ Quota Error:
 * จะถือว่า "full" เมื่อ error message มี keyword:
 *   storage_full, quota, limit, exceeded, over_limit
 * Error อื่น ๆ (network, auth) จะ throw ทันที ไม่ fallback
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ตัวอย่าง env (Supabase 2 โปรเจกต์):
 *
 *   STORAGE_PROVIDER=failover
 *   # โปรเจกต์ 1 (primary)
 *   SUPABASE_FAILOVER_0_URL=https://xxx.supabase.co
 *   SUPABASE_FAILOVER_0_KEY=service_role_key_1
 *   SUPABASE_FAILOVER_0_BUCKET=repair-photos
 *   # โปรเจกต์ 2 (secondary)
 *   SUPABASE_FAILOVER_1_URL=https://yyy.supabase.co
 *   SUPABASE_FAILOVER_1_KEY=service_role_key_2
 *   SUPABASE_FAILOVER_1_BUCKET=repair-photos
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { StorageProvider } from "./provider.interface";

// Keywords ที่บ่งบอกว่า storage เต็ม / quota หมด
const QUOTA_ERROR_KEYWORDS = [
  "storage_full",
  "quota",
  "limit",
  "exceeded",
  "over_limit",
  "capacity",
  "insufficient",
  "no space",
  "insufficient_storage",
];

function isQuotaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return QUOTA_ERROR_KEYWORDS.some((kw) => msg.includes(kw));
}

// ─── storageKey encoding ──────────────────────────────────────────────────────

/** เพิ่ม prefix ระบุ provider index: "p0:actual/key.webp" */
function encodeKey(providerIndex: number, actualKey: string): string {
  return `p${providerIndex}:${actualKey}`;
}

/** แกะ prefix ออก → { index: 0, key: "actual/key.webp" } */
function decodeKey(storageKey: string): { index: number; key: string } {
  const match = storageKey.match(/^p(\d+):(.+)$/);
  if (!match) {
    // ถ้าไม่มี prefix (backward compat) ใช้ provider 0
    return { index: 0, key: storageKey };
  }
  return { index: parseInt(match[1], 10), key: match[2] };
}

// ─── FailoverStorageProvider ──────────────────────────────────────────────────

export class FailoverStorageProvider implements StorageProvider {
  constructor(private readonly providers: StorageProvider[]) {
    if (providers.length === 0) {
      throw new Error("FailoverStorageProvider ต้องมี provider อย่างน้อย 1 ตัว");
    }
  }

  /** ลอง upload ตามลำดับ — failover เฉพาะ quota error */
  async upload(params: {
    buffer: Buffer;
    mimeType: string;
    storageKey: string;
  }): Promise<void> {
    const originalKey = params.storageKey;
    const errors: string[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      try {
        await this.providers[i].upload({
          buffer: params.buffer,
          mimeType: params.mimeType,
          storageKey: originalKey,
        });
        
        // สำเร็จ — rewrite storageKey ใน params เพื่อให้ caller รู้ว่าใช้ provider ไหน
        params.storageKey = encodeKey(i, originalKey);
        console.log(`[Storage] Upload สำเร็จที่ provider ${i} (key: ${params.storageKey})`);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        if (isQuotaError(err)) {
          console.warn(`[Storage] Provider ${i} เต็มหรือ quota หมด (${msg}) — สลับไป provider ${i + 1}`);
          errors.push(`Provider ${i}: quota error — ${msg}`);
          continue; // ลองตัวถัดไป
        }

        // Error ประเภทอื่น (auth, network) → throw ทันที ไม่ลอง fallback
        throw err;
      }
    }

    throw new Error(
      `[Storage Failover] ทุก provider ล้มเหลว:\n${errors.join("\n")}`
    );
  }

  /** route getUrl ไปยัง provider ที่ถูกต้องตาม prefix ใน storageKey */
  async getUrl(storageKey: string): Promise<string> {
    const { index, key } = decodeKey(storageKey);
    const provider = this.providers[index];
    if (!provider) {
      throw new Error(`[Storage Failover] ไม่พบ provider index ${index}`);
    }
    return provider.getUrl(key);
  }

  /** route delete ไปยัง provider ที่ถูกต้อง */
  async delete(storageKey: string): Promise<void> {
    const { index, key } = decodeKey(storageKey);
    const provider = this.providers[index];
    if (!provider) {
      throw new Error(`[Storage Failover] ไม่พบ provider index ${index}`);
    }
    return provider.delete(key);
  }
}

// Export helpers เพื่อให้ photo.service.ts ใช้สร้าง encoded key ก่อน upload
export { encodeKey as encodeStorageKey, decodeKey as decodeStorageKey };
