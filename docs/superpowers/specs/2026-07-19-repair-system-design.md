# ระบบแจ้งซ่อม (Repair Request System) — Design Specification v5.5 (Master Architecture Blueprint)

เอกสารนี้กำหนดการออกแบบและโครงสร้างของ **ระบบแจ้งซ่อม** ซึ่งเป็นระบบย่อยเพิ่มเติมในกลุ่มงานทั่วไป (ต่อจากระบบเอกสาร) สำหรับระบบ **eLeave & School OS** โดยมุ่งเน้นความเป็นระเบียบ ความปลอดภัย และความคุ้มค่าของพื้นที่เก็บข้อมูล (Zero Dependency + Database-backed BYTEA Storage + Archiving)

---

## 1. โครงสร้างสิทธิ์การเข้าใช้งาน (Centralized Permission Matrix)

ระบบควบคุมสิทธิ์จะย้ายจากการเช็คบทบาทแบบ Hardcode ไปใช้แบบ Capability-Based Permission Matrix แทน ซึ่งจะถูกจัดเก็บในไฟล์ [src/lib/permissions.ts](file:///C:/dev/eLeave/src/lib/permissions.ts) มีรายละเอียดดังนี้ (จะไม่มีสิทธิ์ชื่อ `repair:view` เพื่อลดความซ้ำซ้อน):

- `repair:create`: สิทธิ์ในการส่งใบแจ้งซ่อมใหม่ (สำหรับครูและแอดมิน)
- `repair:view.own`: สิทธิ์ดูรายการแจ้งซ่อมและรายงานประวัติที่ตนเองเป็นผู้สร้าง (สำหรับครูและแอดมิน)
- `repair:view.all`: สิทธิ์ดูรายการแจ้งซ่อมทั้งหมดในระบบโรงเรียน (สำหรับช่างและแอดมิน)
- `repair:assign`: สิทธิ์ในการมอบหมายงานให้ช่างผู้รับผิดชอบ (สำหรับแอดมิน)
- `repair:update`: สิทธิ์อัปเดตสถานะการทำงาน บันทึกวัสดุ และบันทึกรูปภาพงานหลังดำเนินการซ่อม (สำหรับช่างผู้รับผิดชอบและแอดมิน)
- `repair:archive`: สิทธิ์ล้างข้อมูลเก่าและทำระบบจดหมายเหตุย้ายข้อมูลประวัติศาสตร์ (สำหรับแอดมินเท่านั้น)

---

## 2. รูปภาพประวัติการซ่อมและการจัดเก็บ (Photo Constraints & Storage)

### A. ขีดจำกัดและการประมวลผลรูปภาพ
- **ปริมาณความจุสูงสุด**: จำกัดให้แนบรูปภาพก่อนซ่อม (BEFORE) ได้สูงสุด **2 รูป** และรูปภาพหลังซ่อม (AFTER) ได้สูงสุด **2 รูป** รวมทั้งหมดไม่เกิน **4 รูปต่อหนึ่งรายการใบงาน**
- **การย่อภาพและบีบอัดไร้รอยต่อ (Client Compression)**:
  - **ไม่จำกัดขนาดไฟล์รูปต้นฉบับ**: อนุญาตให้ผู้ใช้เลือกภาพขนาดเต็ม (3-15 MB) จากมือถือได้โดยตรง
  - **Auto Resize & Auto Recompress**: ไคลเอนต์จะประมวลผลผ่าน HTML5 Canvas ย่อให้ด้านยาวสุดของภาพไม่เกิน **800px** บีบอัดเป็น **JPEG (Quality = 0.7)** และหากขนาดรูปยังคงเกิน **100 KB** จะทำการลดคุณภาพความละเอียดลงมาที่ 0.5 อัตโนมัติ เพื่อการันตีปลายทางขนาดรูป $\le 100\text{ KB}$ เสมอก่อนส่งไปยัง Server Action
- **สถาปัตยกรรมการจัดเก็บ**: บันทึกรูปภาพในรูปแบบ Raw Binary (`Bytes` หรือ `BYTEA` ในฐานข้อมูล PostgreSQL) เพื่อหลีกเลี่ยง Overhead (+33%) ของ Base64

### B. การจัดส่งรูปภาพประสิทธิภาพสูง (API Secure Streaming)
จัดทำเส้นทาง API ใน [src/app/api/repair/photo/[photoId]/route.ts](file:///C:/dev/eLeave/src/app/api/repair/photo/%5BphotoId%5D/route.ts) เพื่อดึงข้อมูลรูปภาพแบบ Binary Stream ด้วยความปลอดภัยสูง:
- ตรวจสอบเซสชันผู้ใช้งานและสิทธิ์ หากไม่มีสิทธิ์ `repair:view.all` และไม่ได้เป็นเจ้าของใบงาน (Requester / Assignee) จะส่งกลับ 403 Forbidden
- ตั้งแคชระยะกลาง 7 วันเพื่อป้องกันปัญหาแคชค้างหากมีกรณีปรับปรุงรูปภาพ `"Cache-Control": "public, max-age=604800, immutable"`

---

## 3. โครงสร้างฐานข้อมูล (Database Schema)

โมเดลสำหรับโมดูลแจ้งซ่อมใน [schema.prisma](file:///C:/dev/eLeave/prisma/schema.prisma):

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

// ตารางหลักสำหรับการแจ้งซ่อม
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
  cost           Decimal?        @db.Decimal(10, 2) // ข้อมูลการเงินเที่ยงตรง ปลอดภัยจากปัญหาปัดเศษสะสม
  materialsUsed  String?         @db.Text
  cancelReason   String?         @db.Text
  assignedAt     DateTime?
  finishedAt     DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  photos         RepairPhoto[]

  // Composite Indexes สำหรับความเร็วในการค้นหาหน้ารายงานและแดชบอร์ดตามพฤติกรรมจริง
  @@index([status, createdAt(sort: Desc)])
  @@index([status, updatedAt])
  @@index([assigneeId, status])
  @@index([requesterId, status])
  @@index([updatedAt]) // เพื่อประสิทธิภาพสูงสุดของ ETL Job ค้นหาและเรียงลำดับ updatedAt
}

// ตารางเก็บภาพในรูปแบบ Binary (BYTEA)
model RepairPhoto {
  id        String          @id @default(cuid())
  repairId  String          // Non-nullable: ป้องกันปัญหารูปภาพกำพร้า (Orphan Photo)
  photoType RepairPhotoType // กำหนดเป็น Enum ป้องกันการพิมพ์ผิด
  mimeType  String          // e.g., "image/jpeg"
  imageData Bytes           // เก็บ Raw Binary (BYTEA) ขนาดคอมเพรสแล้ว <100KB
  createdAt DateTime        @default(now())
  
  repair    RepairRequest   @relation(fields: [repairId], references: [id], onDelete: Cascade)

  @@index([repairId])
  @@index([repairId, photoType]) // ดึงรูปภาพแยกตามประเภทงาน BEFORE/AFTER อย่างมีประสิทธิภาพลดปัญหาการสแกนตารางแบบ N+1
}

// ตารางจดหมายเหตุเก็บประวัติเก่าในรูปของ Json (ไม่เก็บรูปภาพเพื่อรักษาขนาดพื้นที่เก็บข้อมูล)
model RepairArchive {
  id             String        @id @default(cuid())
  archivedAt     DateTime      @default(now())
  itemCount      Int
  completedCount Int
  cancelledCount Int
  totalCost      Decimal?      @db.Decimal(12, 2)
  payload        Json          // Native JSONB เก็บเนื้อหาใบแจ้งซ่อมดิบ ค้นหาสะดวก
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

---

## 4. ระบบการคลังจดหมายเหตุย้อนหลัง (Pragmatic ETL Archiver Engine)

ประวัติการแจ้งซ่อมที่ได้รับการซ่อมเสร็จสิ้น (`COMPLETED`) หรือยกเลิก (`CANCELLED`) ที่มีอายุอัปเดตย้อนหลังมากกว่า **180 วัน** จะถูกกวาดและโอนเข้าตารางประวัติศาสตร์ทีละ **200 เรคคอร์ด (Chunk Size = 200)** ภายใต้กระบวนการของไฟล์ [src/app/actions/archive.ts](file:///C:/dev/eLeave/src/app/actions/archive.ts):

1. **Transaction Isolation & Timeout**: 
   - การรันกระบวนการย้ายข้อมูลทั้งหมดจะอยู่ภายใต้ `prisma.$transaction`
   - กำหนดเวลาการประมวลผลสูงสุด **30 วินาที (timeout: 30000)** เพื่อรับประกันความปลอดภัยของระบบฐานข้อมูลกรณีติดล็อกการทำรายการ (Deadlock) หรือเครื่องทำงานหนัก
2. **Deterministic Processing**: การคิวรีดึงข้อมูลใบแจ้งซ่อมเก่าจะใช้การเรียงลำดับล่วงหน้า `orderBy: { updatedAt: "asc" }` เพื่อให้ประวัติที่อัปเดตเก่าที่สุดได้รับการจัดเก็บเข้าคลังก่อน ทำงานอย่างเป็นระบบ และดีบักง่าย
3. **Infinite Loop Protection**: มีการกำหนดจำนวนลูปประมวลผลสูงสุด `const MAX_BATCHES = 100` เพื่อรับประกันว่า Job จะไม่มีการรันค้างเป็นวงลูปไม่สิ้นสุดกรณีมีข้อมูลผิดปกติ
4. **Schema Evolution Support**: โครงสร้างฟิลด์ `payload` ในตาราง `RepairArchive` จะถูกบันทึกด้วยรูปแบบ Schema Versioning หุ้มอาร์เรย์รายการเพื่อรองรับการขยายโครงสร้างฐานข้อมูลในอนาคต:
   ```json
   {
     "version": 1,
     "records": [...]
   }
   ```
5. **การล้างรูปภาพ (Metadata-Only Archiving)**: 
   - ระบบจะแปลงข้อมูลเฉพาะเนื้อหาของใบแจ้งซ่อมหลักรวมถึงรายละเอียดผลการดำเนินการซ่อมและค่าใช้จ่ายเก็บเข้าโครงสร้าง payload ในรูป JSON
   - การลบเรคคอร์ด `RepairRequest` ด้วยคำสั่ง delete จะทำให้รูปภาพที่เกี่ยวข้องทั้งหมดในตาราง `RepairPhoto` ถูกลบออกถาวรโดยอัตโนมัติผ่านข้อกำหนด `onDelete: Cascade` ทำให้ขนาดพื้นที่เก็บข้อมูลของระบบเป็นสัดส่วนที่ต่ำมาก
6. **Audit Logs**: มีระบบบันทึกความปลอดภัยของประวัติผ่าน `SystemLog` ทุกครั้งที่มีการล้างประวัติงานแจ้งซ่อมสำเร็จในกิจกรรม `REPAIR_ARCHIVED`

---

## 5. การจัดการสิทธิ์และการบันทึก Log แบบโครงสร้าง (Data Safety & Concurrency Control)

- **Optimistic Locking & Concurrency Protection**: เพื่อป้องกันปัญหาการอัปเดตงานซ้อนกันโดยช่างซ่อมหลายคน (Lost Update) การดำเนินการแก้ไขข้อมูลสถานะใบแจ้งซ่อมจะต้องตรวจสอบเงื่อนไขสถานะปัจจุบันที่คาดหวัง หรือระบุขอบเขตเวลาปรับปรุง `updatedAt` ในฟังก์ชันแก้ไข (เช่น การเปลี่ยนสถานะเป็น COMPLETED จะอัปเดตได้เฉพาะใบงานที่ยังมีสถานะเป็น IN_PROGRESS เท่านั้น)
- **Decimal Cost Serialization**: เพื่อป้องกันปัญหา Next.js Server Actions พังเนื่องจากข้อจำกัดการรับส่งออบเจกต์ Decimal ข้อมูลฟิลด์ `cost` จะต้องถูกแปลงเป็นตัวเลข JavaScript หรือ string เสมอก่อนส่งออกไปยังส่วนประกอบไคลเอนต์:
  ```typescript
  cost: record.cost ? record.cost.toNumber() : null
  ```
- **Structured Audit Logs**: ทุกกิจกรรมที่เกิดขึ้นในระบบแจ้งซ่อมจะถูกระบุด้วยคีย์กิจกรรมและจัดเก็บในรูปโครงสร้างที่มีเครื่องหมายระบุเพื่อการแยกแยะทำรายงานในอนาคต:
  ```text
  [REPAIR_ID:${repairId}][ACTOR_ID:${userId}][ACTION:${action}] รายละเอียดกิจกรรม...
  ```

---

## 6. แบ็คล็อกการเฝ้าระวังและการปรับปรุงหลังขึ้นระบบจริง (Post-Go-Live Operations)

🎫 **[STG-001] Migrate RepairPhoto.imageData from BYTEA to S3 Compatible Storage**
- *รายละเอียด*: เฝ้าระวังและบันทึกปริมาณพื้นที่ตารางรูปภาพ `RepairPhoto`
- *เงื่อนไขกระตุ้น (Trigger)*: เมื่อฐานข้อมูลมีขนาดใหญ่เกินกว่า **5 GB**
- *แนวทางแก้ไข*: ทำการสร้างถังเก็บข้อมูลคลาวด์ภายนอกที่รองรับ S3 (เช่น AWS S3, MinIO, หรือ Cloudflare R2) แล้วทำการย้ายฟิลด์ไบนารี `imageData` ออกไป และเก็บเป็นลิงก์ URL แทน โดยในปัจจุบันระยะ 1-3 ปีแรกให้ใช้โครงสร้างแบบ BYTEA บนระบบ PostgreSQL ของ eLeave ต่อเนื่องอย่างสมบูรณ์

---
*(เอกสารการออกแบบฉบับสมบูรณ์ v5.5 ได้รับการปรับปรุงเพื่อเป็นพิมพ์เขียวการโค้ดเรียบร้อย)*
