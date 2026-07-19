# ระบบแจ้งซ่อม (Repair Request System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งซ่อมสำหรับครูและบุคลากรเพื่อแจ้งปัญหาอาคารสถานที่/อุปกรณ์ โดยมีระบบบีบอัดรูปภาพฝั่งไคลเอนต์ (Canvas) เก็บภาพแบบ Binary (BYTEA) และระบบจัดเก็บบันทึกประวัติเก่า (Archive) ครอบคลุมความปลอดภัยผ่าน Transaction การจำกัดขนาด รูปแบบข้อมูลการเงิน และการตรวจสอบสิทธิ์แบบ Permissions

**Architecture:** 
- เพิ่ม Enums `RepairStatus`, `RepairUrgency`, `RepairPhotoType` และตาราง `RepairRequest`, `RepairPhoto`, `RepairArchive` ใน Prisma
- ใช้ `Bytes` (BYTEA) สำหรับรูปภาพ, กำหนดประเภท `Decimal` สำหรับ `cost` และฟิลด์ `archivedAt` สำหรับระบุสัญกรณ์ Soft Delete
- จัดทำระบบจำกัดจำนวนภาพสูงสุด BEFORE 2 ภาพ, AFTER 2 ภาพ รวมสูงสุด 4 ภาพ/คำขอ พร้อมระบบ Auto Client-side compression
- เพิ่มระบบ Log บันทึกกิจกรรม และ Archiver ด้วย `prisma.$transaction` เพื่อโอนประวัติย้อนหลัง > 180 วัน/กดย้ายทันที

**Tech Stack:** Next.js, Prisma, PostgreSQL (BYTEA), Framer Motion, Tailwind CSS v4, Lucide React

---

## Global Constraints
- ขนาดรูปภาพบีบอัดไม่เกิน 100 KB ต่อภาพ, กว้าง/สูงไม่เกิน 800px และเป็น JPEG (คุณภาพเริ่มต้น 0.7)
- **ห้ามจำกัดขนาดไฟล์รูปต้นฉบับ**: ระบบต้องอนุญาตให้อัปโหลดไฟล์รูปภาพทุกขนาด (3-15 MB) จากมือถือ โดยทำการย่อและบีบอัดรูปภาพด้วย HTML5 Canvas บน Client อัตโนมัติ (และลด Quality ลงมาที่ 0.5 เผื่อกรณีที่ขนาดไฟล์ยังเกิน 100 KB หลังย่อ)
- จำกัดรูปภาพก่อนซ่อม (BEFORE) สูงสุด 2 รูป และรูปภาพหลังซ่อม (AFTER) สูงสุด 2 รูป รวมสูงสุด 4 รูปต่อใบแจ้งซ่อม
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
    - ตรวจทานตัวกรองจำนวนรูปภาพ: `BEFORE` สูงสุด 2 รูป และ `AFTER` สูงสุด 2 รูป
    - โค้ดตรวจสอบ:
      ```typescript
      const beforePhotos = photos.filter(p => p.photoType === "BEFORE");
      if (beforePhotos.length > 2) {
        throw new Error("สามารถแนบรูปก่อนซ่อมได้สูงสุด 2 รูป");
      }
      ```
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
    - เมื่อเปลี่ยนเป็น `COMPLETED` บันทึกค่าใช้จ่ายในรูป `Decimal` รายละเอียด วัสดุ และอัปโหลดภาพหลังซ่อม (ตรวจทานรูปหลังซ่อม `AFTER` ไม่เกิน 2 รูป) และสร้าง SystemLog `REPAIR_COMPLETED`
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
  - พัฒนาสคริปต์ย่อภาพผ่าน Canvas ขนาดความกว้างไม่เกิน 800px คุณภาพ 0.7 รหัส JPEG โดยไม่มีการบล็อกขนาดไฟล์รูปต้นฉบับ หากย่อยแล้วยังเกิน 100 KB ให้ลดคุณภาพลงเหลือ 0.5 อัตโนมัติ (จำกัดการส่งภาพก่อนซ่อม `BEFORE` ไม่เกิน 2 รูป)

- [ ] **Step 2: Implement Main Repair List & Detail Views (`page.tsx`)**
  - แสดงตัวเลขสถิติผ่านการ์ด `.stat-card` ตามสถานะต่างๆ
  - ตารางสรุปรายการแสดงตามสิทธิ์และเงื่อนไข (แอดมินดูทั้งหมด, ช่างดูงานที่มอบหมาย, ครูดูเฉพาะของตนเอง)
  - รูปแบบแสดงภาพย่อ: ใช้ Thumbnail 120 x 120 pixels ในการ์ดข้อมูลเบื้องต้นเพื่อประหยัดหน่วยความจำ RAM และเปิดดูภาพเต็มผ่านกล่อง Lightbox Zoom ในหน้ารายละเอียดเมื่อคลิกเท่านั้น
  - เพิ่มปุ่มอัปเดตและระบุค่าใช้จ่าย (Decimal) พร้อมระบุอุปกรณ์/แนบรูปประกอบหลังซ่อม (ช่าง/แอดมิน - แนบรูปหลังซ่อม `AFTER` ไม่เกิน 2 รูป)

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
   - ตรวจสอบว่าสามารถอัปโหลดภาพต้นฉบับขนาดใดก็ได้ (เช่น 5-10 MB) และระบบ Canvas ทำการบีบอัดลงมาเหลือต่ำกว่า 100 KB สำเร็จโดยผู้ใช้ไม่ต้องทำเอง
   - ทดสอบว่าเมื่อแนบภาพ BEFORE เกิน 2 รูป ระบบแสดงแจ้งเตือนบล็อก
2. **การกู้คืนประวัติและรูปภาพแบบ BYTEA**:
   - ลองแจ้งซ่อม 1 รายการพร้อมภาพก่อนซ่อม 2 รูป และช่างส่งงานพร้อมภาพหลังซ่อม 2 รูป
   - เข้าดูหน้ารายการแจ้งซ่อมทั้งหมด ตรวจทานผ่าน Network Tab ว่าไม่มีการส่ง Byte รูปภาพก้อนใหญ่มา
   - กดดูรายละเอียดของรายการซ่อม ตรวจสอบการแปลงจาก BYTEA เป็น Base64 และตรวจสอบว่าแสดงผลภาพ Thumbnail 120x120 เมื่องานแสดง และเปิดขยายรูปเต็มขนาดได้
3. **ระบบการบันทึก Log และ Transaction Archive**:
   - ตรวจเช็คว่าเมื่อแจ้งซ่อม มอบหมายงาน อัปเดตงาน มีข้อมูลเข้าตาราง `SystemLog` ครบถ้วน
   - ดำเนินการกดปุ่ม "Archive Now" ในหน้าตั้งค่า ตรวจสอบการทำ Transaction อัปเดต `archivedAt` และย้ายข้อมูลลงตาราง `RepairArchive` สำเร็จโดยลบข้อมูลจากตารางหลักทั้งหมด
