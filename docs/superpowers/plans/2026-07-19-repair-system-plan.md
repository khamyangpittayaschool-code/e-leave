# ระบบแจ้งซ่อม (Repair Request System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งซ่อมสำหรับครูและบุคลากรเพื่อแจ้งปัญหาอาคารสถานที่/อุปกรณ์ โดยมีระบบบีบอัดรูปภาพฝั่งไคลเอนต์ (Canvas) เก็บภาพแบบ Binary (BYTEA) และระบบจัดเก็บบันทึกประวัติเก่า (Archive) ครอบคลุมความปลอดภัยผ่าน Transaction การจำกัดขนาด รูปแบบข้อมูลการเงิน และการตรวจสอบสิทธิ์แบบ Permissions

**Architecture:** 
- เพิ่ม Enums `RepairStatus`, `RepairUrgency`, `RepairPhotoType` และตาราง `RepairRequest`, `RepairPhoto`, `RepairArchive` ใน Prisma
- ใช้ `Bytes` (BYTEA) สำหรับรูปภาพ, กำหนดประเภท `Decimal` สำหรับ `cost` และฟิลด์ `archivedAt` สำหรับระบุสัญกรณ์ Soft Delete
- จัดทำระบบจำกัดจำนวนภาพสูงสุด 5 ภาพ/คำขอ ขนาดรวมไม่เกิน 500 KB พร้อมรันบน Canvas ย่อรูปฝั่ง Client
- เพิ่มระบบ Log บันทึกกิจกรรม และ Archiver ด้วย `prisma.$transaction` เพื่อโอนประวัติย้อนหลัง > 180 วัน/กดย้ายทันที

**Tech Stack:** Next.js, Prisma, PostgreSQL (BYTEA), Framer Motion, Tailwind CSS v4, Lucide React

---

## Global Constraints
- ขนาดรูปภาพบีบอัดไม่เกิน 100 KB ต่อภาพ, กว้าง/สูงไม่เกิน 800px และเป็น JPEG (คุณภาพ 0.7)
- จำกัดจำนวนรูปภาพสูงสุด 5 รูป (`MAX_PHOTOS = 5`) และขนาดรวมรูปทั้งหมดไม่เกิน 500 KB (`MAX_TOTAL_SIZE = 500KB`) ต่อหนึ่งใบแจ้งซ่อม
- สิทธิ์การเข้าใช้งานหน้าจอและการทำงานอิงผ่านระบบสิทธิ์ (Permissions Checking) ประกอบด้วย `repair:view`, `repair:create`, `repair:assign`, `repair:update`, `repair:archive` โดยห้ามผูกสิทธิ์ตรงกับตำแหน่งหรือบทบาท
- ใช้ `Decimal` (Prisma `@db.Decimal(10,2)`) สำหรับฟิลด์ค่าใช้จ่าย (`cost`)
- ทุกๆ กิจกรรมของงานซ่อมต้องมีการบันทึก Audit Log ลงตาราง `SystemLog` เสมอ (`REPAIR_CREATED`, `REPAIR_ASSIGNED`, `REPAIR_STARTED`, `REPAIR_COMPLETED`, `REPAIR_CANCELLED`, `REPAIR_ARCHIVED`)

---

## Proposed Changes & Tasks

### Task 1: Database Schema & Migration

**Files:**
- Modify: [prisma/schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma)
- Create: Migrations via Prisma CLI

**Interfaces:**
- Produces: `RepairStatus`, `RepairUrgency`, `RepairPhotoType` enums; `RepairRequest`, `RepairPhoto`, and `RepairArchive` models in database client

- [ ] **Step 1: Edit `schema.prisma`**
  - เพิ่มฟิลด์ `enableRepair Boolean @default(false)` ในตาราง `SystemSettings`
  - เพิ่ม Relations ในตาราง `User`:
    ```prisma
    createdRepairs  RepairRequest[] @relation("RequestCreatedBy")
    assignedRepairs RepairRequest[] @relation("RequestAssignedTo")
    ```
  - เพิ่มโมเดลและโครงสร้างตารางแจ้งซ่อม:
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
      archivedAt     DateTime?
      createdAt      DateTime        @default(now())
      updatedAt      DateTime        @updatedAt
      photos         RepairPhoto[]

      @@index([requesterId])
      @@index([assigneeId])
      @@index([status])
    }

    model RepairPhoto {
      id             String          @id @default(cuid())
      repairId       String
      photoType      RepairPhotoType
      mimeType       String
      imageData      Bytes
      createdAt      DateTime        @default(now())
      repair         RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

      @@index([repairId])
    }

    model RepairArchive {
      id             String          @id @default(cuid())
      archivedAt     DateTime        @default(now())
      itemCount      Int
      payload        Json
    }
    ```

- [ ] **Step 2: Run dry-run check of database migration**
  - Run: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  - Verify: ตรวจสอบโค้ด SQL ที่แสดงผลว่าไม่มีการเขียนคำสั่งเพื่อล้างตารางเดิม

- [ ] **Step 3: Create the migration file**
  - Run: `npx prisma migrate dev --create-only --name add_repair_system`
  - Verify: ตรวจสอบความถูกต้องไฟล์ SQL ใน `prisma/migrations/`

- [ ] **Step 4: Execute database migration**
  - Run: `npx prisma migrate dev`
  - Verify: การรัน Migration สำเร็จและ Client ได้รับการสร้างใหม่

- [ ] **Step 5: Commit changes**
  - Run: `git add prisma/schema.prisma prisma/migrations/`
  - Run: `git commit -m "db: add enums and models for Repair Request System"`

---

### Task 2: Server Actions for Repair System

**Files:**
- Create: [src/app/actions/repair.ts](file:///C:/dev/eLeave/src/app/actions/repair.ts)

**Interfaces:**
- Produces: 
  - `createRepairRequest(data: { title, description, location, urgency: RepairUrgency, photos: { photoType: RepairPhotoType, mimeType: string, base64: string }[] })`
  - `getRepairRequests(filters: { status?, search?, assigneeId?, requesterId? })`
  - `getRepairRequestDetails(id: string)`
  - `assignRepairRequest(id: string, assigneeId: string)`
  - `updateRepairStatus(id: string, status: RepairStatus, data: { resolutionNote?, cost?, materialsUsed?, photos?: { photoType: RepairPhotoType, mimeType: string, base64: string }[], cancelReason? })`

- [ ] **Step 1: Create `src/app/actions/repair.ts` and write validations + CRUD logic**
  - ตรวจสอบความถูกต้องของสิทธิ์ด้วยระบบ Permissions
  - ใน `createRepairRequest`:
    - ตรวจเช็คขีดจำกัดสูงสุด: `photos.length <= 5` และขนาดสายอักขระรวมเมื่อแปลงกลับเป็นไบนารีต้องไม่เกิน 500 KB
    - แปลงข้อมูลภาพ Base64 เป็น Buffer บันทึกลงตาราง `RepairPhoto`
    - เขียนบันทึกกิจกรรม `REPAIR_CREATED` ลงในตาราง `SystemLog`
  - ใน `getRepairRequests`:
    - ดึงรายการแจ้งซ่อมทั้งหมดโดยการทำคิวรีที่ไม่รวมความสัมพันธ์ `photos` เพื่อรักษาความเร็ว
  - ใน `getRepairRequestDetails`:
    - โหลดรายการคำขอพร้อมรูปภาพ โดยแปลงฟิลด์ `imageData` จาก Buffer คืนเป็น Base64 Data URL เพื่อส่งกลับไปแสดงผล
  - ใน `assignRepairRequest`:
    - แอดมินมอบหมายงานให้ช่าง บันทึกเวลา `assignedAt` และเพิ่ม SystemLog `REPAIR_ASSIGNED`
  - ใน `updateRepairStatus`:
    - เมื่อผู้ใช้อัปเดตสถานะ เช่น จาก `ASSIGNED` ไป `IN_PROGRESS` (เริ่มงาน) ให้สร้าง SystemLog `REPAIR_STARTED`
    - เมื่อเปลี่ยนเป็น `COMPLETED` บันทึกค่าใช้จ่ายในรูป `Decimal` รายละเอียด วัสดุ และอัปโหลดภาพหลังซ่อม และสร้าง SystemLog `REPAIR_COMPLETED`
    - เมื่อเปลี่ยนเป็น `CANCELLED` บันทึกเหตุผลการยกเลิก และสร้าง SystemLog `REPAIR_CANCELLED`

- [ ] **Step 2: Verify typing & compilations**
  - Verify: ไฟล์ compile ผ่าน ไม่มี TypeScript errors

- [ ] **Step 3: Commit changes**
  - Run: `git add src/app/actions/repair.ts`
  - Run: `git commit -m "feat: implement Repair System server actions with enums and audit logs"`

---

### Task 3: UI Integration: Layout, Settings & Archiving Transaction

**Files:**
- Modify: [src/app/(app)/layout.tsx](file:///C:/dev/eLeave/src/app/(app)/layout.tsx)
- Modify: [src/app/actions/settings.ts](file:///C:/dev/eLeave/src/app/actions/settings.ts)
- Modify: [src/app/(app)/settings/page.tsx](file:///C:/dev/eLeave/src/app/(app)/settings/page.tsx)
- Modify: [src/app/actions/repair.ts](file:///C:/dev/eLeave/src/app/actions/repair.ts) (เพิ่ม Archiver)

- [ ] **Step 1: Configure access control based on permissions**
  - เพิ่มสิทธิ์แจ้งซ่อมในระบบสิทธิ์พื้นฐาน `DEFAULT_PERMISSIONS` (เช่น `repair: ["ADMIN", "DIRECTOR", "HR", "INSPECTOR", "DEPT_HEAD", "TEACHER"]`) เพื่อควบคุมการโหลด sidebar
  - แก้ไข `layout.tsx` ให้อ่านตัวชี้วัดสิทธิ์และเรนเดอร์เมนู "ระบบแจ้งซ่อม" (ใช้ไอคอน `Wrench`) ภายใต้กลุ่มเมนู "งานทั่วไป" เฉพาะเมื่อสิทธิ์อนุญาต

- [ ] **Step 2: Implement transactional archiving action**
  - เขียนฟังก์ชัน `archiveRepairs` ใน `src/app/actions/repair.ts` โดยให้ทำงานดังนี้:
    1. ทำงานภายใน Prisma transaction: `await prisma.$transaction(async (tx) => { ... })`
    2. ค้นหาใบแจ้งซ่อมที่สถานะเป็น `COMPLETED` หรือ `CANCELLED` และมีอายุมากกว่า 180 วัน (หรือตามช่วงเวลาที่กดแมนนวล)
    3. ทำการ Soft Delete โดยอัปเดตฟิลด์ `archivedAt = new Date()` บนรายการที่ค้นพบ
    4. โหลดประวัติรายการแจ้งซ่อมพร้อมรูปภาพที่เกี่ยวข้องทั้งหมด (แปลงภาพเป็น Base64 เพื่อรวมในก้อนข้อมูลประวัติ)
    5. เขียนบันทึกก้อน JSON ขนาดใหญ่ลงในตาราง `RepairArchive`
    6. ดำเนินการลบเรคคอร์ดจากตารางหลัก `RepairRequest` และ `RepairPhoto`
    7. บันทึก SystemLog ระบุการทำรายการจดหมายเหตุ `REPAIR_ARCHIVED`
  - เพิ่มตัวเลือกเปิด/ปิดระบบแจ้งซ่อมและแผงควบคุมจดหมายเหตุในหน้าตั้งค่าเพื่อให้ผู้ดูแลระบบสั่งการ Archive แบบ Manual ได้

- [ ] **Step 3: Commit changes**
  - Run: `git add src/app/(app)/layout.tsx src/app/actions/settings.ts src/app/(app)/settings/page.tsx src/app/actions/repair.ts`
  - Run: `git commit -m "feat: implement layout permissions, settings, and transactional archive policy"`

---

### Task 4: Repair Request Pages & Form

**Files:**
- Create: `src/app/(app)/repair/page.tsx`
- Create: `src/app/(app)/repair/new/page.tsx`

- [ ] **Step 1: Implement Request Form Page (`new/page.tsx`)**
  - ออกแบบฟอร์มการแจ้งซ่อม: หัวเรื่อง, สถานที่, รายละเอียด และตัวเลือกระดับความเร่งด่วนตาม Enum `RepairUrgency`
  - พัฒนาสคริปต์ย่อภาพผ่าน Canvas ขนาดความกว้างไม่เกิน 800px คุณภาพ 0.7 รหัส JPEG โดยต้องมีระบบ Client Validation ห้ามเกิน 5 รูป และขนาดรวมไม่เกิน 500 KB

- [ ] **Step 2: Implement Main Repair List & Detail Views (`page.tsx`)**
  - แสดงตัวเลขสถิติผ่านการ์ด `.stat-card` ตามสถานะต่างๆ
  - ตารางสรุปรายการแสดงตามสิทธิ์และเงื่อนไข (แอดมินดูทั้งหมด, ช่างดูงานที่มอบหมาย, ครูดูเฉพาะของตนเอง)
  - รูปแบบแสดงภาพย่อ: ใช้ Thumbnail 120 x 120 pixels ในการ์ดข้อมูลเบื้องต้นเพื่อประหยัดหน่วยความจำ RAM และเปิดดูภาพเต็มผ่านกล่อง Lightbox Zoom ในหน้ารายละเอียดเมื่อคลิกเท่านั้น
  - เพิ่มปุ่มอัปเดตและระบุค่าใช้จ่าย (Decimal) พร้อมระบุอุปกรณ์/แนบรูปประกอบหลังซ่อม (ช่าง/แอดมิน)

- [ ] **Step 3: Verify build and compile stability**
  - Run: `npm run build`
  - Verify: ไม่มี TypeScript/Lint compilation errors เกิดขึ้น

- [ ] **Step 4: Commit changes**
  - Run: `git add src/app/(app)/repair/`
  - Run: `git commit -m "feat: implement frontend views for repair request forms and management board"`

---

## Verification Plan

### Automated Verification
- ตรวจทานด้วยคำสั่ง `npm run build` เพื่อให้แน่ใจว่าไม่มีข้อผิดพลาดการอ้างอิงสิทธิ์และการรวบรวมไฟล์

### Manual Verification
1. **การแจ้งซ่อมใหม่ (Client Limits)**:
   - จำลองการแนบรูปภาพมากกว่า 5 รูป หรืออัปโหลดไฟล์ขนาดใหญ่เกิน 500 KB ระบบต้องแสดงเตือนและไม่สามารถส่งบันทึกได้
   - ตรวจเช็คว่ารูปภาพก่อนซ่อมถูกแปลงเป็น JPEG ขนาดความกว้างไม่เกิน 800px คุณภาพ 0.7 ทันที
2. **การกู้คืนประวัติและรูปภาพแบบ BYTEA**:
   - ลองแจ้งซ่อม 1 รายการพร้อมภาพ 2 รูป
   - เข้าดูหน้ารายการแจ้งซ่อมทั้งหมด ตรวจทานผ่าน Network Tab ว่าไม่มีการส่ง Byte รูปภาพก้อนใหญ่มา (ภาพไม่ถูกโหลดล่วงหน้า)
   - กดดูรายละเอียดของรายการซ่อม ตรวจสอบการแปลงจาก BYTEA เป็น Base64 และตรวจสอบว่าแสดงผลภาพ Thumbnail 120x120 เมื่อดูรายละเอียดประวัติ และสามารถขยายดูรูปขนาดเต็มได้
3. **ระบบการบันทึก Log และ Transaction Archive**:
   - ตรวจเช็คว่าเมื่อแจ้งซ่อม มอบหมายงาน อัปเดตงาน มีข้อมูลเข้าตาราง `SystemLog` ครบถ้วน
   - ดำเนินการกดปุ่ม "Archive Now" ในหน้าตั้งค่า ตรวจสอบการทำ Transaction อัปเดต `archivedAt` (Soft Delete) และย้ายข้อมูลลงตาราง `RepairArchive` สำเร็จโดยลบข้อมูลจากตารางหลักทั้งหมดแบบ atomic
