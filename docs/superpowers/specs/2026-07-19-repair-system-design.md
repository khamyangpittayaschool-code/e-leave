# ระบบแจ้งซ่อม (Repair Request System) — Design Specification v7.0 (Production-Scale Blueprint)

เอกสารนี้กำหนดสถาปัตยกรรมระดับองค์กร (Production-Scale Enterprise Architecture) ของ **ระบบแจ้งซ่อม** ซึ่งเป็นระบบย่อยเพิ่มเติมในกลุ่มงานทั่วไปสำหรับระบบ **eLeave & School OS** เพื่อรองรับการทำงานในระยะยาว (5-10 ปี) โดยไม่มีปัญหาฐานข้อมูลบวม ทำการแบ็คอัพง่าย ป้องกันปัญหาสิทธิ์เข้าถึงข้อมูลด้านงบประมาณการเงิน และโครงสร้างที่ลดความผูกมัดทางเทคโนโลยี (Decoupled Layer Architecture)

---

## 1. โครงสร้างสิทธิ์การเข้าใช้งานแบบขยาย (Expanded Centralized Permission Matrix)

เพื่อจำกัดการมองเห็นข้อมูลค่าใช้จ่ายและงบประมาณการซ่อมซึ่งมีความละเอียดอ่อน รวมทั้งการรองรับการนำออกและการลบอย่างปลอดภัย ระบบจะใช้สิทธิ์การใช้งานดังนี้ (จัดเก็บในไฟล์ `src/lib/permissions.ts`):

- `repair:create`: สิทธิ์ในการส่งใบแจ้งซ่อมใหม่ (สำหรับครูและแอดมิน)
- `repair:view.own`: สิทธิ์ดูรายการแจ้งซ่อมย้อนหลังที่ตนเองสร้าง (สำหรับครูและแอดมิน)
- `repair:view.all`: สิทธิ์ดูรายการแจ้งซ่อมทั้งหมดในระบบ (สำหรับช่างและแอดมิน)
- `repair:view.cost`: สิทธิ์ดูรายละเอียดค่าใช้จ่ายและงบประมาณวัสดุการเงิน (จำกัดสำหรับแอดมินเท่านั้น ครูและช่างทั่วไปไม่เห็นข้อมูลค่าใช้จ่ายนี้)
- `repair:assign`: สิทธิ์ในการมอบหมายงานให้ช่างผู้รับผิดชอบ (สำหรับแอดมิน)
- `repair:update`: สิทธิ์อัปเดตสถานะการทำงาน บันทึกวัสดุ และบันทึกรูปภาพงานหลังดำเนินการซ่อม (สำหรับช่างผู้รับผิดชอบและแอดมิน)
- `repair:export`: สิทธิ์ในการส่งออกรายงาน Excel/PDF สรุปผลงานซ่อมและค่าใช้จ่าย (สำหรับแอดมินเท่านั้น)
- `repair:delete`: สิทธิ์ในการทำ Soft Delete รายการแจ้งซ่อมที่มีปัญหา (สำหรับแอดมินเท่านั้น)
- `repair:archive`: สิทธิ์ล้างข้อมูลเก่าและทำระบบจดหมายเหตุย้ายข้อมูลประวัติศาสตร์ (สำหรับแอดมินเท่านั้น)

---

## 2. โครงสร้างสถาปัตยกรรมรูปภาพและการจัดเก็บ (Decoupled Storage Architecture)

ย้ายจากการเก็บรูปภาพแบบ Raw Binary (BYTEA) ใน PostgreSQL ไปใช้การเก็บแบบอ้างอิงตำแหน่งบน Object Storage (เช่น Neon Storage หรือ S3-compatible service) หรือ Local Disk Storage ในกรณีทดสอบ/รันบนเครื่องเซิร์ฟเวอร์โรงเรียนโดยตรง:

- **ขีดจำกัดรูปภาพ**: แนบรูปก่อนซ่อม (BEFORE) ได้สูงสุด **2 รูป** และหลังซ่อม (AFTER) ได้สูงสุด **2 รูป** (รวมสูงสุด 4 รูปต่อใบงาน)
- **การบีบอัดรูปภาพ (Image Policy)**: 
  - ขนาดความกว้างสูงสุด 800px บีบอัดด้วย JPEG (Quality = 0.7)
  - ขนาดเป้าหมายหลังบีบอัด **100 KB - 300 KB** (เพื่อให้รูปภาพมีความละเอียดและรายละเอียดความคมชัดเพียงพอที่จะดูร่องรอยการซ่อมจริงได้ แทนการบีบเค้นจนเบลอ)
  - เก็บรูปภาพต้นฉบับเฉพาะกรณีจำเป็น (ขึ้นอยู่กับคอนฟิกูเรชัน)
- **ฟิลด์ข้อมูลตารางรูปภาพ**:
  - `storageKey`: รหัสคีย์เฉพาะสำหรับการดึงไฟล์จาก Storage Bucket (เช่น `repairs/cuid-before-1.jpg`)
  - `url`: ลิงก์สาธารณะหรือ Endpoint สำหรับแสดงผลรูปภาพผ่านเบราว์เซอร์
  - `mimeType`: ประเภทคอนเทนต์ของไฟล์ภาพ เช่น `image/jpeg`
  - `fileSize`: ขนาดจริงของไฟล์รูปในระบบเพื่อความสะดวกในการวิเคราะห์ดิสก์และมอนิเตอร์

---

## 3. สถาปัตยกรรมการแยกเลเยอร์ (Decoupled Layer Architecture)

เพื่อลดความหนาแน่นและความหนาแน่นของ Server Actions และช่วยให้การแก้ไขทดสอบโค้ดทำได้ง่าย (Maintainability) โค้ดจะถูกแบ่งออกเป็น 3 ชั้นหลัก:

### A. Repositories Layer (`src/repositories/`)
- เป็นชั้นเดียวที่เรียกใช้งาน `prisma` โดยตรงเพื่อเข้าถึงและเขียนข้อมูลตารางฐานข้อมูลแจ้งซ่อม
- ตัวอย่างไฟล์: `repair.repository.ts`

### B. Services Layer (`src/services/`)
- ทำหน้าที่จัดการ Business Logic, การคำนวณข้อมูล, สิทธิ์, Validation, ระบบความปลอดภัย และการบันทึก Audit Logs
- ตัวอย่างไฟล์:
  - `repair.service.ts`: ควบคุมการทำงาน CRUD และสถานะงานซ่อม
  - `photo.service.ts`: ควบคุมการอัปโหลดไฟล์ภาพ การสร้าง storageKey และลบไฟล์บน Storage (Neon/S3/Disk)
  - `archive.service.ts`: ทำงาน ETL ย้ายข้อมูลเก่าเข้าตารางคลังประวัติศาสตร์
  - `audit.service.ts`: ควบคุมความสอดคล้องและการบันทึก Log กิจกรรมระบบแจ้งซ่อม

### C. Actions Layer (`src/app/actions/repair/`)
- เป็นตัวกลางรับคำขอจาก Client Components เช็คสิทธิ์เบื้องต้น และเรียกใช้บริการจากเลเยอร์ Services
- ตัวอย่างไฟล์: `create.ts`, `update.ts`, `assign.ts`, `archive.ts`

---

## 4. โครงสร้างฐานข้อมูลอัปเกรด (Database Schema v7.0)

โมเดลสำหรับโมดูลแจ้งซ่อมเพิ่มเติมใน [schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma):

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
  ELECTRICAL   // ไฟฟ้า
  PLUMBING     // ประปา
  BUILDING     // อาคารสถานที่
  IT           // คอมพิวเตอร์/สารสนเทศ
  EQUIPMENT    // ครุภัณฑ์การศึกษา
  OTHER        // อื่นๆ
}

// ตารางหลักสำหรับการแจ้งซ่อม (ใช้งานปกติประจำวัน)
model RepairRequest {
  id             String          @id @default(cuid())
  title          String
  description    String          @db.Text
  location       String
  urgency        RepairUrgency   @default(NORMAL)
  category       RepairCategory  @default(OTHER)  // [NEW] หมวดหมู่งานซ่อมเพื่อวิเคราะห์สถิติ
  status         RepairStatus    @default(PENDING)
  version        Int             @default(1)      // [NEW] Optimistic Concurrency Lock Version
  requesterId    String
  requester      User            @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
  assigneeId     String?
  assignee       User?           @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
  resolutionNote String?         @db.Text
  cost           Decimal?        @db.Decimal(10, 2) // ข้อมูลการเงินเที่ยงตรง ปลอดภัยจากปัญหาปัดเศษสะสม
  materialsUsed  String?         @db.Text
  cancelReason   String?         @db.Text
  expectedFinishAt DateTime?     // [NEW] แผนกำหนดเสร็จสำหรับ SLA Tracking
  actualFinishAt   DateTime?     // [NEW] วันที่ซ่อมจริงเสร็จสิ้นเพื่อวัดผล KPI
  assignedAt     DateTime?
  finishedAt     DateTime?
  deletedAt      DateTime?       // [NEW] Soft Delete Flag
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  photos         RepairPhoto[]

  @@index([status, createdAt(sort: Desc)])
  @@index([status, updatedAt])
  @@index([assigneeId, status])
  @@index([requesterId, status])
  @@index([updatedAt])
}

// ตารางเก็บข้อมูลอ้างอิงรูปภาพที่เก็บใน Object Storage
model RepairPhoto {
  id         String          @id @default(cuid())
  repairId   String          // Non-nullable: ป้องกันปัญหารูปภาพกำพร้า (Orphan Photo)
  photoType  RepairPhotoType
  mimeType   String          // e.g., "image/jpeg"
  fileSize   Int             // ขนาดไฟล์จริงในหน่วย Bytes
  storageKey String          // ตำแหน่ง Path/Key บน Neon Storage / S3 / Disk เช่น "repairs/cuid-xxx.jpg"
  url        String          // ลิงก์สำหรับเรียกดูรูปภาพสาธารณะหรือเซิร์ฟเวอร์
  createdAt  DateTime        @default(now())
  
  repair     RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
  @@index([repairId, photoType])
}

// ตารางจดหมายเหตุหลัก (กระจกส่องข้อมูลประวัติศาสตร์ ค้นหาย้อนหลังง่าย ไม่ต้องพึ่งพา JSON ในอนาคต)
model RepairRequestArchive {
  id             String          @id
  title          String
  description    String          @db.Text
  location       String
  urgency        RepairUrgency
  category       RepairCategory
  status         RepairStatus
  requesterId    String
  assigneeId     String?
  resolutionNote String?         @db.Text
  cost           Decimal?        @db.Decimal(10, 2)
  materialsUsed  String?         @db.Text
  cancelReason   String?         @db.Text
  expectedFinishAt DateTime?
  actualFinishAt   DateTime?
  assignedAt     DateTime?
  finishedAt     DateTime?
  createdAt      DateTime
  updatedAt      DateTime
  archivedAt     DateTime        @default(now()) // เวลาที่ถูกเก็บเข้าจดหมายเหตุ
  photos         RepairPhotoArchive[]
}

// ตารางจดหมายเหตุรูปภาพ (เก็บลิงก์รูปภาพประวัติศาสตร์ไว้โดยไม่ลบหากต้องการประวัติครบถ้วน)
model RepairPhotoArchive {
  id         String               @id
  repairId   String
  photoType  RepairPhotoType
  mimeType   String
  fileSize   Int
  storageKey String
  url        String
  createdAt  DateTime
  archivedAt DateTime             @default(now())
  
  repair     RepairRequestArchive @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
}

// โมเดลสำหรับเก็บ Log เดิมของระบบ โดยเพิ่มฟิลด์เก็บข้อมูล JSON (Optional)
model SystemLog {
  id          String   @id @default(cuid())
  actionType  String
  description String
  userId      String
  metadata    Json?    // เก็บข้อมูลดิบในรูปโครงสร้าง JSON เพื่อระบบแดชบอร์ดสรุปผลวิเคราะห์
  createdAt   DateTime @default(now())
}
```

---

## 5. การจัดการ Concurrency & Logic ชั้นสูง (Compare-And-Swap & Locks)

- **Optimistic Concurrency Control (OCC)**:
  เมื่อมีการเปลี่ยนสถานะของใบแจ้งซ่อม ระบบจะใช้ฟิลด์ `version` ในโมเดล `RepairRequest` เพื่อตรวจสอบและบันทึกข้อมูลอย่างปลอดภัย (Atomic CAS):
  ```typescript
  const result = await prisma.repairRequest.updateMany({
    where: {
      id: repairId,
      status: expectedPreviousStatus,
      version: currentVersion,
      deletedAt: null // ทำการแก้ไขเฉพาะรายการที่ยังไม่ได้ถูก Soft Delete
    },
    data: {
      status: nextStatus,
      version: { increment: 1 },
      ...
    }
  });

  if (result.count === 0) {
    throw new Error("สถานะงานซ่อมนี้มีการปรับปรุงโดยผู้ใช้อื่น หรือเวอร์ชันข้อมูลไม่ตรงกัน กรุณารีเฟรชหน้าร้าน");
  }
  ```
- **Audit Logs Type Safety**:
  จำกัดความผิดพลาดจากการพิมพ์ประเภท Log ผิดด้วยการรวบรวมรหัสประเภท Log ทั้งหมดเป็น Enum `SystemAction` ภายในชั้น `audit.service.ts`:
  - `REPAIR_CREATED`, `REPAIR_ASSIGNED`, `REPAIR_STARTED`, `REPAIR_COMPLETED`, `REPAIR_CANCELLED`, `REPAIR_DELETED`, `REPAIR_ARCHIVED`.

- **การย้ายประวัติโดยปลอดภัย (ETL Archiving)**:
  ในการกวาดล้างข้อมูล Completed/Cancelled ที่เกิน 180 วัน:
  1. การรันทั้งหมดรันภายใต้ `prisma.$transaction(..., { timeout: 30000 })` พร้อมการล็อคด้วย PostgreSQL advisory lock `SELECT pg_advisory_xact_lock(45729);`
  2. กวาดข้อมูลทีละ 200 รายการเรียงตาม `updatedAt: "asc"`
  3. บันทึกข้อมูลเข้าตาราง `RepairRequestArchive` และ `RepairPhotoArchive` เพื่อให้สามารถทำรายงานสถิติย้อนหลัง 5-10 ปีได้ด้วยการ Query SQL ปกติ
  4. ทำการลบ `RepairRequest` ต้นทาง ซึ่งจะมีผลให้ `RepairPhoto` ถูกลบตามแบบอัตโนมัติ (Cascade)
  5. ไฟล์ภาพบน Neon/S3 จะยังคงถูกเก็บไว้ (ไม่โดนลบ) เนื่องจากในตาราง `RepairPhotoArchive` ยังมีข้อมูล url และ storageKey อ้างอิงภาพจริงอยู่ แต่หากโรงเรียนต้องการเคลียร์ไฟล์ภาพเก่าเพื่อเคลียร์สเปซ สามารถรัน Script แยกต่างหากเพื่อสลัดลบไฟล์ใน Storage ตามข้อมูลในตาราง Archive ได้โดยอิสระ

---
*(เอกสารการออกแบบฉบับสมบูรณ์ v7.0 ได้รับการปรับปรุงเป็นพิมพ์เขียวระดับองค์กรเรียบร้อย)*
