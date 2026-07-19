# ระบบแจ้งซ่อม (Repair Request System) — Design Specification

เอกสารนี้กำหนดการออกแบบและโครงสร้างของ **ระบบแจ้งซ่อม** ซึ่งเป็นระบบย่อยเพิ่มเติมในกลุ่มงานทั่วไป (ต่อจากระบบเอกสาร) สำหรับระบบ **eLeave & School OS** โดยมุ่งเน้นความเป็นระเบียบ ความปลอดภัย และความคุ้มค่าของพื้นที่เก็บข้อมูล (Zero Dependency + Database-backed BYTEA Storage + Archiving)

---

## 1. สรุปความต้องการ (Requirement Summary)

1. **สิทธิ์และการเข้าถึง (Permissions & Access Control)**:
   - สอดคล้องกับระบบสิทธิ์เดิมของ eLeave โดยเพิ่มคีย์สิทธิ์ลงในโครงสร้างสิทธิ์ของระบบดังนี้:
     - `repair:view`: สิทธิ์ในการดูหน้าจอด้านการแจ้งซ่อมและรายงาน (ครู, ช่าง, แอดมิน)
     - `repair:create`: สิทธิ์ในการกดแจ้งซ่อมใหม่ (ครูทุกคน, แอดมิน)
     - `repair:assign`: สิทธิ์ในการมอบหมายงานให้ช่าง (แอดมิน, เจ้าหน้าที่พัสดุ)
     - `repair:update`: สิทธิ์ในการอัปเดตงาน เช่น เริ่มงาน, ปิดงาน, แนบภาพหลังซ่อม, ระบุค่าซ่อม (ช่างผู้รับผิดชอบ, แอดมิน)
     - `repair:archive`: สิทธิ์ในการดำเนินงานเก็บถาวรและล้างข้อมูลเก่า (แอดมินเท่านั้น)
2. **รูปภาพประวัติการซ่อม (Before & After Photos)**:
   - อัปโหลดรูปภาพ "ก่อนซ่อม" (โดยผู้แจ้ง) และ "หลังซ่อม" (โดยช่างผู้ดำเนินการ)
   - **การจำกัดจำนวนภาพ (Photo Limits)**:
     - รูปภาพก่อนซ่อม (BEFORE): สูงสุด **2 รูป** (เช่น ภาพมุมกว้างเพื่อดูตำแหน่ง และภาพซูมจุดที่เสียหาย)
     - รูปภาพหลังซ่อม (AFTER): สูงสุด **2 รูป** (เช่น ภาพมุมกว้างของผลงาน และภาพจุดที่ได้รับการแก้ไขเสร็จสิ้น)
     - รวมสูงสุด **4 รูป** ต่อใบแจ้งซ่อม
   - **การตรวจสอบความถูกต้อง (Validation Rules)**:
     - *Client-side & Server-side*: ตรวจทานการอัปโหลดให้ `BEFORE <= 2` และ `AFTER <= 2`
   - **การย่อภาพและบีบอัดไร้รอยต่อ (UX-Focused Resizing & Compression)**:
     - **ไม่จำกัดขนาดไฟล์ต้นฉบับ**: ผู้ใช้สามารถอัปโหลดไฟล์ขนาดใดก็ได้จากสมาร์ทโฟนโดยตรง (3-15 MB) โดยไม่มีป๊อปอัปแจ้งเตือนให้ลดขนาดเอง
     - **Client-side Auto-Resize**: ใช้ HTML5 Canvas ย่อสัดส่วนด้านยาวสุดของภาพให้ไม่เกิน **800px** และแปลงรูปแบบเป็น **JPEG** ความละเอียดเริ่มต้น **Quality = 0.7**
     - **Auto-Recompress**: ในกรณีที่หลังย่อขนาดแล้วขนาดไฟล์ภาพยังเกิน **100 KB** ให้ลดระดับคุณภาพความละเอียดลงมาที่ 0.5 โดยอัตโนมัติ เพื่อให้ได้ผลลัพธ์ประมาณ 30-80 KB ต่อรูปภาพเสมอก่อนส่งไปยัง Server Action
   - **การเก็บข้อมูล (Storage)**: บันทึกรูปภาพในรูปแบบ Binary (`Bytes` / `BYTEA` ใน PostgreSQL) เพื่อหลีกเลี่ยง Base64 Overhead (+33%)
3. **การแสดงผลภาพขนาดเล็ก (Thumbnail Mode)**:
   - ในหน้ารายการหลัก (List View) จะไม่มีการดึงข้อมูล `photos` มาเลย
   - หากจำเป็นต้องแสดงภาพในส่วนใด (เช่น ส่วนดูข้อมูลย่อ) ให้ครอบด้วยขนาด **120 x 120 pixels** เพื่อลดการใช้ RAM ของเบราว์เซอร์
   - แสดงผลภาพเต็มขนาด (Full-size image) เฉพาะเมื่อผู้ใช้คลิกที่รูปภาพเท่านั้น (LightBox / Modal Zoom)
4. **ระบบบันทึกประวัติการดำเนินงาน (Audit Log Integration)**:
   - ทุกครั้งที่มีการเปลี่ยนแปลงสถานะหรือปรับปรุงข้อมูลใบแจ้งซ่อม ระบบจะบันทึก Log ไปยังตาราง `SystemLog` ด้วยรหัสประเภทกิจกรรม:
     - `REPAIR_CREATED`: เมื่อสร้างใบแจ้งซ่อมสำเร็จ
     - `REPAIR_ASSIGNED`: เมื่อมอบหมายช่างผู้รับผิดชอบสำเร็จ
     - `REPAIR_STARTED`: เมื่อช่างกดเริ่มงาน (เปลี่ยนสถานะเป็น `IN_PROGRESS`)
     - `REPAIR_COMPLETED`: เมื่อซ่อมแซมเสร็จสิ้น (เปลี่ยนสถานะเป็น `COMPLETED`)
     - `REPAIR_CANCELLED`: เมื่อแอดมินหรือผู้แจ้งยกเลิกคำขอ (เปลี่ยนสถานะเป็น `CANCELLED`)
     - `REPAIR_ARCHIVED`: เมื่อประวัติถูกโอนเข้าสู่ระบบจดหมายเหตุ
5. **ระบบจดหมายเหตุและการกู้คืน (Archive Policy)**:
   - **Soft Delete ก่อน Archive**: ข้อมูลที่จะถูกบีบอัดเก็บถาวรจะต้องระบุวันเวลา `archivedAt` ในตารางหลักเพื่อทำเครื่องหมายว่าถูก Soft Delete ก่อนป้องกันปัญหาค้างคา
   - **Archive Transaction**: การสร้างเอกสารเก็บถาวร (`RepairArchive`) และการลบข้อมูลต้นทางออกจากตารางหลัก (`RepairRequest` และ `RepairPhoto`) จะถูกหุ้มอยู่ภายใน **Prisma Transaction** เดียวกันเสมอ เพื่อป้องกันปัญหาข้อมูลสูญหายหรือสถานะผิดเพี้ยนหากระบบขัดข้องระหว่างทาง (Server Crash)
   - **Auto-Archive**: ระบบจะโอนข้อมูลใบแจ้งซ่อมที่ซ่อมเสร็จ/ยกเลิก และมีอายุมากกว่า **180 วัน** เข้าสู่ระบบจดหมายเหตุอัตโนมัติ
   - **Manual Archive**: แอดมินสามารถกดย้ายและทำลายประวัติแจ้งซ่อมเก่าได้ทันทีผ่านหน้าต่างตั้งค่า

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

เพิ่มหรือปรับปรุงโมเดลใน [schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma):

```prisma
enum RepairStatus {
  PENDING      // รอดำเนินการ
  ASSIGNED     // มอบหมายช่างแล้ว
  IN_PROGRESS  // กำลังดำเนินการ
  COMPLETED    // ซ่อมเสร็จสิ้น
  CANCELLED    // ยกเลิกรายการ
}

enum RepairUrgency {
  NORMAL       // ปกติ
  URGENT       // ด่วน
  URGENT_MOST  // ด่วนที่สุด
}

enum RepairPhotoType {
  BEFORE       // ก่อนซ่อม
  AFTER        // หลังซ่อม
}

// ตารางหลักสำหรับการแจ้งซ่อม
model RepairRequest {
  id             String          @id @default(cuid())
  title          String          // เรื่อง/รายการแจ้งซ่อม (เช่น เครื่องปรับอากาศไม่เย็น)
  description    String          @db.Text // รายละเอียดปัญหา
  location       String          // สถานที่ (อาคาร/ห้อง)
  urgency        RepairUrgency   @default(NORMAL)
  status         RepairStatus    @default(PENDING)
  
  // ผู้แจ้งซ่อม
  requesterId    String
  requester      User            @relation("RequestCreatedBy", fields: [requesterId], references: [id], onDelete: Cascade)
  
  // ผู้รับผิดชอบ (ช่าง/เจ้าหน้าที่)
  assigneeId     String?
  assignee       User?           @relation("RequestAssignedTo", fields: [assigneeId], references: [id], onDelete: SetNull)
  
  // ข้อมูลการดำเนินการซ่อม
  resolutionNote String?         @db.Text // รายละเอียดการแก้ไข
  cost           Decimal?        @db.Decimal(10, 2) // ค่าใช้จ่ายเพื่อความแม่นยำทางการเงิน
  materialsUsed  String?         @db.Text // วัสดุ/อุปกรณ์ที่ใช้
  
  cancelReason   String?         @db.Text // เหตุผลที่ยกเลิกการแจ้งซ่อม
  
  // วันเวลาที่เกี่ยวข้อง
  assignedAt     DateTime?
  finishedAt     DateTime?
  archivedAt     DateTime?       // Soft Delete State ก่อนโอนย้ายเข้าจดหมายเหตุถาวร
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  // ความสัมพันธ์กับรูปภาพ
  photos         RepairPhoto[]

  @@index([requesterId])
  @@index([assigneeId])
  @@index([status])
}

// ตารางเก็บภาพในรูปแบบ Binary (BYTEA)
model RepairPhoto {
  id             String          @id @default(cuid())
  repairId       String
  photoType      RepairPhotoType
  mimeType       String          // เช่น image/jpeg
  imageData      Bytes           // ข้อมูลไบนารีรูปภาพ (BYTEA ใน PostgreSQL)
  createdAt      DateTime        @default(now())

  repair         RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
}

// ตารางจดหมายเหตุเก็บประวัติเก่าในรูปของ Json
model RepairArchive {
  id             String          @id @default(cuid())
  archivedAt     DateTime        @default(now())
  itemCount      Int
  payload        Json            // ข้อมูลรายการแจ้งซ่อมทั้งหมดที่ถูกบีบอัดแบบ JSON
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
   - ตรวจเช็คขนาดของภาพรวมและจำนวน (BEFORE $\le 2$, AFTER $\le 2$)
   - ส่งสายอักขระ Base64 ไปยัง Server Action
   - Server Action ตรวจสอบความปลอดภัยฝั่งเซิร์ฟเวอร์ ถอดรหัสเป็น Buffer และเขียนลงฟิลด์ `imageData` ของ `RepairPhoto`
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

        // บีบอัดเป็น JPEG พร้อมระบุคุณภาพ 0.7
        canvas.toBlob(
          (blob) => {
            if (blob.size > 100 * 1024) {
              // หากยังเกิน 100KB ให้ลองลดคุณภาพการบีบอัดลงมาที่ 0.5 โดยอัตโนมัติ
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
   - โหลดการตั้งค่า `enableRepair` และแสดงเมนู "ระบบแจ้งซ่อม" ใต้ "งานทั่วไป" ใน `src/app/(app)/layout.tsx` โดยอิงตามสิทธิ์ในการเข้าถึง `repair:view`
   - ใช้ไอคอน `Wrench`
2. **หน้าจอหลักของระบบแจ้งซ่อม (`src/app/(app)/repair/page.tsx`)**:
   - สรุปตัวเลขสถิติของสถานะต่างๆ (PENDING, IN_PROGRESS, COMPLETED)
   - ตารางแสดงรายการพร้อมระบบการกรองค้นหา โดยแสดงผลสิทธิ์และการกรองตามเงื่อนไข:
     - แอดมิน: ดูและจัดการได้ทั้งหมด
     - ช่าง: ดูงานที่ได้รับมอบหมายและรายงานของตนเองได้
     - ครูทั่วไป: ดูเฉพาะรายการแจ้งซ่อมของตนเองได้
   - ปุ่มกดแจ้งซ่อมใหม่ (อิงตามสิทธิ์ `repair:create`)
   - ปุ่มเลือกผู้รับผิดชอบงานสำหรับแอดมิน (อิงตามสิทธิ์ `repair:assign`)
3. **หน้าจอส่งแจ้งซ่อมใหม่ (`src/app/(app)/repair/new/page.tsx`)**:
   - ฟอร์มระบุชื่อเรื่อง, คำอธิบาย, สถานที่, และระดับความเร่งด่วน พร้อมการอัปโหลดและย่อภาพทันที (จำกัด BEFORE สูงสุด 2 รูป)
4. **หน้าจอดำเนินการซ่อม (สำหรับช่าง/แอดมิน)**:
   - ส่วนบันทึกการทำงาน, ระบุค่าใช้จ่าย (Decimal), วัสดุอุปกรณ์ และภาพหลังซ่อม (จำกัด AFTER สูงสุด 2 รูป)
5. **หน้าตั้งค่า Archive (`src/app/(app)/settings/page.tsx`)**:
   - เพิ่มปุ่มสลับเปิด/ปิดระบบแจ้งซ่อม `enableRepair`
   - เพิ่มคอลัมน์การทำ Archive ซึ่งหุ้มด้วย Transaction:
     1. ค้นหาใบแจ้งซ่อมที่ซ่อมเสร็จ/ยกเลิกที่ถึงเวลา (หรือกด Manual)
     2. อัปเดตตารางหลักตั้งค่า `archivedAt = new Date()` (Soft Delete)
     3. ดึงรายการเหล่านั้นมาจัดรูป JSON Payload
     4. บันทึกข้อมูลเข้าตาราง `RepairArchive`
     5. ลบตารางหลัก (`RepairRequest` และ `RepairPhoto`)
     6. เขียน SystemLog บันทึกกิจกรรม `REPAIR_ARCHIVED`

---

## 5. แผนการความปลอดภัยและการตรวจทาน (Migration & Verification Plan)

1. **Database Migration**:
   - รันคำสั่งตรวจทานการเปลี่ยนแปลงตามขั้นตอนใน `MIGRATION_SAFETY.md`
   - `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
   - ทำคำสั่งสร้าง Migration: `npx prisma migrate dev --create-only --name add_repair_system`
   - ตรวจความถูกต้องของไฟล์ `.sql` แล้วจึงรัน `npx prisma migrate dev`
2. **การทดสอบระบบ (Manual Testing)**:
   - ทดสอบจำกัดสิทธิ์ภาพอัปโหลดสูงสุด BEFORE 2 รูป และ AFTER 2 รูป
   - ทดสอบการย่อภาพ Canvas บนมือถือและเดสก์ท็อปให้ไม่เกิน 100 KB ต่อรูป (โดยไม่มีการบล็อกขนาดภาพต้นฉบับ)
   - ทดสอบสิทธิ์การเข้าถึงข้อมูลและการอัปเดตงานตามระบบสิทธิ์ (Permissions Check)
   - ทดสอบระบบจัดเก็บ Archive (ทั้งระบบ Auto 180 วัน และ Manual ปุ่มกด) และตรวจสอบว่าข้อมูลประวัติถูกย้ายอย่างถูกต้องและปลอดภัยแบบ atomic transaction

---
*(กรุณาตรวจสอบเอกสารการออกแบบนี้ หากมีส่วนใดต้องการแก้ไขเพิ่มเติมแจ้งได้ทันที และเมื่อเห็นพ้องต้องกันแล้ว เราจะใช้คำสั่งเพื่อเข้าสู่แผนการเขียนแผนการทำงาน Implementation Plan ต่อไป)*
