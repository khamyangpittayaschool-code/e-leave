# ระบบแจ้งซ่อม (Repair Request System) Implementation Plan v5.2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งซ่อมสำหรับโรงเรียนแบบประสิทธิภาพสูง ตามพิมพ์เขียว Master Architecture Blueprint v5.2 โดยรองรับการบันทึกภาพแบบ Binary (BYTEA) จำกัดจำนวน BEFORE 2 รูป และ AFTER 2 รูป ย่อยรูปบน Canvas ฝั่งไคลเอนต์ ควบคุมสิทธิ์ด้วย Capability Permissions และมีระบบจดหมายเหตุย้ายความสัมพันธ์รูปภาพด้วยความปลอดภัยผ่าน Transaction

**Architecture:** 
- ตาราง `RepairRequest`, `RepairPhoto` (ไม่มีการเกาะ archiveId, non-nullable repairId เพื่อป้องรูปกำพร้า) และ `RepairArchive`
- API Stream รูปภาพและแคชถาวร 1 ปี พร้อมระบบดักสิทธิ์เข้าถึง และแคชบัสเตอร์ `?v={createdAt}`
- Server Action สำหรับย้ายข้อมูลเก่า (>180 วัน) ผ่าน Prisma Transaction สรุปข้อมูลลง JSON payload และลบภาพออกโดย CASCADE
- สิทธิ์การทำงานอิงตาม Permissions: `repair:view.own`, `repair:view.all`, `repair:create`, `repair:assign`, `repair:update`, `repair:archive`

**Tech Stack:** Next.js (App Router), Prisma, PostgreSQL (BYTEA), Framer Motion, Tailwind CSS, Lucide React

---

## Global Constraints
- **จำกัดรูปภาพ**: ก่อนซ่อม (BEFORE) สูงสุด 2 รูป และหลังซ่อม (AFTER) สูงสุด 2 รูป (รวม 4 รูปต่อใบงาน)
- **การบีบอัดรูปภาพ**: ด้านยาวสุดไม่เกิน 800px บีบอัดเป็น JPEG (Quality = 0.7) ขนาดหลังย่อ $\le 100\text{ KB}$ ต่อรูป โดยไม่มีการจำกัดขนาดไฟล์รูปต้นฉบับของผู้ใช้
- **ระบบการเงิน**: ใช้ประเภท `Decimal` (Prisma `@db.Decimal(10,2)`) สำหรับฟิลด์ค่าใช้จ่าย `cost` ของใบแจ้งซ่อม
- **สิทธิ์เข้าใช้ระบบ**: ควบคุมระดับ Capability-based Permissions ผ่านการตรวจสอบฟังก์ชัน `hasPermission` ในไฟล์ `src/lib/permissions.ts`
- **Audit Logs**: ทุกการเปลี่ยนแปลงใบแจ้งซ่อมต้องบันทึกลงตาราง `SystemLog` ในรหัสกิจกรรม: `REPAIR_CREATED`, `REPAIR_ASSIGNED`, `REPAIR_STARTED`, `REPAIR_COMPLETED`, `REPAIR_CANCELLED`, และ `REPAIR_ARCHIVED`

---

## Proposed Changes & Tasks

### Task 1: Database Schema & Migration

**Files:**
- Modify: [prisma/schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma)
- Create: Migration files via Prisma CLI

**Interfaces:**
- Produces: `RepairStatus`, `RepairUrgency`, `RepairPhotoType` enums, `RepairRequest`, `RepairPhoto`, and `RepairArchive` models.

- [ ] **Step 1: Edit `schema.prisma`**
  - เพิ่มฟิลด์ `enableRepair Boolean @default(false)` ในตาราง `SystemSettings`
  - อัปเดตความสัมพันธ์ในโมเดล `User`:
    ```prisma
    requestsCreated  RepairRequest[] @relation("RequestCreatedBy")
    requestsAssigned RepairRequest[] @relation("RequestAssignedTo")
    ```
  - เพิ่มโมเดลและโครงสร้างตารางแจ้งซ่อมตามสเปก v5.2:
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

    model RepairRequest {
      id             String          @id @default(cuid())
      title          String
      description    String          @db.Text
      location       String
      urgency        RepairUrgency   @default(NORMAL)
      status         RepairStatus    @default(PENDING)
      requesterId    String
      requester      User            @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
      assigneeId     String?
      assignee       User?           @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
      resolutionNote String?         @db.Text
      cost           Decimal?        @db.Decimal(10, 2)
      materialsUsed  String?         @db.Text
      cancelReason   String?         @db.Text
      assignedAt     DateTime?
      finishedAt     DateTime?
      createdAt      DateTime        @default(now())
      updatedAt      DateTime        @updatedAt
      photos         RepairPhoto[]

      @@index([status, createdAt(sort: Desc)])
      @@index([status, updatedAt])
      @@index([assigneeId, status])
      @@index([requesterId, status])
    }

    model RepairPhoto {
      id        String          @id @default(cuid())
      repairId  String
      photoType RepairPhotoType
      mimeType  String
      imageData Bytes
      createdAt DateTime        @default(now())
      
      repair    RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

      @@index([repairId])
    }

    model RepairArchive {
      id             String        @id @default(cuid())
      archivedAt     DateTime      @default(now())
      itemCount      Int
      completedCount Int
      cancelledCount Int
      totalCost      Decimal?      @db.Decimal(12, 2)
      payload        Json
    }
    ```

- [ ] **Step 2: Run dry-run migration check**
  - Run: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  - Verify: ตรวจทานคำสั่ง SQL ว่าไม่มีการ DROP ตารางที่สำคัญ

- [ ] **Step 3: Create the migration package**
  - Run: `npx prisma migrate dev --create-only --name add_repair_engine_v5`
  - Verify: ตรวจทานไฟล์ SQL ในโฟลเดอร์ `prisma/migrations/`

- [ ] **Step 4: Execute migration to database**
  - Run: `npx prisma migrate dev`
  - Verify: การรันผ่านสำเร็จและสร้าง Prisma Client สำเร็จ

- [ ] **Step 5: Commit changes**
  - Run: `git add prisma/schema.prisma prisma/migrations/`
  - Run: `git commit -m "db: add tables for Repair engine v5.2"`

---

### Task 2: Implement Permissions & Actions & Secure Photo API

**Files:**
- Create: [src/lib/permissions.ts](file:///C:/dev/eLeave/src/lib/permissions.ts)
- Create: [src/app/api/repair/photo/[photoId]/route.ts](file:///C:/dev/eLeave/src/app/api/repair/photo/%5BphotoId%5D/route.ts)
- Create: [src/app/actions/repair.ts](file:///C:/dev/eLeave/src/app/actions/repair.ts)

**Interfaces:**
- Consumes: Prisma models
- Produces: `hasPermission` helper, photo stream GET endpoint, and Server Actions for RepairRequest

- [ ] **Step 1: Write `src/lib/permissions.ts`**
  - เขียนออบเจกต์และฟังก์ชันตรวจสอบสิทธิ์ `hasPermission` ตามพิมพ์เขียว v5.2

- [ ] **Step 2: Create Photo Streaming API Route**
  - เขียนโค้ดใน `src/app/api/repair/photo/[photoId]/route.ts` เพื่อส่งภาพกลับเป็น Binary Response
  - บังคับใช้การตรวจสอบสิทธิ์แบบ Ownership และตั้งค่า Cache-Control 1 ปีเต็มตามพิมพ์เขียว

- [ ] **Step 3: Write Server Actions in `src/app/actions/repair.ts`**
  - ฟังก์ชัน `createRepairRequest` เพื่อบันทึกงานใหม่ (จำกัดรูป BEFORE $\le 2$, และเซฟรูปในตาราง `RepairPhoto` แปลงจาก Base64 เป็น Buffer บันทึกรูปในฟิลด์ `imageData` แบบ Binary)
  - ฟังก์ชัน `getRepairRequests` ดึงข้อมูลรายการแจ้งซ่อม (ห้ามดึงตารางความสัมพันธ์รูปภาพ `photos` เพื่อประสิทธิภาพ)
  - ฟังก์ชัน `getRepairRequestDetails` ดึงข้อมูลเดี่ยวแสดงผล
  - ฟังก์ชัน `assignRepairRequest` สำหรับมอบหมายช่าง
  - ฟังก์ชัน `updateRepairStatus` อัปเดตงานสำหรับช่าง (รวมบันทึกรายละเอียดซ่อม, แนบรูปภาพ AFTER $\le 2$, บันทึกค่าซ่อมเป็น `Decimal`)
  - แทรกคำสั่งสร้าง Audit Logs ในตาราง `SystemLog` เสมอในแต่ละขั้นตอน

- [ ] **Step 4: Commit changes**
  - Run: `git add src/lib/permissions.ts src/app/api/repair/photo/ src/app/actions/repair.ts`
  - Run: `git commit -m "feat: add permissions helper, secure photo streaming API, and repair actions"`

---

### Task 3: Implement ETL Transactional Archiver Job

**Files:**
- Create: [src/app/actions/archive.ts](file:///C:/dev/eLeave/src/app/actions/archive.ts)

- [ ] **Step 1: Implement `archiveRepairsJob`**
  - ใช้สิทธิ์ตรวจสอบ `repair:archive`
  - อ่านใบแจ้งซ่อมที่ซ่อมเสร็จ/ยกเลิก และอายุ > 180 วัน ครั้งละ 200 รายการ
  - เขียนการจัดส่งข้อมูลใน `prisma.$transaction` เพื่อสร้าง `RepairArchive` (เก็บเฉพาะ Metadata/Payload ไม่มีรูปภาพ)
  - ทำลายใบแจ้งซ่อมหลักใน `RepairRequest` (ซึ่งจะ Cascade Delete รูปภาพที่เกี่ยวข้องออกไปโดยอัตโนมัติ) และบันทึก Log ลง `SystemLog`

- [ ] **Step 2: Commit changes**
  - Run: `git add src/app/actions/archive.ts`
  - Run: `git commit -m "feat: implement transaction-safe ETL Archiver job with cascade photo deletion"`

---

### Task 4: UI Integration (Sidebar, Settings, Forms, & Dashboard)

**Files:**
- Modify: [src/app/(app)/layout.tsx](file:///C:/dev/eLeave/src/app/(app)/layout.tsx)
- Modify: [src/app/(app)/settings/page.tsx](file:///C:/dev/eLeave/src/app/(app)/settings/page.tsx)
- Create: `src/app/(app)/repair/page.tsx`
- Create: `src/app/(app)/repair/new/page.tsx`

- [ ] **Step 1: Update Sidebar layout menu**
  - ตรวจเช็คสิทธิ์ `repair:view` เพื่อเรนเดอร์เมนู "ระบบแจ้งซ่อม" (ใช้ไอคอน `Wrench`) ภายใต้เมนู "งานทั่วไป"

- [ ] **Step 2: Update Settings Page**
  - สวิตช์เปิด/ปิด `enableRepair` และแผงสั่งงานคลังจดหมายเหตุปุ่มกด "Archive Now" สำหรับผู้ดูแลระบบ

- [ ] **Step 3: Implement Request Form Page (`new/page.tsx`)**
  - ฟอร์มระบุข้อมูลพร้อม Canvas Auto Resizing (JPEG, Quality 0.7, ดันคุณภาพลงมาหากขนาดหลังย่อเกิน 100 KB)
  - จำกัดการเพิ่มรูปภาพ BEFORE ไม่เกิน 2 รูป

- [ ] **Step 4: Implement Dashboard & List View Page (`repair/page.tsx`)**
  - การ์ดสถิติ `.stat-card` และตารางรายการซ่อมแยกตามสิทธิ์
  - หน้ารายละเอียดงานซ่อมพร้อม Thumbnail 120x120 และ Lightbox Modal ขยายภาพเมื่อคลิก
  - ช่องอัปเดตสถานะของช่างพร้อมใส่ภาพ AFTER ไม่เกิน 2 รูป และค่าใช้จ่าย

- [ ] **Step 5: Verify build stability**
  - Run: `npm run build`
  - Verify: Build สำเร็จโดยไม่มีข้อผิดพลาด

- [ ] **Step 6: Commit changes**
  - Run: `git add src/app/(app)/layout.tsx src/app/(app)/settings/page.tsx src/app/(app)/repair/`
  - Run: `git commit -m "feat: integrate repair frontend UI components and pages"`

---

## Verification Plan

### Automated Verification
- ตรวจทานความถูกต้องด้วย `npm run build` เพื่อตรวจสอบ Type ล่าสุดของ Decimal และ BYTEA ในหน้าเพจต่างๆ

### Manual Verification
1. **การแจ้งซ่อมใหม่และระบบบีบอัดภาพอัตโนมัติ**:
   - ลองแนบไฟล์ภาพขนาดใหญ่ (5 MB) ภาพจะถูก Canvas ย่อให้เหลือกว้าง 800px เป็นไฟล์ JPEG ขนาด < 100 KB ทันที
   - ตรวจสอบว่าไม่สามารถส่งรูปภาพ BEFORE เกิน 2 รูป และ AFTER เกิน 2 รูป
2. **การดึงภาพปลอดภัย (Stream API)**:
   - ทดสอบเข้าดู URL `/api/repair/photo/[id]` ของผู้ใช้อื่นที่ไม่ใช่เจ้าของงานและไม่มีสิทธิ์ `repair:view.all` ต้องถูกส่งกลับเป็น 403
   - ตรวจดู Cache-Control headers ของภาพถ่ายในเครือข่ายเบราว์เซอร์
3. **ETL Archive**:
   - กดปุ่ม "Archive Now" และตรวจสอบในฐานข้อมูลว่าเรคคอร์ดในตาราง `RepairPhoto` ถูกลบออกถาวร และลบเรคคอร์ด `RepairRequest` ทิ้งสำเร็จอย่างถูกต้อง
   - ตรวจดูบันทึก SystemLog
