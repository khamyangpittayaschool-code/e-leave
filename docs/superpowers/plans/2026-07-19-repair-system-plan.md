# ระบบแจ้งซ่อม (Repair Request System) Implementation Plan v7.0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งซ่อมสำหรับโรงเรียนแบบประสิทธิภาพสูง ตามพิมพ์เขียว Master Architecture Blueprint v7.0 โดยเปลี่ยนการบันทึกภาพจาก BYTEA เป็นการอ้างอิงตำแหน่งบน Storage (Neon/S3/Disk), เพิ่มชั้นเลเยอร์การทำงาน (Repositories/Services), จัดการ Concurrency แบบ Optimistic OCC (version field), กำหนดหมวดหมู่แจ้งซ่อม, SLA Tracking, Soft Delete และบันทึกประวัติแบบตารางจดหมายเหตุคู่ขนาน (Mirror Archive Tables)

**Architecture:** 
- ตาราง `RepairRequest`, `RepairPhoto` (เก็บ url และ storageKey ชี้หา Storage), `RepairRequestArchive`, `RepairPhotoArchive` และ `SystemLog`
- API Stream/Serve รูปภาพพร้อมแคชถาวร 7 วัน, แคชบัสเตอร์ `?v={createdAt}` และ ETag + 304 Not Modified
- Services Layer (`src/services/` และ `src/repositories/`) แยกหน้าที่และ Logic ออกจาก Server Actions ชัดเจน
- Server Action สำหรับย้ายข้อมูลเก่า (>180 วัน) ผ่าน Prisma Transaction ย้ายข้อมูลเข้าตารางประวัติศาสตร์คู่ขนาน และลบข้อมูลตารางทำงานออก ( Cascade Delete รูปใน DB แต่คงไฟล์และข้อมูล URL ใน Archive)
- สิทธิ์การทำงานอิงตาม Permissions: `repair:view.own`, `repair:view.all`, `repair:view.cost`, `repair:create`, `repair:assign`, `repair:update`, `repair:export`, `repair:delete`, `repair:archive`
- ระบบตรวจสอบและอัปเดตข้อมูลแบบป้องกัน Lost Update โดยใช้คำสั่ง Atomic Compare-And-Swap บน status และ version

**Tech Stack:** Next.js (App Router), Prisma, PostgreSQL (BYTEA/Storage URLs), Framer Motion, Tailwind CSS, Lucide React

---

## Global Constraints
- **จำกัดรูปภาพ**: ก่อนซ่อม (BEFORE) สูงสุด 2 รูป และหลังซ่อม (AFTER) สูงสุด 2 รูป (รวม 4 รูปต่อใบงาน) โดยเช็คนับใน Transaction เสมอก่อนบันทึก
- **การบีบอัดรูปภาพ**: ด้านยาวสุดไม่เกิน 800px บีบอัดเป็น JPEG (Quality = 0.7) ขนาดหลังย่อ **100 KB - 300 KB** ต่อรูป โดยไม่มีการจำกัดขนาดไฟล์รูปต้นฉบับของผู้ใช้
- **ระบบการเงิน**: ใช้ประเภท `Decimal` (Prisma `@db.Decimal(10,2)`) สำหรับฟิลด์ค่าใช้จ่าย `cost` ของใบแจ้งซ่อม โดยต้องแปลงเป็นตัวเลข (`toNumber()`) เสมอก่อนส่งข้อมูลไปยัง Client Components และจำกัดการมองเห็นด้วยสิทธิ์ `repair:view.cost`
- **สิทธิ์เข้าใช้ระบบ**: ควบคุมระดับ Capability-based Permissions ผ่านการตรวจสอบฟังก์ชัน `hasPermission` ในไฟล์ `src/lib/permissions.ts`
- **Audit Logs**: ทุกการเปลี่ยนแปลงใบแจ้งซ่อมต้องบันทึกลงตาราง `SystemLog` ในรหัสกิจกรรม: `REPAIR_CREATED`, `REPAIR_ASSIGNED`, `REPAIR_STARTED`, `REPAIR_COMPLETED`, `REPAIR_CANCELLED`, `REPAIR_DELETED`, และ `REPAIR_ARCHIVED` พร้อมเขียนข้อความอ้างอิง ID ในรูปแบบโครงสร้าง `[REPAIR_ID:${id}][ACTOR_ID:${userId}][ACTION:${action}] ...` และบันทึก JSON Metadata ลงฟิลด์ `metadata` ของ `SystemLog`

---

## Proposed Changes & Tasks

### Task 1: Database Schema & Migration

**Files:**
- Modify: [prisma/schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma)
- Create: Migration files via Prisma CLI

- [ ] **Step 1: Edit `schema.prisma`**
  - เพิ่มฟิลด์ `enableRepair Boolean @default(false)` ในตาราง `SystemSettings`
  - เพิ่มฟิลด์ `metadata Json?` ในโมเดล `SystemLog`
  - อัปเดตความสัมพันธ์ในโมเดล `User`:
    ```prisma
    requestsCreated  RepairRequest[] @relation("RequestCreatedBy")
    requestsAssigned RepairRequest[] @relation("RequestAssignedTo")
    ```
  - เพิ่มโมเดลและโครงสร้างตารางแจ้งซ่อมตามสเปก v7.0:
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

    model RepairRequest {
      id             String          @id @default(cuid())
      title          String
      description    String          @db.Text
      location       String
      urgency        RepairUrgency   @default(NORMAL)
      category       RepairCategory  @default(OTHER)
      status         RepairStatus    @default(PENDING)
      version        Int             @default(1)
      requesterId    String
      requester      User            @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
      assigneeId     String?
      assignee       User?           @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
      resolutionNote String?         @db.Text
      cost           Decimal?        @db.Decimal(10, 2)
      materialsUsed  String?         @db.Text
      cancelReason   String?         @db.Text
      expectedFinishAt DateTime?
      actualFinishAt   DateTime?
      assignedAt     DateTime?
      finishedAt     DateTime?
      deletedAt      DateTime?
      createdAt      DateTime        @default(now())
      updatedAt      DateTime        @updatedAt
      photos         RepairPhoto[]

      @@index([status, createdAt(sort: Desc)])
      @@index([status, updatedAt])
      @@index([assigneeId, status])
      @@index([requesterId, status])
      @@index([updatedAt])
    }

    model RepairPhoto {
      id         String          @id @default(cuid())
      repairId   String
      photoType  RepairPhotoType
      mimeType   String
      fileSize   Int
      storageKey String
      url        String
      createdAt  DateTime        @default(now())
      
      repair     RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

      @@index([repairId])
      @@index([repairId, photoType])
    }

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
      archivedAt     DateTime        @default(now())
      photos         RepairPhotoArchive[]
    }

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
    ```

- [ ] **Step 2: Run dry-run migration check**
  - Run: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  - Verify: ตรวจทานคำสั่ง SQL ว่าไม่มีการ DROP ตารางที่สำคัญ

- [ ] **Step 3: Create the migration package and edit the migration script**
  - Run: `npx prisma migrate dev --create-only --name add_repair_engine_v7`
  - แก้ไขไฟล์ `.sql` ในโฟลเดอร์ `prisma/migrations/...` ที่เพิ่งเกิดขึ้น:
    1. เพิ่ม CHECK Constraint สำหรับขนาดรูปภาพ:
       ```sql
       ALTER TABLE "RepairPhoto" ADD CONSTRAINT repair_photo_filesize_chk CHECK ("fileSize" > 0);
       ```
    2. เพิ่ม CHECK Constraint สำหรับค่าใช้จ่ายซ่อม:
       ```sql
       ALTER TABLE "RepairRequest" ADD CONSTRAINT repair_cost_chk CHECK ("cost" IS NULL OR "cost" >= 0);
       ```
    3. เพิ่ม Partial Index สำหรับ Archiver Candidates:
       ```sql
       CREATE INDEX idx_repair_archive_candidates ON "RepairRequest" ("updatedAt") WHERE status IN ('COMPLETED', 'CANCELLED');
       ```
    4. เพิ่ม GIN Index สำหรับค้นหา Audit Log Metadata:
       ```sql
       CREATE INDEX idx_systemlog_metadata ON "SystemLog" USING GIN ("metadata");
       ```
  - Verify: ไฟล์ `.sql` มีคำสั่ง Custom SQL ครบถ้วน (4 รายการ)

- [ ] **Step 4: Execute migration to database**
  - Run: `npx prisma migrate dev`
  - Verify: การรันผ่านสำเร็จและสร้าง Prisma Client สำเร็จ

- [ ] **Step 5: Commit changes**
  - Run: `git add prisma/schema.prisma prisma/migrations/`
  - Run: `git commit -m "db: add enums, models, checks, and indexes for Repair engine v7.0"`

---

### Task 2: Implement Repositories & Services Layer

**Files:**
- Create: [src/repositories/repair.repository.ts](file:///C:/dev/eLeave/src/repositories/repair.repository.ts)
- Create: [src/services/photo.service.ts](file:///C:/dev/eLeave/src/services/photo.service.ts)
- Create: [src/services/audit.service.ts](file:///C:/dev/eLeave/src/services/audit.service.ts)
- Create: [src/services/repair.service.ts](file:///C:/dev/eLeave/src/services/repair.service.ts)
- Create: [src/lib/permissions.ts](file:///C:/dev/eLeave/src/lib/permissions.ts)

- [ ] **Step 1: Write `src/lib/permissions.ts`**
  - เขียนออบเจกต์และฟังก์ชันตรวจสอบสิทธิ์ `hasPermission` ครอบคลุมสิทธิ์ระบบแจ้งซ่อม v7.0 ทั้งหมด รวมถึงสิทธิ์งบประมาณ (`repair:view.cost`) และการ Export/Delete

- [ ] **Step 2: Create `src/repositories/repair.repository.ts`**
  - เขียนฟังก์ชันค้นหา อัปเดต และสร้างรายการผ่าน `prisma.repairRequest`
  - กรองค่า `deletedAt: null` เสมอในการค้นหาทั่วไป
  - จัดการ Optimistic Concurrency Control (OCC) โดยการตรวจสอบ version และเพิ่มค่า version atomically เมื่อเขียนข้อมูล

- [ ] **Step 3: Create `src/services/photo.service.ts`**
  - เขียนฟังก์ชัน `uploadPhoto` และ `deletePhoto` รองรับการเซฟไฟล์ลงในพื้นที่เก็บข้อมูลคลาวด์/ดิสก์ (โดยปกติให้เก็บลงโฟลเดอร์ `public/uploads/repairs/` และส่งกลับ URL เข้าถึงไฟล์ และสร้างคีย์ `storageKey` อ้างอิงไฟล์)
  - ประมวลผลบีบอัดรูปภาพปลายทางขนาด 100 KB - 300 KB

- [ ] **Step 4: Create `src/services/audit.service.ts`**
  - จัดการ Log Audit ในโมเดล `SystemLog` โดยบันทึก Action Type และ JSON metadata โครงสร้างในฟิลด์ `metadata` เปลือกนอกด้วย Enum `SystemAction`

- [ ] **Step 5: Create `src/services/repair.service.ts`**
  - ดึงบริการจาก repository และ service อื่นๆ มาจัดสรร Business Flow (การตรวจสอบสิทธิ์ระดับความสามารถ, การกวดขันจำนวนรูปภาพ transactional count $\le 2$, การตรวจสัญญาสถานะ CAS, การบันทึก SLA Tracking)

---

### Task 3: Implement Actions & Photo Streaming Endpoint

**Files:**
- Create: `src/app/actions/repair/`
  - [create.ts](file:///C:/dev/eLeave/src/app/actions/repair/create.ts)
  - [update.ts](file:///C:/dev/eLeave/src/app/actions/repair/update.ts)
  - [assign.ts](file:///C:/dev/eLeave/src/app/actions/repair/assign.ts)
  - [delete.ts](file:///C:/dev/eLeave/src/app/actions/repair/delete.ts)
- Create: [src/app/api/repair/photo/[photoId]/route.ts](file:///C:/dev/eLeave/src/app/api/repair/photo/%5BphotoId%5D/route.ts)

- [ ] **Step 1: Write Server Actions in `src/app/actions/repair/`**
  - เขียน Endpoint การทำงาน CRUD สำหรับหน้า Component ไคลเอนต์ โดยเรียกใช้เมธอดจากชั้น `RepairService` เท่านั้น (ห้ามเรียกใช้ `prisma` ตรง)
  - ทำการตรวจสอบสิทธิ์ความสามารถและสัญญากลับ
  - ทำการตรวจสอบและซ่อนค่า `cost` ในออบเจกต์ขากลับกรณีผู้ใช้ไม่มีสิทธิ์ `repair:view.cost`

- [ ] **Step 2: Create Photo Streaming API Route with ETag Support**
  - เขียนโค้ดใน `src/app/api/repair/photo/[photoId]/route.ts` เพื่อส่งภาพกลับเป็น Binary Response
  - นำเข้า ETag logic: คำนวณ ETag จากไอดีและ timestamp และเปรียบเทียบกับ `If-None-Match` หากตรงกันให้ส่งกลับ `304 Not Modified`
  - ดำเนินการเช็คสิทธิ์แบบละเอียดและสิทธิ์การมองเห็น

- [ ] **Step 3: Commit changes**
  - Run: `git add src/repositories/ src/services/ src/app/actions/repair/ src/app/api/repair/`
  - Run: `git commit -m "feat: implement repository, services, server actions, and etag photo streaming for Repair module v7.0"`

---

### Task 4: Implement ETL Transactional Archiver Job

**Files:**
- Create: [src/services/archive.service.ts](file:///C:/dev/eLeave/src/services/archive.service.ts)
- Create: [src/app/actions/repair/archive.ts](file:///C:/dev/eLeave/src/app/actions/repair/archive.ts)

- [ ] **Step 1: Implement `archiveRepairsJob` in `archive.service.ts`**
  - ตรวจสอบสิทธิ์ `repair:archive`
  - กวาดใบแจ้งซ่อม Completed/Cancelled อายุ > 180 วัน โดยเรียงลำดับ `updatedAt: "asc"` ครั้งละ 200 รายการ จำกัดจำนวนลูปสูงสุด `MAX_BATCHES = 100`
  - ทำธุรกรรมผ่าน `prisma.$transaction(..., { timeout: 30000 })` พร้อมการทำ pg_advisory_xact_lock(45729)
  - โอนย้ายข้อมูลเข้าตาราง `RepairRequestArchive` และ `RepairPhotoArchive` โดยสมบูรณ์ (รักษาประวัติรูปและ URL ไว้)
  - ลบรายการทำงานหลัก `RepairRequest` (Cascade Delete รูปในตารางทำงาน `RepairPhoto` ออกโดยอัตโนมัติ) และบันทึก Log ลง `SystemLog`

- [ ] **Step 2: Create Action Archive Interface**
  - เขียน Action ใน `src/app/actions/repair/archive.ts` เพื่อให้หน้าแอดมินคลิกกด "Archive Now" ได้
  - บันทึกความถูกต้องและ Commit การทำงาน

---

### Task 5: UI Integration (Sidebar, Settings, Forms, & Dashboard)

**Files:**
- Modify: [src/app/(app)/layout.tsx](file:///C:/dev/eLeave/src/app/(app)/layout.tsx)
- Modify: [src/app/(app)/settings/page.tsx](file:///C:/dev/eLeave/src/app/(app)/settings/page.tsx)
- Create: `src/app/(app)/repair/page.tsx`
- Create: `src/app/(app)/repair/new/page.tsx`

- [ ] **Step 1: Update Sidebar layout menu**
  - ตรวจเช็คสิทธิ์ `repair:view.own` หรือ `repair:view.all` เพื่อเรนเดอร์เมนู "ระบบแจ้งซ่อม" (ใช้ไอคอน `Wrench`) ภายใต้เมนู "งานทั่วไป"

- [ ] **Step 2: Update Settings Page**
  - สวิตช์เปิด/ปิด `enableRepair` และแผงสั่งงานคลังจดหมายเหตุปุ่มกด "Archive Now" สำหรับผู้ดูแลระบบ

- [ ] **Step 3: Implement Request Form Page (`new/page.tsx`)**
  - ฟอร์มระบุข้อมูลพร้อม Canvas Auto Resizing (JPEG, Quality 0.7, ดันคุณภาพลงมาหากขนาดหลังย่อเกิน 100-300 KB)
  - จำกัดการเพิ่มรูปภาพ BEFORE ไม่เกิน 2 รูป
  - เมนูดรอปดาวน์เลือกหมวดหมู่ (`RepairCategory`)

- [ ] **Step 4: Implement Dashboard & List View Page (`repair/page.tsx`)**
  - การ์ดสถิติ `.stat-card` และตารางรายการซ่อมแยกตามสิทธิ์
  - ซ่อนหรือแสดงผลฟิลด์ค่าใช้จ่าย `cost` ตามความสอดคล้องของสิทธิ์ `repair:view.cost`
  - หน้ารายละเอียดงานซ่อมพร้อม Thumbnail 120x120 และ Lightbox Modal ขยายภาพเมื่อคลิก
  - ช่องอัปเดตสถานะของช่างพร้อมใส่ภาพ AFTER ไม่เกิน 2 รูป, บันทึกวัสดุ และบันทึกค่าใช้จ่าย

- [ ] **Step 5: Verify build stability**
  - Run: `npm run build`
  - Verify: Build สำเร็จโดยไม่มีข้อผิดพลาด

- [ ] **Step 6: Commit changes**
  - Run: `git add src/app/(app)/layout.tsx src/app/(app)/settings/page.tsx src/app/(app)/repair/`
  - Run: `git commit -m "feat: integrate repair frontend UI components and pages"`

---

## Verification Plan

### Automated Verification
- ตรวจทานความถูกต้องด้วย `npm run build` เพื่อตรวจสอบความสอดคล้องของ TypeScript และ Prisma

### Manual Verification
1. **การแจ้งซ่อมใหม่และระบบบีบอัดภาพอัตโนมัติ**:
   - ลองแนบไฟล์ภาพขนาดใหญ่ (5 MB) ภาพจะถูก Canvas ย่อให้เหลือกว้าง 800px เป็นไฟล์ JPEG ขนาด < 300 KB ทันที และบันทึกตำแหน่งไฟล์สำเร็จ
2. **การป้องกัน Concurrency ด้วย OCC**:
   - เปิดหน้ารายละเอียดงานซ่อมชิ้นเดียวกัน 2 แท็บบัญชี ลองกดยืนยันการอัปเดตพร้อมกัน บัญชีที่ยืนยันช้ากว่าจะต้องปฏิเสธด้วยข้อความข้อขัดแย้งของเวอร์ชันข้อมูล
3. **การดึงภาพปลอดภัย (Stream API)**:
   - ทดสอบเข้าดู URL `/api/repair/photo/[id]` ต้องจำกัดสิทธิ์เจ้าของและช่างทั่วไป และทำงานด้วยการประมวลผล Cache-Control และ ETag คืนค่า 304 เมื่อร้องขอซ้ำ
4. **ETL Archive**:
   - กดปุ่ม "Archive Now" ตรวจสอบข้อมูลในตาราง `RepairRequestArchive` และ `RepairPhotoArchive` ว่าโอนย้ายสำเร็จ และตารางหลักถูกล้างสะอาดเรียบร้อย
   - ตรวจดูบันทึก SystemLog
5. **Soft Delete**:
   - ทดสอบสั่งลบงานในหน้าจัดการแอดมิน รายการแจ้งซ่อมจะต้องเพิ่มค่า `deletedAt` และหายไปจากหน้าแสดงผลปกติ แต่ข้อมูลดิบและรูปภาพจะยังไม่ถูกลบออกจากฐานข้อมูล
