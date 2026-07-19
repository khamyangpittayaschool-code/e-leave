# ระบบแจ้งซ่อม (Repair Request System) — Design Specification

เอกสารนี้กำหนดการออกแบบและโครงสร้างของ **ระบบแจ้งซ่อม** ซึ่งเป็นระบบย่อยเพิ่มเติมในกลุ่มงานทั่วไป (ต่อจากระบบเอกสาร) สำหรับระบบ **eLeave & School OS** โดยมุ่งเน้นความเป็นระเบียบ ความปลอดภัย และความคุ้มค่าของพื้นที่เก็บข้อมูล (Zero Dependency + Database-backed BYTEA Storage + Archiving)

---

## 1. สรุปความต้องการ (Requirement Summary)

1. **สิทธิ์และการเข้าถึง (Roles & Workflow)**:
   - **ครู/บุคลากรทั่วไป (User)**: แจ้งซ่อมได้, ดูประวัติการแจ้งซ่อมของตนเองได้
   - **แอดมิน (Admin)**: ดูใบแจ้งซ่อมทั้งหมด, มอบหมายงานให้ช่าง/ผู้รับผิดชอบ, แก้ไขข้อมูล, และจัดการการเก็บข้อมูลถาวร (Archive)
   - **ผู้รับผิดชอบงาน/ช่าง (Assigned Technician)**: เมื่อได้รับมอบหมายงาน จะสามารถดูรายละเอียด และอัปเดตสถานะงาน (กำลังดำเนินการ, ซ่อมเสร็จสิ้น) บันทึกรายละเอียดการซ่อม อัปโหลดภาพหลังซ่อม และระบุค่าใช้จ่ายได้
2. **รูปภาพประวัติการซ่อม (Before & After Photos)**:
   - อัปโหลดรูปภาพ "ก่อนซ่อม" (โดยผู้แจ้ง) และ "หลังซ่อม" (โดยช่างผู้ดำเนินการ)
   - **การบีบอัดฝั่งไคลเอนต์ (Client-Side Resizing & Compression)**:
     - ใช้ HTML5 Canvas ย่อขนาดภาพให้มีความกว้าง/สูงไม่เกิน **800px**
     - บีบอัดไฟล์ในรูปแบบ **JPEG** ด้วยความละเอียด **Quality = 0.7**
     - ตรวจสอบความถูกต้องฝั่งไคลเอนต์ (Client-Side Validation) ให้ขนาดไฟล์ **ไม่เกิน 100 KB** ต่อรูปภาพ
   - **การเก็บข้อมูล (Storage)**: บันทึกรูปภาพในรูปแบบ Binary (`Bytes` / `BYTEA` ใน PostgreSQL) เพื่อหลีกเลี่ยง Overhead (+33%) ของ Base64
3. **การแสดงผลภาพขนาดเล็ก (Thumbnail Mode)**:
   - ในหน้ารายการ (List/Table Views) และตัวอย่างเบื้องต้น จะไม่ดึงรูปภาพเต็มรูปแบบ
   - หากจำเป็นต้องแสดงภาพในส่วนใด ให้ครอบด้วยขนาด **120 x 120 pixels** เพื่อลดการใช้ RAM ของเบราว์เซอร์
   - แสดงผลภาพเต็มขนาด (Full-size image) เฉพาะเมื่อผู้ใช้คลิกที่รูปภาพเท่านั้น
4. **ระบบจดหมายเหตุ (Archive Policy)**:
   - **Auto-Archive**: ระบบจะย้ายข้อมูลใบแจ้งซ่อมที่มีสถานะเสร็จสิ้น (Completed) หรือยกเลิก (Cancelled) ที่มีอายุมากกว่า **180 วัน** เข้าสู่ระบบจดหมายเหตุอัตโนมัติ (ผ่านระบบตรวจเช็คอัตโนมัติ หรือ Server-side hook)
   - **Manual Archive**: แอดมินสามารถกดปุ่ม "Archive Now" ในหน้าตั้งค่าเพื่อเลือกดึงข้อมูลประวัติเก่าเข้าระบบจดหมายเหตุได้ทันที
   - การทำ Archive จะย้ายข้อมูลรูปภาพและรายการแจ้งซ่อมแปลงเป็นก้อน JSON และบันทึกในตาราง `RepairArchive` พร้อมล้างข้อมูลรายการในตารางหลัก

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

เพิ่มโมเดลใน [schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma):

```prisma
enum RepairStatus {
  PENDING      // รอดำเนินการ
  ASSIGNED     // มอบหมายช่างแล้ว
  IN_PROGRESS  // กำลังดำเนินการ
  COMPLETED    // ซ่อมเสร็จสิ้น
  CANCELLED    // ยกเลิกรายการ
}

// ตารางหลักสำหรับการแจ้งซ่อม
model RepairRequest {
  id             String         @id @default(cuid())
  title          String         // เรื่อง/รายการแจ้งซ่อม (เช่น เครื่องปรับอากาศไม่เย็น)
  description    String         @db.Text // รายละเอียดปัญหา
  location       String         // สถานที่ (อาคาร/ห้อง)
  urgency        String         @default("NORMAL") // NORMAL (ปกติ), URGENT (ด่วน), URGENT_MOST (ด่วนที่สุด)
  status         RepairStatus   @default(PENDING)
  
  // ผู้แจ้งซ่อม
  requesterId    String
  requester      User           @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
  
  // ผู้รับผิดชอบ (ช่าง/เจ้าหน้าที่)
  assigneeId     String?
  assignee       User?          @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
  
  // ข้อมูลการดำเนินการซ่อม
  resolutionNote String?        @db.Text // รายละเอียดการแก้ไข
  cost           Float?         @default(0.0) // ค่าใช้จ่าย (ถ้ามี)
  materialsUsed  String?        @db.Text // วัสดุ/อุปกรณ์ที่ใช้
  
  cancelReason   String?        @db.Text // เหตุผลที่ยกเลิกการแจ้งซ่อม
  
  // วันเวลาที่เกี่ยวข้อง
  assignedAt     DateTime?
  finishedAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  // ความสัมพันธ์กับรูปภาพ
  photos         RepairPhoto[]

  @@index([requesterId])
  @@index([assigneeId])
  @@index([status])
}

// ตารางเก็บภาพในรูปแบบ Binary (BYTEA)
model RepairPhoto {
  id             String         @id @default(cuid())
  repairId       String
  photoType      String         // BEFORE (ก่อนซ่อม), AFTER (หลังซ่อม)
  mimeType       String         // เช่น image/jpeg
  imageData      Bytes          // ข้อมูลไบนารีรูปภาพ (BYTEA ใน PostgreSQL)
  createdAt      DateTime       @default(now())

  repair         RepairRequest  @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
}

// ตารางจดหมายเหตุเก็บประวัติเก่าในรูปของ Json
model RepairArchive {
  id             String         @id @default(cuid())
  archivedAt     DateTime       @default(now())
  itemCount      Int
  payload        Json           // ข้อมูลรายการแจ้งซ่อมทั้งหมดที่ถูกบีบอัดแบบ JSON
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

## 3. การแสดงผลและการรับส่งข้อมูลรูปภาพ (Data Flow & Image Compression)

### A. ไหล่ของข้อมูลภาพ (BYTEA Data Flow)
1. **ฝั่งส่ง (Client -> Server)**:
   - ผู้ใช้อัปโหลดรูปภาพผ่านหน้าเว็บ เบราว์เซอร์ประมวลผลย่อและบีบอัดภาพด้วย Canvas
   - ตรวจเช็คขนาดว่าขนาด Base64 Data URL ไม่เกินขีดจำกัด (คำนวณย้อนกลับแล้วต้องไม่เกิน 100 KB)
   - ส่งสายอักขระ Base64 ไปยัง Server Action
   - Server Action ถอดรหัสเป็น Buffer และเขียนลงฟิลด์ `imageData` ของ `RepairPhoto`
2. **ฝั่งรับ (Server -> Client)**:
   - ในหน้ารายการหลัก (List View) จะไม่มีการดึงข้อมูล `photos` มาเลย
   - ในหน้าแสดงรายละเอียดของรายการเดียว (Detail View) Server Action จะอ่าน `imageData` (Buffer) และแปลงเป็น Base64 Data URL ส่งกลับไปเป็น JSON เพื่อแสดงผลบน `<img>`

### B. สคริปต์ย่อขนาดรูปภาพบน Client (Client-Side Compression Script Template)
```javascript
const compressImage = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // บีบอัดเป็น JPEG พร้อมระบุคุณภาพ
        canvas.toBlob(
          (blob) => {
            if (blob.size > 100 * 1024) {
              // หากยังเกิน 100KB ให้ลองลดคุณภาพการบีบอัดลงมาที่ 0.5
              canvas.toBlob(
                (smallerBlob) => {
                  resolve(smallerBlob);
                },
                "image/jpeg",
                0.5
              );
            } else {
              resolve(blob);
            }
          },
          "image/jpeg",
          quality
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
};
```

---

## 4. โครงสร้างเส้นทางและ UI (Routes & UI Components)

1. **เมนูข้าง (Sidebar)**:
   - เพิ่มรายการ "ระบบแจ้งซ่อม" (Repair Request) ใต้กลุ่มเมนู "งานทั่วไป" ใน `src/app/(app)/layout.tsx` โดยแสดงผลหาก `enableRepair` เป็นจริง (หรือแอดมินเข้าถึงได้ตลอด)
   - ใช้ไอคอน `Wrench`
2. **หน้าจอหลักของระบบแจ้งซ่อม (`src/app/(app)/repair/page.tsx`)**:
   - สรุปตัวเลขสถิติของสถานะต่างๆ (การ์ดสถิติแบบยกลอยตัว `.stat-card` ตามดีไซน์)
   - รายการแจ้งซ่อมทั้งหมด (ตัวกรองสถานะ, ค้นหา)
   - สำหรับแอดมิน: มีปุ่มมอบหมายงานเปิดหน้าต่างเลือกผู้รับผิดชอบ
   - สำหรับบุคลากรทั่วไป: มีปุ่มสร้างใบแจ้งซ่อมใหม่
3. **หน้าจอส่งแจ้งซ่อมใหม่ (`src/app/(app)/repair/new/page.tsx`)**:
   - กรอกเรื่อง, รายละเอียด, สถานที่, และระดับความเร็วเร่งด่วน พร้อมแนบรูปภาพก่อนซ่อม
4. **หน้าจอดำเนินการซ่อม (สำหรับช่าง/แอดมิน)**:
   - ระบุรายละเอียดการซ่อมแซม, บันทึกวัสดุที่ใช้, แนบภาพหลังซ่อมเสร็จ, และค่าใช้จ่าย
5. **หน้าตั้งค่า Archive (`src/app/(app)/settings/page.tsx`)**:
   - แถบระบบแจ้งซ่อม: เพิ่มปุ่มสลับเปิด/ปิดระบบแจ้งซ่อม และส่วนจัดการการล้างข้อมูล Archive (อัตโนมัติ 180 วัน / กดยกเลิกและ Archive ทันที)

---

## 5. แผนการความปลอดภัยและการตรวจทาน (Migration & Verification Plan)

1. **Database Migration**:
   - รันคำสั่งตรวจทานการเปลี่ยนแปลงตามขั้นตอนใน `MIGRATION_SAFETY.md`
   - `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` เพื่อตรวจสอบความปลอดภัยของ SQL
   - ทำคำสั่งสร้าง Migration: `npx prisma migrate dev --create-only --name add_repair_system`
   - ตรวจความถูกต้องของไฟล์ `.sql` แล้วจึงรัน `npx prisma migrate dev`
2. **การทดสอบระบบ (Manual Testing)**:
   - ทดสอบการย่อขนาดรูปภาพฝั่งไคลเอนต์และตรวจสอบขนาดจริงบนระบบก่อนอัปโหลด
   - ทดสอบสิทธิ์การอัปเดตรายการเฉพาะแอดมินและช่างที่ได้รับมอบหมาย
   - ทดสอบการทำ Archive ทั้งแบบกำหนดเวลาอิงจากประวัติต่างๆ และการเรียกย้ายประวัติเก่าทั้งหมดทันที

---
*(กรุณาตรวจสอบเอกสารการออกแบบนี้ หากมีส่วนใดต้องการแก้ไขเพิ่มเติมแจ้งได้ทันที และเมื่อเห็นพ้องต้องกันแล้ว เราจะใช้คำสั่งเพื่อเข้าสู่แผนการเขียนแผนการทำงาน Implementation Plan ต่อไป)*
