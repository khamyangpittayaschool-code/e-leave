# ระบบแจ้งซ่อม (Repair Request System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งซ่อมสำหรับครูและบุคลากรเพื่อแจ้งปัญหาอาคารสถานที่/อุปกรณ์ โดยมีระบบบีบอัดรูปภาพฝั่งไคลเอนต์ เก็บภาพแบบ Binary (BYTEA) และระบบจัดเก็บบันทึกประวัติเก่า (Archive) เพื่อประหยัดพื้นที่ฐานข้อมูล

**Architecture:** 
- เพิ่มโมเดล `RepairRequest`, `RepairPhoto`, และ `RepairArchive` ใน Prisma Schema
- ใช้ `Bytes` (BYTEA) ใน PostgreSQL สำหรับเก็บภาพ ย่อรูปด้วย Canvas บน Client ให้ขนาด < 100 KB
- ดำเนินการย้ายข้อมูลที่เสร็จสิ้น/ยกเลิกที่มีอายุมากกว่า 180 วันอัตโนมัติเข้าระบบจดหมายเหตุ (Archive) และลบตารางหลัก

**Tech Stack:** Next.js, Prisma, PostgreSQL (BYTEA), Framer Motion, Tailwind CSS v4, Lucide React

---

## Global Constraints
- ขนาดรูปภาพต้องบีบอัดให้ไม่เกิน 100 KB ต่อภาพก่อนอัปโหลด โดยจำกัดกว้าง/สูงไม่เกิน 800px และบันทึกเป็น JPEG (คุณภาพ 0.7)
- โครงสร้างและดีไซน์ UI ต้องสอดคล้องกับ eLeave: ใช้ฟอนต์ Noto Sans Thai, สัดส่วน zoom 0.9, การ์ดสถานะ `.stat-card` และแสดงผลแบบ Light / Dark Mode เสมอ
- ไม่ดึงรูปภาพขนาดจริงในการทำคิวรีรายการแจ้งซ่อมทั้งหมด (List view) เพื่อหลีกเลี่ยงภาระโหลดและหน่วยความจำเบราว์เซอร์
- การแสดงตัวอย่างรูปภาพในส่วนใดๆ นอกเหนือจากการเปิดภาพเต็มตัว ต้องใช้ขนาด Thumbnail 120 x 120 pixels

---

## Proposed Changes & Tasks

### Task 1: Database Schema & Migration

**Files:**
- Modify: [prisma/schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma)
- Create: Migrations via Prisma CLI

**Interfaces:**
- Produces: `RepairStatus` enum, `RepairRequest`, `RepairPhoto`, and `RepairArchive` models in database client

- [ ] **Step 1: Edit `schema.prisma`**
  - เพิ่มฟิลด์ `enableRepair Boolean @default(false)` ในตาราง `SystemSettings`
  - เพิ่ม Relations ในตาราง `User`:
    ```prisma
    createdRepairs  RepairRequest[] @relation("RequestCreatedBy")
    assignedRepairs RepairRequest[] @relation("RequestAssignedTo")
    ```
  - เพิ่มโมเดล `RepairStatus` และตารางใหม่ตามที่ระบุในเอกสารออกแบบ:
    ```prisma
    enum RepairStatus {
      PENDING
      ASSIGNED
      IN_PROGRESS
      COMPLETED
      CANCELLED
    }

    model RepairRequest {
      id             String         @id @default(cuid())
      title          String
      description    String         @db.Text
      location       String
      urgency        String         @default("NORMAL") // NORMAL, URGENT, URGENT_MOST
      status         RepairStatus   @default(PENDING)
      requesterId    String
      requester      User           @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
      assigneeId     String?
      assignee       User?          @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
      resolutionNote String?        @db.Text
      cost           Float?         @default(0.0)
      materialsUsed  String?        @db.Text
      cancelReason   String?        @db.Text
      assignedAt     DateTime?
      finishedAt     DateTime?
      createdAt      DateTime       @default(now())
      updatedAt      DateTime       @updatedAt
      photos         RepairPhoto[]

      @@index([requesterId])
      @@index([assigneeId])
      @@index([status])
    }

    model RepairPhoto {
      id             String         @id @default(cuid())
      repairId       String
      photoType      String         // BEFORE, AFTER
      mimeType       String         // image/jpeg
      imageData      Bytes          // maps to BYTEA
      createdAt      DateTime       @default(now())
      repair         RepairRequest  @relation(fields: [repairId], references: [id], onDelete: Cascade)

      @@index([repairId])
    }

    model RepairArchive {
      id             String         @id @default(cuid())
      archivedAt     DateTime       @default(now())
      itemCount      Int
      payload        Json
    }
    ```

- [ ] **Step 2: Run dry-run check of database migration**
  - Run: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  - Verify: ตรวจสอบโค้ด SQL ที่แสดงผลว่าปลอดภัยและไม่มีการ DROP ข้อมูลในตารางสำคัญอื่น

- [ ] **Step 3: Create the migration file**
  - Run: `npx prisma migrate dev --create-only --name add_repair_system`
  - Verify: มีโฟลเดอร์ Migration ใหม่เกิดขึ้นและเขียน SQL ครบตามที่แก้ไขใน Schema

- [ ] **Step 4: Execute database migration**
  - Run: `npx prisma migrate dev`
  - Verify: การรัน Migration สำเร็จและสร้าง Client สำเร็จ

- [ ] **Step 5: Commit changes**
  - Run: `git add prisma/schema.prisma prisma/migrations/`
  - Run: `git commit -m "db: add RepairRequest, RepairPhoto, and RepairArchive models"`

---

### Task 2: Server Actions for Repair System

**Files:**
- Create: [src/app/actions/repair.ts](file:///C:/dev/eLeave/src/app/actions/repair.ts)

**Interfaces:**
- Produces: 
  - `createRepairRequest(data: { title, description, location, urgency, photoBase64?, photoMimeType? })`
  - `getRepairRequests(filters: { status?, search?, assigneeId?, requesterId? })`
  - `getRepairRequestDetails(id: string)`
  - `assignRepairRequest(id: string, assigneeId: string)`
  - `updateRepairStatus(id: string, status: RepairStatus, data: { resolutionNote?, cost?, materialsUsed?, photoBase64?, photoMimeType?, cancelReason? })`

- [ ] **Step 1: Create `src/app/actions/repair.ts` and write getSessionUser + CRUD logic**
  - นำเข้า `prisma` และตรวจสอบความถูกต้องของสิทธิ์ผู้ใช้งาน
  - เขียนฟังก์ชัน `createRepairRequest` เพื่อบันทึกคำขอ โดยหากมีรูปภาพ ให้แปลงจาก Base64 เป็น Buffer แล้วเซฟใน `RepairPhoto`
  - เขียนฟังก์ชัน `getRepairRequests` ดึงรายการโดยไม่โหลดฟิลด์ `photos` เพื่อประสิทธิภาพ
  - เขียนฟังก์ชัน `getRepairRequestDetails` ดึงข้อมูลรายการเดี่ยวพร้อมแปลง `imageData` ใน `RepairPhoto` จาก Buffer กลับเป็น Base64 Data URL
  - เขียนฟังก์ชัน `assignRepairRequest` สำหรับการมอบหมายงานให้ช่างเฉพาะ (ใช้สิทธิ์แอดมิน)
  - เขียนฟังก์ชัน `updateRepairStatus` ให้ช่าง/แอดมินอัปเดตสถานะ เช่น กำลังดำเนินการ หรือปิดงาน (บันทึกข้อมูลรายละเอียดซ่อม, ค่าใช้จ่าย, และภาพหลังซ่อม)

- [ ] **Step 2: Verify code structure and typing**
  - Verify: ไฟล์ compile ผ่านและไม่มี TypeScript compile error

- [ ] **Step 3: Commit changes**
  - Run: `git add src/app/actions/repair.ts`
  - Run: `git commit -m "feat: implement Repair System server actions"`

---

### Task 3: UI Integration: Layout, Settings & Archiving

**Files:**
- Modify: [src/app/(app)/layout.tsx](file:///C:/dev/eLeave/src/app/(app)/layout.tsx)
- Modify: [src/app/actions/settings.ts](file:///C:/dev/eLeave/src/app/actions/settings.ts)
- Modify: [src/app/(app)/settings/page.tsx](file:///C:/dev/eLeave/src/app/(app)/settings/page.tsx)

- [ ] **Step 1: Update layout sidebar**
  - โหลดการตั้งค่า `enableRepair` และเพิ่มเมนูนำทาง "ระบบแจ้งซ่อม" (ใช้ไอคอน `Wrench` จาก `lucide-react`) ถัดจากระบบเอกสารในกลุ่ม "งานทั่วไป"
  - ตรวจเช็คสถานะการเข้าถึงตามสิทธิ์ (Admin และผู้ได้รับมอบหมายเข้าถึงหน้าจัดการได้หมด ส่วนผู้ใช้ทั่วไปเข้าหน้ารวมและดูประวัติของตนเองได้)

- [ ] **Step 2: Update System Settings actions and Settings Page**
  - เพิ่มสวิตช์เปิด/ปิด `enableRepair` ในหน้าตั้งค่า
  - เพิ่มฟังก์ชัน Server Action `archiveRepairs` ใน `src/app/actions/repair.ts` เพื่อดึงรายการแจ้งซ่อมที่ `COMPLETED` หรือ `CANCELLED` อายุ > 180 วัน (หรือทำงานแบบกดปุ่มทันที) แปลงเป็น JSON เก็บเข้า `RepairArchive` และลบออกจากตารางหลัก
  - สร้างแถบจัดการการแจ้งซ่อมใน Settings เพื่อให้ Admin สามารถตรวจเช็คจำนวนรายการและกดปุ่ม "Archive Now" ได้ด้วยตนเอง

- [ ] **Step 3: Commit changes**
  - Run: `git add src/app/(app)/layout.tsx src/app/actions/settings.ts src/app/(app)/settings/page.tsx`
  - Run: `git commit -m "feat: integrate repair system layout, settings, and archiving panel"`

---

### Task 4: Repair Request Pages & Form

**Files:**
- Create: `src/app/(app)/repair/page.tsx`
- Create: `src/app/(app)/repair/new/page.tsx`

- [ ] **Step 1: Implement Request Creation Page (`new/page.tsx`)**
  - สร้างแบบฟอร์ม: ระบุรายละเอียด, สถานที่, ความเร่งด่วน
  - เขียนสคริปต์ย่อขนาดรูปภาพผ่าน HTML5 Canvas (กว้าง/สูงไม่เกิน 800px, JPEG คุณภาพ 0.7, ขนาดไม่เกิน 100 KB) ก่อนส่งเซฟไปที่ Server Action

- [ ] **Step 2: Implement Main Repair Dashboard & List Page (`page.tsx`)**
  - แสดงตัวเลขสรุปแดชบอร์ดการซ่อม (PENDING, IN_PROGRESS, COMPLETED) ในรูปแบบ `.stat-card`
  - ตารางแสดงรายการพร้อมระบบการกรองค้นหา
  - ฟังก์ชันจัดการสำหรับ Admin (ปุ่มเลือกผู้รับผิดชอบงาน)
  - ฟังก์ชันอัปเดตงานสำหรับช่าง (บันทึกข้อมูลการดำเนินงาน, วัสดุอุปกรณ์, ภาพเสร็จสิ้น, ค่าซ่อม)
  - การเรนเดอร์รูปภาพ: ใช้โหมด Thumbnail 120x120 pixels บนหน้ารายละเอียดเบื้องต้น และเมื่อคลิกจึงขยายเป็นภาพเต็มจอ (LightBox / Modal Zoom)

- [ ] **Step 3: Verify the entire flow and build**
  - Run: `npm run build`
  - Verify: ระบบ Compile Next.js ได้อย่างปลอดภัย ไม่มีข้อผิดพลาดในการสร้างไฟล์แบบ Static/Dynamic

- [ ] **Step 4: Commit changes**
  - Run: `git add src/app/(app)/repair/`
  - Run: `git commit -m "feat: complete UI for repair list and request forms"`

---

## Verification Plan

### Automated Verification
- Run `npm run build` เพื่อตรวจสอบว่าไม่มี TypeScript หรือ Lint errors เกิดขึ้นในโค้ดใหม่

### Manual Verification
1. **เข้าสู่ระบบเป็นครู (User)**:
   - นำทางไปยังเมนูแจ้งซ่อมใหม่ใต้ "งานทั่วไป"
   - กดแจ้งซ่อมใหม่ พร้อมอัปโหลดภาพประกอบ ลองใช้ภาพถ่ายขนาดใหญ่ (เช่น 2-5 MB) และระบบต้องย่อภาพเหลือขนาด < 100 KB ก่อนบันทึก
   - ตรวจทานให้แน่ใจว่าประวัติแจ้งซ่อมแสดงอยู่เฉพาะของครูท่านนี้
2. **เข้าสู่ระบบเป็นผู้ดูแลระบบ (Admin)**:
   - ตรวจดูรายการแจ้งซ่อมทั้งหมด
   - เลือกมอบหมายงานให้กับช่าง (ตัวเราเองหรือผู้ใช้อื่น)
   - ล็อกอินเป็นช่าง และกดเปลี่ยนสถานะเป็น "กำลังดำเนินการ"
   - หลังซ่อมเสร็จ ให้ปิดงานโดยระบุผลการซ่อม บันทึกวัสดุที่ใช้ ค่าใช้จ่าย และอัปโหลดภาพเสร็จสิ้น (After Photo)
   - เข้าไปหน้าแสดงรายละเอียดและกดคลิกเปิดดูภาพ Before/After ขนาดเต็มหน้าจอเพื่อตรวจสอบฟังก์ชัน Lighbox และ Thumbnail 120x120
3. **การเก็บถาวร (Archiving)**:
   - ในหน้าตั้งค่าแอดมิน ทดสอบกดปุ่ม "Archive Now"
   - ตรวจสอบว่าประวัติการแจ้งซ่อมที่สมบูรณ์แล้วถูกลบออกไปและถูกเก็บเป็น JSON ในระบบ `RepairArchive` สำเร็จ
