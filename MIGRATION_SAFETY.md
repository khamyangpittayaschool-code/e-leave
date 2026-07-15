# 🛡️ คู่มือความปลอดภัยและการทำ Migration Checklist (MIGRATION_SAFETY.md)
*(Database Safety, Backup, & Rollback Protocol)*

เอกสารนี้คือกฎเหล็กและคู่มือสำหรับทีมพัฒนา (และ AI Agent) เพื่อควบคุมความปลอดภัยของระบบฐานข้อมูล PostgreSQL (Prisma) ป้องกันปัญหาระบบหยุดทำงาน (Downtime) และความพินาศของข้อมูล (Data Loss) ในระหว่างการทำ Database Migration 

---

## 📋 1. Checklist การวิเคราะห์ความเสี่ยงการเปลี่ยนโครงสร้าง (Migration Risk Checklist)

ก่อนจะรันคำสั่ง Migration ทุกครั้ง ต้องตอบคำถามเหล่านี้ให้ครบถ้วน:

- [ ] **มีการลบตาราง (DROP TABLE) หรือไม่?**
  - *หากใช่:* ต้องย้ายข้อมูล (Data Migration) ที่สำคัญออกไปสำรองไว้ก่อนเสมอ
- [ ] **มีการลบหรือเปลี่ยนชื่อฟิลด์ (DROP COLUMN / RENAME COLUMN) หรือไม่?**
  - *หากใช่:* ห้ามใช้วิธี Migrate ตรงๆ เพราะข้อมูลจะหายไปทันที ให้ใช้กลยุทธ์ **"Expand and Contract"** (สร้างฟิลด์ใหม่ -> ย้ายข้อมูลเก่ามาฟิลด์ใหม่ -> ชี้แอปมาที่ฟิลด์ใหม่ -> แล้วจึงตามลบฟิลด์เก่าออกในภายหลัง)
- [ ] **มีการเปลี่ยนชนิดข้อมูล (ALTER COLUMN TYPE) หรือไม่?**
  - *หากใช่:* ตรวจสอบว่าประเภทใหม่สามารถแปลงค่า (Cast) จากค่าเก่าได้โดยไม่เกิด Exception หรือไม่ (เช่น จาก `String` ไป `Int` ถ้ามีข้อความในระบบเก่า คำสั่งรันจะล้มเหลว)
- [ ] **มีการตั้งเงื่อนไขห้ามเป็นค่าว่าง (NOT NULL Constraint) กับฟิลด์เดิมที่มีอยู่หรือไม่?**
  - *หากใช่:* ในตารางที่มีข้อมูลอยู่แล้ว คำสั่งจะ Error เพราะ Prisma ไม่สามารถสร้างเงื่อนไข `NOT NULL` บนตารางที่ช่องนั้นเป็น NULL ได้ ทางแก้คือต้องกำหนดค่า Default เสมอ หรือกรอกข้อมูล Default (Data Fill) ก่อนเริ่ม Migrate

---

## 🛠️ 2. ขั้นตอนการตรวจสอบความปลอดภัยด้วย `prisma migrate diff`

ก่อนจะสร้างไฟล์ migration จริง ให้ทำการรันคำสั่งเพื่อเปรียบเทียบการเปลี่ยนแปลง (Diff) และมองหารอยรั่วที่ก่อให้เกิดความเสียหายกับข้อมูล:

### สเต็ปที่ 1: ตรวจสอบความปลอดภัยระดับ SQL (Dry-run Check)
รันคำสั่งเปรียบเทียบ Schema ปัจจุบันกับ Schema ใหม่ เพื่อดูคำสั่ง SQL ที่เกิดขึ้นแบบ Preview:
```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```
*คำสั่งนี้จะพิมพ์คำสั่ง SQL ทั้งหมดที่จะรันออกมาให้เราตรวจเช็ค เช่น หากเห็นข้อความ `DROP COLUMN` หรือ `DROP TABLE` ให้หยุดทำรายการทันทีและประเมินระบบใหม่*

### สเต็ปที่ 2: การสร้าง Migration แบบดึงย้อนกลับได้ (Rollback Migration)
หากตรวจเช็ค SQL แล้วพบว่าปลอดภัย ให้ทำตามขั้นตอนนี้:
1. สร้างไฟล์ Migration เก็บไว้ในโฟลเดอร์โดยยังไม่รันจริง:
   ```bash
   npx prisma migrate dev --create-only --name add_amss_credentials
   ```
2. ตรวจสอบไฟล์ `.sql` ที่อยู่ในโฟลเดอร์ `prisma/migrations/...` ที่เกิดขึ้นใหม่ด้วยตาคนอีกครั้ง
3. นำคำสั่งไปติดตั้งจริงบน Database:
   ```bash
   npx prisma migrate dev
   ```

---

## 🚨 3. แผนเผชิญเหตุฉุกเฉินและการกู้คืนข้อมูล (Backup & Rollback Plan)

### การสำรองข้อมูล (Backup)
ก่อนกดเริ่มกระบวนการ Migrate บน Production ทุกครั้ง:
1. **Manual Snapshot:** เข้าไปกดคำสั่ง Backup หรือสร้าง Snapshot บน Neon PostgreSQL Dashboard เพื่อมีจุดเซฟหลัก (Restore Point) ล่าสุด
2. **Data Export:** ดึงข้อมูลตารางสำคัญ (เช่น User, LeaveRequest) ออกมาในรูปแบบ JSON หรือ CSV สำรองไว้ผ่าน CLI หรือ Script

### แผนการกู้คืนระบบ (Rollback)
หากการทำ Migration เกิดขัดข้องระหว่างทางจนแอปพลิเคชันพัง:
1. **ฝั่ง Code:** ทำการ Rollback หรือ Git Revert โค้ด Next.js กลับไปที่ Commit ก่อนหน้าเพื่อตัดปัญหาระบบขัดข้องระดับ UI
2. **ฝั่ง Database:** 
   - หากความพังเป็นระดับข้อมูลสูญหาย (Data Corruption): ให้ทำการกู้คืนจาก **Neon Restore Point** ที่สร้างไว้ก่อนรัน Migration ทันที
   - หากระบบล้มเหลวเพราะ State ค้าง: ให้เข้าสู่ Neon Dashboard และทำการชี้ระบบ (Switch branch/Restore) กลับมายังฐานข้อมูลที่ปลอดภัย
