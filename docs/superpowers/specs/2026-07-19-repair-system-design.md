# ระบบแจ้งซ่อม (Repair Request System) — Design Specification v7.2 (Production-Scale Blueprint)

เอกสารนี้กำหนดสถาปัตยกรรมระดับองค์กร (Production-Scale Enterprise Architecture) ของ **ระบบแจ้งซ่อม** ซึ่งเป็นระบบย่อยเพิ่มเติมในกลุ่มงานทั่วไปสำหรับระบบ **eLeave & School OS** เพื่อรองรับการทำงานในระยะยาว (5-10 ปี) โดยไม่มีปัญหาฐานข้อมูลบวม ทำการแบ็คอัพง่าย ป้องกันปัญหาสิทธิ์เข้าถึงข้อมูลด้านงบประมาณการเงิน และโครงสร้างที่ลดความผูกมัดทางเทคโนโลยี (Decoupled Layer Architecture)

---

## 1. โครงสร้างสิทธิ์และการจัดคู่บทบาท (Role-Capability Permission Matrix)

เพื่อป้องกันการเขียนโค้ดเช็คบทบาทแบบดิบ ทุกการอัปเดตจะพึ่งพาคุณสมบัติสิทธิ์ (Capability-Based Permissions) ในไฟล์ [src/lib/permissions.ts](file:///C:/dev/eLeave/src/lib/permissions.ts) มีรายละเอียดแผนผังความสัมพันธ์ดังนี้:

| บทบาท (Role) | สิทธิ์การเข้าถึง (Repair Permissions) | คำอธิบายพฤติกรรม |
|---|---|---|
| **TEACHER** (ผู้แจ้ง) | `repair:create`, `repair:view.own` | ส่งใบงานใหม่ และตรวจสอบดูประวัติเฉพาะที่ตนแจ้ง |
| **TECHNICIAN** (ช่าง) | `repair:view.all`, `repair:update` | ตรวจสอบใบงานทั้งหมด อัปเดตการทำรายงานวัสดุ-สถานะ |
| **HEAD** (หัวหน้าหมวดทั่วไป) | `repair:view.all`, `repair:assign`, `repair:view.cost` | มอบหมายช่าง ตรวจสอบราคาค่าซ่อมและควบคุมประเมิน |
| **ADMIN** (แอดมินสูงสุด) | `repair:create`, `repair:view.own`, `repair:view.all`, `repair:view.cost`, `repair:assign`, `repair:update`, `repair:export`, `repair:delete`, `repair:archive` | มีสิทธิ์ครบถ้วน รวมถึงการลบข้อมูล (Soft Delete) และกวาดล้าง Archive |

---

## 2. โครงสร้างสถาปัตยกรรมรูปภาพและการจัดเก็บ (Storage Provider Folder Scheme)

รูปภาพจะไม่มีการจัดเก็บในฐานข้อมูล (Metadata Only) และจะไม่มีการเก็บลิงก์ URL สาธารณะตรงๆ ในฐานข้อมูล เพื่อป้องกันปัญหา URL เสียหายหรือเมื่อมีการเปลี่ยนโดเมนระบบคลาวด์ในอนาคต

- **โครงสร้างโฟลเดอร์**: แยกสถาปัตยกรรมการต่อเชื่อมรูปภาพไว้ภายใต้ `src/services/storage/` ดังนี้:
  - `StorageProvider.ts` (Interface)
  - `providers/local.provider.ts` (สำหรับ Local Disk ในช่วง Development)
  - `providers/supabase.provider.ts` (สำหรับ Supabase Storage ในช่วง Production)
  - `providers/s3.provider.ts` (สำหรับ S3-Compatible/Neon Storage ในอนาคต)
- **การนำไปแสดงผล**: สร้าง URL ชั่วคราว (Signed URL) หรือจัดส่ง URL จาก `PhotoService` ตอน Runtime โดยอ้างอิงจาก `storageKey`
- **ขีดจำกัดรูปภาพ**: แนบรูปก่อนซ่อม (BEFORE) ได้สูงสุด **2 รูป** และหลังซ่อม (AFTER) ได้สูงสุด **2 รูป** (รวมสูงสุด 4 รูปต่อใบงาน)
- **การบีบอัดรูปภาพ (Image Policy)**: 
  - ขนาดความกว้างสูงสุด 800px บีบอัดด้วย JPEG (Quality = 0.7)
  - ขนาดเป้าหมายหลังบีบอัด **100 KB - 300 KB**
- **ฟิลด์ข้อมูลตารางรูปภาพ**:
  - `storageKey`: คีย์อ้างอิงไฟล์ (เช่น `repairs/REP-2026-000012-before-1.jpg`)
  - `mimeType`: ประเภทคอนเทนต์ของไฟล์ภาพ เช่น `image/jpeg`
  - `fileSize`: ขนาดจริงของไฟล์รูปในหน่วย Bytes

---

## 3. สถาปัตยกรรมการแยกเลเยอร์ (Decoupled Layer Architecture)

เพื่อความง่ายในการทดสอบและบำรุงรักษา (Maintainability) โครงสร้างการเขียนโค้ดจะถูกแบ่งออกเป็น 3 เลเยอร์หลัก:

### A. Repositories Layer (`src/repositories/`)
- ทำหน้าที่คุยกับ Prisma Client และฐานข้อมูลโดยตรง โดยห้ามปน Business Logic
- ไฟล์หลัก: `repair.repository.ts`

### B. Services Layer (`src/services/`)
- จัดการ Business Logic, สิทธิ์, กฎการทำ Validations, การบันทึก Audit Logs และประสานการทำงาน
- ไฟล์หลัก:
  - `repair.service.ts`: ดำเนินกระบวนการแจ้งซ่อม CRUD
  - `photo.service.ts`: อัปโหลดบีบอัดและออก URL ด้วยการคุยผ่าน `StorageProvider`
  - `archive.service.ts`: กวดขันกระบวนการโอนย้ายจดหมายเหตุย้อนหลัง
  - `audit.service.ts`: บันทึกประวัติกิจกรรมด้วยความปลอดภัย

### C. Actions Layer (`src/app/actions/repair/`)
- ตัวกลางของ Server Actions คอยรับอินพุต ตรวจสอบความปลอดภัยเบื้องต้น และส่งงานให้ Services Layer ทำงาน
- ไฟล์หลัก: `create.ts`, `update.ts`, `assign.ts`, `archive.ts`, `delete.ts`

---

## 4. โครงสร้างฐานข้อมูลอัปเกรด (Database Schema v7.2)

การปรับปรุงโมเดลระบบแจ้งซ่อมใน [schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma):

```prisma
enum RepairStatus {
  PENDING
  ASSIGNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum RepairUrgency {
  NORMAL
  URGENT
  URGENT_MOST
}

enum RepairPhotoType {
  BEFORE
  AFTER
}

enum RepairCategory {
  ELECTRICAL
  PLUMBING
  BUILDING
  IT
  EQUIPMENT
  OTHER
}

enum SLAStatus {
  ON_TIME
  WARNING
  OVERDUE
}

// ตารางสำหรับป้องกัน Concurrency ในการออกรหัสใบแจ้งซ่อม (Thread-Safe Sequence generator)
model RunningNumber {
  key     String @id // e.g. "repair_2026"
  year    Int
  current Int
}

// ตารางแจ้งซ่อมหลัก
model RepairRequest {
  id             String          @id @default(cuid())
  repairNo       String          @unique // รหัสอ้างอิง เช่น REP-2026-000123
  title          String
  description    String          @db.Text
  location       String
  urgency        RepairUrgency   @default(NORMAL)
  category       RepairCategory  @default(OTHER)
  status         RepairStatus    @default(PENDING)
  version        Int             @default(1)      // Optimistic Concurrency Control (OCC) Version
  requesterId    String
  requester      User            @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
  assigneeId     String?
  assignee       User?           @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
  resolutionNote String?         @db.Text
  cost           Decimal?        @db.Decimal(10, 2)
  materialsUsed  String?         @db.Text
  cancelReason   String?         @db.Text
  expectedFinishAt DateTime?     // เวลาสำหรับ SLA Tracking
  actualFinishAt   DateTime?     // เวลาเสร็จจริงวัดผล KPI
  slaStatus      SLAStatus?      // บันทึกสถานะ SLA เช่น ON_TIME, WARNING, OVERDUE เพื่อความแม่นยำในการเรียกดูรายงาน
  assignedAt     DateTime?
  finishedAt     DateTime?
  deletedAt      DateTime?       // Soft Delete Flag
  deletedBy      String?         // ระบุผู้ดำเนินการลบ (Soft Delete)
  deleteReason   String?         // ระบุเหตุผลการลบ
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  photos         RepairPhoto[]

  @@index([status, createdAt(sort: Desc)])
  @@index([status, updatedAt])
  @@index([assigneeId, status])
  @@index([requesterId, status])
  @@index([updatedAt])
  @@index([id, version]) // ดัชนีรองรับการอัปเดต Concurrency (OCC)
}

// ตารางอ้างอิงรูปภาพ
model RepairPhoto {
  id         String          @id @default(cuid())
  repairId   String
  photoType  RepairPhotoType
  mimeType   String
  fileSize   Int
  storageKey String          // ตำแหน่งใน Cloud Storage (ห้ามเก็บ url ป้องกันปัญหา broken links)
  createdAt  DateTime        @default(now())
  
  repair     RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
  @@index([repairId, photoType])
}

// ตารางจดหมายเหตุแจ้งซ่อมย้อนหลัง
model RepairRequestArchive {
  id             String          @id // เก็บค่า id เดิมเพื่อความต่อเนื่องข้อมูล
  repairNo       String          @unique
  title          String
  description    String          @db.Text
  location       String
  urgency        RepairUrgency
  category       RepairCategory
  status         RepairStatus
  version        Int             // เก็บเวอร์ชัน ณ ตอนที่ย้ายเก็บเป็นจดหมายเหตุจริง
  requesterId    String
  assigneeId     String?
  resolutionNote String?         @db.Text
  cost           Decimal?        @db.Decimal(10, 2)
  materialsUsed  String?         @db.Text
  cancelReason   String?         @db.Text
  expectedFinishAt DateTime?
  actualFinishAt   DateTime?
  slaStatus      SLAStatus?
  assignedAt     DateTime?
  finishedAt     DateTime?
  createdAt      DateTime
  updatedAt      DateTime
  archivedAt     DateTime        @default(now()) // เวลาที่ถูกเก็บเข้าจดหมายเหตุ
  photos         RepairPhotoArchive[]
}

// ตารางจดหมายเหตุรูปภาพ
model RepairPhotoArchive {
  id         String               @id
  repairId   String
  photoType  RepairPhotoType
  mimeType   String
  fileSize   Int
  storageKey String
  createdAt  DateTime
  archivedAt DateTime             @default(now())
  
  repair     RepairRequestArchive @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
  @@index([storageKey]) // [NEW] ดัชนีในการทำความสะอาด ตรวจเช็คไฟล์กำพร้า หรือการย้ายเซิร์ฟเวอร์
}

// โมเดลเก็บประบบเดิม เพิ่ม JSON Metadata
model SystemLog {
  id          String   @id @default(cuid())
  actionType  String
  description String
  userId      String
  metadata    Json?    // เก็บข้อมูลดิบ เช่น repairId, actorId, action เพื่อทำรายงานในอนาคต
  createdAt   DateTime @default(now())
}
```

และเพิ่มความสัมพันธ์กลับในโมเดล `User`:
```prisma
model User {
  // ... (ฟิลด์เดิม)
  requestsCreated  RepairRequest[] @relation("RequestCreatedBy")
  requestsAssigned RepairRequest[] @relation("RequestAssignedTo")
}
```

### Custom Migration SQL (นอกเหนือจาก Prisma Schema)
คำสั่ง SQL ด้านล่างจะถูกเพิ่มในไฟล์ Migration Script ด้วยตนเองหลังจาก Prisma สร้างไฟล์ให้แล้ว:
```sql
-- 1. ป้องกันขนาดไฟล์รูปภาพไม่ถูกต้อง
ALTER TABLE "RepairPhoto" ADD CONSTRAINT repair_photo_filesize_chk CHECK ("fileSize" > 0);

-- 2. ป้องกันค่าใช้จ่ายซ่อมติดลบ
ALTER TABLE "RepairRequest" ADD CONSTRAINT repair_cost_chk CHECK ("cost" IS NULL OR "cost" >= 0);

-- 3. Partial Index สำหรับ Archiver Candidates (เร็วกว่า full index มาก)
CREATE INDEX idx_repair_archive_candidates ON "RepairRequest" ("updatedAt") WHERE status IN ('COMPLETED', 'CANCELLED');

-- 4. GIN Index สำหรับค้นหา Audit Log Metadata (JSONB)
CREATE INDEX idx_systemlog_metadata ON "SystemLog" USING GIN ("metadata");
```

---

## 5. การจัดการ Concurrency & Logic ชั้นสูง (Compare-And-Swap & Locks)

- **Optimistic Concurrency Control (OCC)**:
  ในการเปลี่ยนแปลงข้อมูลทุกครั้ง จะต้องส่งตัวเลข `version` ปัจจุบันเข้าไปในเงื่อนไขการอัปเดตเพื่อหลีกเลี่ยง Lost Update:
  ```typescript
  const result = await prisma.repairRequest.updateMany({
    where: {
      id: repairId,
      version: currentVersion,
      deletedAt: null // จัดการเฉพาะงานที่ยังไม่ถูกลบ
    },
    data: {
      status: nextStatus,
      version: { increment: 1 }, // อัปเดตเวอร์ชันขึ้นแบบ Atomic
      ...
    }
  });

  if (result.count === 0) {
    throw new Error("งานนี้ได้รับรายงานหรือแก้ไขโดยช่างท่านอื่นแล้ว กรุณารีเฟรชเพื่อรับค่าล่าสุด");
  }
  ```
- **Thread-Safe ID Generation**:
  การดึงหมายเลขใบแจ้งซ่อม `repairNo` เพื่อป้องกัน Race Condition จากผู้ใช้หลายคนส่งใบแจ้งซ่อมเข้ามาในเวลาใกล้เคียงกัน จะหลีกเลี่ยงการทำ `SELECT MAX()` นอก Transaction โดยเปลี่ยนมาทำ Atomic Increment บนตาราง `RunningNumber` ภายใน Write Transaction เดียวกัน:
  ```typescript
  const running = await tx.runningNumber.update({
    where: { key: `repair_${currentYear}` },
    data: { current: { increment: 1 } }
  });
  const repairNo = `REP-${currentYear}-${String(running.current).padStart(6, '0')}`;
  ```

- **การย้ายประวัติด้วยจดหมายเหตุ (ETL Archiving)**:
  ประมวลผลกวาดล้างข้อมูล Completed/Cancelled ที่อายุเกิน 180 วัน:
  1. การรันทั้งหมดรันภายใต้ `prisma.$transaction(..., { timeout: 30000 })` พร้อมการทำ pg_advisory_xact_lock(45729) เพื่อป้องกันการเข้าคิวซ้ำซ้อน
  2. โอนย้ายข้อมูลเข้าตารางจดหมายเหตุ `RepairRequestArchive` และ `RepairPhotoArchive` โดยไม่มีการทำลายรูปภาพบน Object Storage
  3. ลบรายการหลัก `RepairRequest` และบันทึกประวัติสำเร็จอย่างปลอดภัย

---

## 6. แบ็คล็อกการเฝ้าระวังและการปรับปรุงหลังขึ้นระบบจริง (Post-Go-Live Operations)

🎫 **[STG-001] Migrate RepairPhoto Storage Configuration**
- *รายละเอียด*: เฝ้าระวังเนื้อที่บน Object Storage (Supabase/S3) และประสิทธิภาพของ Signed URL

---
*(เอกสารการออกแบบฉบับสมบูรณ์ v7.2 ได้รับการปรับปรุงเป็นพิมพ์เขียวระดับองค์กรเรียบร้อย)*
