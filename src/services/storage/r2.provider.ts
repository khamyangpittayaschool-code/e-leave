/**
 * Cloudflare R2 Storage Provider — S3-compatible object storage
 *
 * ข้อดี:
 *  - Zero egress fee (ดาวน์โหลดฟรี — ต่างจาก AWS S3)
 *  - Free tier 10 GB/เดือน + 1M Class-A operations
 *  - ใช้ @aws-sdk/client-s3 ชุดเดิมได้เลย
 *  - Presigned URL สำหรับ private bucket
 *  - รองรับ custom domain (เช่น cdn.school.com)
 *
 * ต้องการ env vars:
 *   R2_ACCOUNT_ID    = Cloudflare Account ID (จาก dashboard)
 *   R2_ACCESS_KEY    = R2 API Token Access Key ID
 *   R2_SECRET_KEY    = R2 API Token Secret Access Key
 *   R2_BUCKET        = ชื่อ bucket (เช่น repair-photos)
 *   R2_PUBLIC_DOMAIN = (optional) https://cdn.school.com — ถ้าตั้ง custom domain
 *                      ถ้าไม่มีจะใช้ presigned URL แทน
 *
 * วิธีสร้าง API Token:
 *   Cloudflare Dashboard → R2 → Manage API Tokens → Create Token
 *   Permission: Object Read & Write บน bucket ที่ต้องการ
 *
 * Set STORAGE_PROVIDER=r2 in .env to activate.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./provider.interface";

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 ชั่วโมง

function getClient(): { client: S3Client; bucket: string; publicDomain: string | null } {
  const accountId   = process.env.R2_ACCOUNT_ID;
  const accessKey   = process.env.R2_ACCESS_KEY;
  const secretKey   = process.env.R2_SECRET_KEY;
  const bucket      = process.env.R2_BUCKET ?? "repair-photos";
  const publicDomain = process.env.R2_PUBLIC_DOMAIN ?? null;

  if (!accountId || !accessKey || !secretKey) {
    throw new Error(
      "Cloudflare R2 ยังไม่ได้ตั้งค่า\n" +
      "ต้องการ: R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY\n" +
      "สร้าง API Token ได้ที่ Cloudflare Dashboard → R2 → Manage API Tokens"
    );
  }

  const client = new S3Client({
    // R2 endpoint format: https://<account-id>.r2.cloudflarestorage.com
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto", // R2 ใช้ "auto" เสมอ
    credentials: {
      accessKeyId:     accessKey,
      secretAccessKey: secretKey,
    },
    // จำเป็นสำหรับ non-AWS S3-compatible endpoints
    forcePathStyle: false,
  });

  return { client, bucket, publicDomain };
}

export class R2StorageProvider implements StorageProvider {
  async upload({
    buffer,
    mimeType,
    storageKey,
  }: {
    buffer: Buffer;
    mimeType: string;
    storageKey: string;
  }): Promise<void> {
    const { client, bucket } = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket:      bucket,
        Key:         storageKey,
        Body:        buffer,
        ContentType: mimeType,
      })
    );
  }

  async getUrl(storageKey: string): Promise<string> {
    const { client, bucket, publicDomain } = getClient();

    // ถ้ามี custom domain (public bucket) → return URL ตรง ไม่ต้อง presign
    if (publicDomain) {
      const base = publicDomain.replace(/\/$/, "");
      return `${base}/${storageKey}`;
    }

    // Private bucket → presigned URL
    const command = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
    return getSignedUrl(client, command, { expiresIn: SIGNED_URL_EXPIRY_SECONDS });
  }

  async delete(storageKey: string): Promise<void> {
    const { client, bucket } = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })
    );
  }
}
