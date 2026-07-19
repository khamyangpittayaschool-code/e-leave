-- 1. ป้องกันขนาดไฟล์รูปภาพไม่ถูกต้อง (fileSize must be > 0)
ALTER TABLE "RepairPhoto" DROP CONSTRAINT IF EXISTS repair_photo_filesize_chk;
ALTER TABLE "RepairPhoto" ADD CONSTRAINT repair_photo_filesize_chk CHECK ("fileSize" > 0);

-- 2. ป้องกันค่าใช้จ่ายซ่อมติดลบ (cost must be NULL or >= 0)
ALTER TABLE "RepairRequest" DROP CONSTRAINT IF EXISTS repair_cost_chk;
ALTER TABLE "RepairRequest" ADD CONSTRAINT repair_cost_chk CHECK ("cost" IS NULL OR "cost" >= 0);

-- 3. Partial Index สำหรับ Archiver Candidates (query เร็วขึ้นมากเพราะ filter เฉพาะงานที่ต้อง archive)
DROP INDEX IF EXISTS idx_repair_archive_candidates;
CREATE INDEX idx_repair_archive_candidates
  ON "RepairRequest" ("updatedAt")
  WHERE status IN ('COMPLETED', 'CANCELLED');

-- 4. GIN Index สำหรับค้นหา Audit Log Metadata (JSONB)
DROP INDEX IF EXISTS idx_systemlog_metadata;
CREATE INDEX idx_systemlog_metadata ON "SystemLog" USING GIN ("metadata");
