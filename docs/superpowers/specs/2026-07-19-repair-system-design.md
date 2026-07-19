# ระบบแจ้งซ่อม (Repair Request System) — Design Specification

เอกสารนี้กำหนดการออกแบบและโครงสร้างของ **ระบบแจ้งซ่อม** ซึ่งเป็นระบบย่อยเพิ่มเติมในกลุ่มงานทั่วไป (ต่อจากระบบเอกสาร) สำหรับระบบ **eLeave & School OS** โดยมุ่งเน้นความเป็นระเบียบ ความปลอดภัย และความคุ้มค่าของพื้นที่เก็บข้อมูล (Zero Dependency + Database-backed BYTEA Storage + Archiving)

---

## 1. สรุปความต้องการ (Requirement Summary)

1. **สิทธิ์และการเข้าถึง (Roles & Workflow)**:
   - **ครู/บุคลากรทั่วไป (User)**: แจ้งซ่อมได้, ดูประวัติการแจ้งซ่อมของตนเองได้
   - **แอดมิน (Admin)**: ดูใบแจ้งซ่อมทั้งหมด, มอบหมายงานให้ช่าง/ผู้รับผิดชอบ, แก้ไขข้อมูล, และทำระบบจัดเก็บเอกสารเก่าเข้าระบบจดหมายเหตุ (Archive)
   - **ผู้รับผิดชอบงาน/ช่าง (Assigned Technician)**: เมื่อได้รับมอบหมายงาน จะสามารถดูรายละเอียด และอัปเดตสถานะงาน (เช่น กำลังดำเนินการ, ซ่อมเสร็จสิ้น) บันทึกรายละเอียดการซ่อม อัปโหลดภาพหลังซ่อม และระบุค่าใช้จ่ายได้
2. **รูปภาพประวัติการซ่อม (Before & After Photos)**:
   - อัปโหลดรูปภาพ "ก่อนซ่อม" (โดยผู้แจ้ง) และ "หลังซ่อม" (โดยช่างผู้ดำเนินการ)
   - **การบีบอัดภาพ**: ย่อและบีบอัดรูปภาพบนฝั่งไคลเอนต์ (Client-side resizing via HTML5 Canvas) ให้มีความกว้าง/สูงไม่เกิน 800px และบันทึกเป็น JPEG ก่อนส่งไปยัง Server เพื่อรักษาขนาดไฟล์ให้อยู่ระหว่าง 30-80 KB
   - **การเก็บข้อมูล (Storage)**: บันทึกรูปภาพในรูปแบบ Binary (`Bytes` / `BYTEA` ใน PostgreSQL) แทน Base64 เพื่อป้องกัน Overhead (+33%) และความหนาแน่นในการประมวลผล
3. **ระบบจดหมายเหตุและการประหยัดพื้นที่ (Archive System)**:
   - แอดมินสามารถดึงประวัติการแจ้งซ่อมที่สถานะเป็น "เสร็จสิ้น" หรือ "ยกเลิก" ตามช่วงเวลาที่ต้องการ (รายเดือน, รายภาคเรียน, รายปีการศึกษา) เพื่อทำข้อมูลเป็นก้อน JSON และบันทึกในตาราง `RepairArchive`
   - ลบรายการและรูปภาพที่เกี่ยวข้องในตารางหลักทิ้งเพื่อเคลียร์พื้นที่เก็บข้อมูลของระบบฐานข้อมูลหลัก

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

เพิ่มโมเดลใน [schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma):

```prisma
// ตารางหลักสำหรับการแจ้งซ่อม
model RepairRequest {
  id             String        @id @default(cuid())
  title          String        // เรื่อง/รายการแจ้งซ่อม (เช่น เครื่องปรับอากาศไม่เย็น)
  description    String        @db.Text // รายละเอียดปัญหา
  location       String        // สถานที่ (อาคาร/ห้อง)
  urgency        String        @default("NORMAL") // NORMAL (ปกติ), URGENT (ด่วน), URGENT_MOST (ด่วนที่สุด)
  status         String        @default("PENDING") // PENDING (รอดำเนินการ), ASSIGNED (มอบหมายแล้ว), IN_PROGRESS (กำลังดำเนินการ), COMPLETED (เสร็จสิ้น), CANCELLED (ยกเลิก)
  
  // ผู้แจ้งซ่อม
  requesterId    String
  requester      User          @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
  
  // ผู้รับผิดชอบ (ช่าง/เจ้าหน้าที่)
  assigneeId     String?
  assignee       User?         @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
  
  // ข้อมูลการดำเนินการซ่อม
  resolutionNote String?       @db.Text // รายละเอียดการแก้ไข
  cost           Float?        @default(0.0) // ค่าใช้จ่าย (ถ้ามี)
  materialsUsed  String?       @db.Text // วัสดุ/อุปกรณ์ที่ใช้
  
  cancelReason   String?       @db.Text // เหตุผลที่ยกเลิกการแจ้งซ่อม
  
  // วันเวลาที่เกี่ยวข้อง
  assignedAt     DateTime?
  finishedAt     DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  // ความสัมพันธ์กับรูปภาพ
  photos         RepairPhoto[]

  @@index([requesterId])
  @@index([assigneeId])
  @@index([status])
}

// ตารางเก็บภาพในรูปแบบ Binary (BYTEA)
model RepairPhoto {
  id             String        @id @default(cuid())
  repairId       String
  photoType      String        // BEFORE (ก่อนซ่อม), AFTER (หลังซ่อม)
  mimeType       String        // เช่น image/jpeg
  imageData      Bytes         // ข้อมูลไบนารีรูปภาพ (BYTEA ใน PostgreSQL)
  createdAt      DateTime      @default(now())

  repair         RepairRequest @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
}

// ตารางจดหมายเหตุเก็บประวัติเก่า
model RepairArchive {
  id             String        @id @default(cuid())
  cycleLabel     String        // ป้ายรอบประวัติ (เช่น ประจำปีการศึกษา 2569, ประจำเดือน กรกฎาคม 2569)
  startDate      DateTime
  endDate        DateTime
  data           String        @db.Text // ข้อมูลรายการแจ้งซ่อมทั้งหมดที่ถูกบีบอัดเป็น JSON String (รวมภาพในรูป Base64 หรือตัดภาพออก ขึ้นกับการตั้งค่า)
  totalCount     Int           @default(0)
  totalCost      Float         @default(0.0)
  archivedById   String
  createdAt      DateTime      @default(now())
}
```

และต้องเพิ่ม Relations ในโมเดล `User` ด้วย:
```prisma
model User {
  // ... (ฟิลด์เดิม)
  createdRepairs  RepairRequest[] @relation("RequestCreatedBy")
  assignedRepairs RepairRequest[] @relation("RequestAssignedTo")
}
```

---

## 3. การรับส่งข้อมูลรูปภาพแบบ Binary (BYTEA Data Flow)

เนื่องจาก Next.js Server Actions ไม่รองรับการส่ง Object ที่มี Buffer เป็นการตอบกลับแบบตรงๆ (เพราะมีข้อจำกัดเรื่อง JSON Serialization):

1. **ขาเข้า (Upload / Write)**:
   - ฝั่งไคลเอนต์ใช้ HTML5 Canvas ย่อและแปลงรูปภาพเป็น Base64 Data URL
   - ส่ง Base64 String ผ่าน Server Action ไปที่หลังบ้าน
   - หลังบ้านถอดรหัส Base64 เป็น Buffer แล้วบันทึกลงฟิลด์ `imageData: Bytes` ของ Prisma:
     ```ts
     const base64Data = base64Str.split(",")[1];
     const buffer = Buffer.from(base64Data, "base64");
     await prisma.repairPhoto.create({
       data: {
         repairId,
         photoType,
         mimeType,
         imageData: buffer
       }
     });
     ```
2. **ขาออก (Read / Render)**:
   - ในการดึงรายละเอียด (Detail Page) Server Action จะอ่านข้อมูล `Bytes` (ซึ่งมาเป็น `Buffer` บน Node.js) แล้วแปลงกลับเป็น Base64 Data URL เพื่อส่งกลับไปแสดงผลบนรูปภาพ `<img>` ทันที:
     ```ts
     const base64Url = `data:${photo.mimeType};base64,${photo.imageData.toString("base64")}`;
     ```
   - เพื่อป้องกันไม่ให้ความเร็วในการโหลดตารางรายการช้าลง การดึงข้อมูลรายการแจ้งซ่อมทั้งหมด (List view) จะ **ไม่ดึงฟิลด์ภาพและข้อมูลความสัมพันธ์ `photos`** (ใช้คำสั่ง select หรือดึงเฉพาะฟิลด์พื้นฐาน) และจะดึงรูปภาพเฉพาะเมื่อกดเข้าไปดูรายละเอียดรายการเดี่ยวเท่านั้น

---

## 4. โครงสร้างเส้นทางและ UI (Routes & UI Components)

1. **เมนูข้าง (Sidebar)**:
   - เพิ่มรายการ "ระบบแจ้งซ่อม" (Repair Request) ใต้กลุ่มเมนู "งานทั่วไป" ใน `src/app/(app)/layout.tsx` โดยแสดงผลหาก `enableRepair` เป็นจริง (หรือแอดมินเข้าถึงได้ตลอด)
   - ใช้ไอคอน `Wrench` หรือ `ClipboardList`
2. **หน้าจอหลักของระบบแจ้งซ่อม (`src/app/(app)/repair/page.tsx`)**:
   - หน้าจอ Dashboard สรุปจำนวนงานแยกตามสถานะ (การ์ดสถิติแบบยกลอยตัว `.stat-card` ตามดีไซน์)
   - ตารางแสดงรายการแจ้งซ่อม (ตัวกรองสถานะ, ช่องค้นหา)
   - สำหรับแอดมิน: มีปุ่มมอบหมายงานเปิดหน้าต่างเลือกผู้รับผิดชอบ
   - สำหรับคนทั่วไป: มีปุ่มกดแจ้งซ่อมพาไปหน้าฟอร์ม
3. **ฟอร์มสร้างรายการแจ้งซ่อม (`src/app/(app)/repair/new/page.tsx`)**:
   - ระบุเรื่อง, สถานที่, รายละเอียดปัญหา, ความเร่งด่วน
   - ส่วนอัปโหลดภาพก่อนซ่อม (ย่ออัตโนมัติบน Client)
4. **หน้าจอดำเนินการซ่อม (สำหรับช่าง/แอดมิน)**:
   - สามารถระบุสถานะ (กำลังดำเนินการ/เสร็จสิ้น)
   - อัปโหลดภาพหลังซ่อม, ระบุค่าใช้จ่าย (Cost), และบันทึกวัสดุที่ใช้
5. **หน้าจอตั้งค่าระบบและการจัดการจดหมายเหตุ (`src/app/(app)/settings/page.tsx`)**:
   - เพิ่มตัวเลือกเปิด/ปิดระบบแจ้งซ่อม `enableRepair`
   - แถบสำหรับการจัดการ Archive: แอดมินระบุวันที่เริ่มต้น-สิ้นสุด และชื่อรอบการเก็บข้อมูล ระบบจะสรุปจำนวนรายการแจ้งซ่อม และสร้างก้อน Archive ก่อนจะล้างตารางหลัก

---

## 5. แผนการความปลอดภัยและการตรวจทาน (Migration & Verification Plan)

1. **Database Migration**:
   - รันคำสั่งตรวจทานการเปลี่ยนแปลงตามขั้นตอนใน `MIGRATION_SAFETY.md`
   - `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` เพื่อตรวจสอบความปลอดภัยของ SQL
   - ทำคำสั่งสร้าง Migration: `npx prisma migrate dev --create-only --name add_repair_system`
   - ตรวจความถูกต้องของไฟล์ `.sql` แล้วจึงรัน `npx prisma migrate dev`
2. **การทดสอบระบบ (Manual Testing)**:
   - สร้างข้อมูลการแจ้งซ่อมใหม่พร้อมแนบรูปภาพ และตรวจสอบว่าภาพถูกบีบอัดขนาดไฟล์ลงต่ำกว่า 100 KB จริงหรือไม่
   - มอบหมายงานให้ช่างและทดสอบว่าผู้ใช้อื่นไม่สามารถกดอัปเดตงานนั้นได้ ยกเว้นแอดมินหรือช่างที่ได้รับมอบหมาย
   - ดำเนินการซ่อมจนเสร็จสิ้น อัปโหลดรูปภาพหลังซ่อม บันทึกค่าใช้จ่าย
   - ตรวจสอบความถูกต้องของการแปลงข้อมูลภาพจาก `BYTEA` เป็น Base64 ในหน้าแสดงผลรายละเอียด
   - ทำการกด Archive ข้อมูลช่วงเวลาและตรวจเช็คว่าข้อมูลย้ายเข้าไปยังตาราง Archive และล้างออกจากตารางหลักจริง

---
*(กรุณาตรวจสอบเอกสารการออกแบบนี้ หากมีส่วนใดต้องการแก้ไขเพิ่มเติมแจ้งได้ทันที และเมื่อเห็นพ้องต้องกันแล้ว เราจะใช้คำสั่งเพื่อเข้าสู่แผนการเขียนแผนการทำงาน Implementation Plan ต่อไป)*
