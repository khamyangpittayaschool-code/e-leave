# 📜 คัมภีร์มาตรฐานการจัดการความผิดพลาด: ERROR_TAXONOMY.md
*(Project Error Handling Standards for eLeave Monolith)*

เอกสารนี้คือกฎเหล็กและมาตรฐานสถาปัตยกรรม (Architectural Blueprint) ในการจัดการความผิดพลาด (Exceptions & Errors) สำหรับโปรเจกต์ eLeave เพื่อป้องกันปัญหา **Pattern Contagion** และทำให้ระบบย่อยสามารถแยกส่วนการพังได้อย่างสมบูรณ์ (Fault Isolation)

---

## 1. มาตรฐานการส่งกลับของ Server Actions (ActionResponse Shape)

เพื่อป้องกันการ Crash ของฝั่ง Client Component ทุก Server Action ใน `src/app/actions/...` ต้องคืนค่าในรูปแบบ Object มาตรฐานที่มีโครงสร้างแน่นอนดังนี้:

```typescript
export type ActionResponse<T = any> = 
  | {
      success: true;
      data: T;
      message?: string;
    }
  | {
      success: false;
      error: string;        // ข้อความภาษาไทยที่เป็นมิตรกับผู้ใช้ (User-friendly message)
      code: ErrorCode;      // รหัสข้อผิดพลาดเพื่อความสะดวกในการจัดการฝั่ง Client
      technicalDetails?: string; // รายละเอียดเชิงเทคนิค (ใช้เฉพาะการ Debug/Log เท่านั้น ห้ามแสดงผลตรงๆ)
    };

export type ErrorCode =
  | "UNAUTHORIZED"          // ไม่ได้เข้าสู่ระบบ หรือ Session หมดอายุ
  | "FORBIDDEN"             // สิทธิ์การเข้าใช้งานไม่ถึง (เช่น ไม่ใช่ Admin)
  | "VALIDATION_ERROR"      // ข้อมูลนำเข้าไม่ถูกต้อง (เช่น เบอร์โทรศัพท์ผิด, ใส่ข้อมูลไม่ครบ)
  | "DATABASE_ERROR"        // เกิดข้อผิดพลาดฝั่ง Database (เช่น Connection Fail, Constraint)
  | "EXTERNAL_API_ERROR"    // เชื่อมต่อ AMSS++ หรือ API ภายนอกล้มเหลว
  | "UNKNOWN_ERROR";        // ข้อผิดพลาดที่ไม่คาดคิดอื่นๆ
```

### 🚨 กฎเหล็กข้อที่ 1: ห้ามยิงคำสั่ง `throw new Error()` เปล่าๆ ออกนอก Server Action
ทุก Server Action ต้องถูกครอบด้วยบล็อก `try-catch` เสมอ และหากเกิดความผิดพลาด ให้ส่งกลับเป็น `{ success: false, error: "...", code: "..." }` แทนการปล่อยให้ Exception หลุดลอยไปสร้างหน้าจอสีขาว (White Screen) บนฝั่งไคลเอนต์

---

## 2. วิธีการจัดการในแต่ละกรณี (Error Classification)

### A. ข้อมูลนำเข้าผิดพลาด (VALIDATION_ERROR)
- **การตรวจจับ:** ใช้ Zod หรือการตรวจสอบสิทธิ์เบื้องต้น
- **สิ่งที่ต้องส่งกลับ:**
  ```json
  {
    "success": false,
    "code": "VALIDATION_ERROR",
    "error": "กรุณากรอกข้อมูลวันลาให้ถูกต้องและครบถ้วน"
  }
  ```

### B. สิทธิ์การใช้งาน (UNAUTHORIZED / FORBIDDEN)
- **การตรวจจับ:** ใช้ `auth.api.useSession` หรือเช็ค Session จาก Better-Auth ก่อนดำเนินการ
- **สิ่งที่ต้องส่งกลับ:**
  ```json
  {
    "success": false,
    "code": "UNAUTHORIZED",
    "error": "กรุณาเข้าสู่ระบบก่อนทำรายการนี้"
  }
  ```

### C. ฐานข้อมูลผิดพลาด (DATABASE_ERROR)
- **การตรวจจับ:** ครอบคำสั่งของ Prisma ด้วย `try-catch`
- **การบันทึก Log:** บันทึกข้อมูล Prisma Error ทั้งหมดลงในเซิร์ฟเวอร์ Log
- **ข้อควรระวัง:** **ห้ามส่งข้อมูล Error ดิบจาก Prisma ไปที่ผู้ใช้เด็ดขาด** (เช่น ห้ามส่ง `PrismaClientKnownRequestError` หรือคอลัมน์ชื่อตารางที่ล้มเหลวออกไปทาง Client เพราะเป็นช่องโหว่ความปลอดภัย)
- **สิ่งที่ต้องส่งกลับ:**
  ```json
  {
    "success": false,
    "code": "DATABASE_ERROR",
    "error": "ระบบฐานข้อมูลขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"
  }
  ```

### D. ระบบภายนอกล้มเหลว (EXTERNAL_API_ERROR) เช่น AMSS++
- **การตรวจจับ:** ครอบกระบวนการ `axios` หรือ `fetch` ที่ยิงหา `amss.sesaud.go.th`
- **การแก้ปัญหาอัตโนมัติ (Retry):**
  - กำหนดค่า Timeout ชัดเจน (สูงสุดไม่เกิน 10 วินาที)
  - ทำการ Retry อัตโนมัติในฝั่งหลังบ้านสูงสุด 2 ครั้ง หากเชื่อมต่อไม่สำเร็จจริงๆ ให้ส่ง Error กลับ
- **สิ่งที่ต้องส่งกลับ:**
  ```json
  {
    "success": false,
    "code": "EXTERNAL_API_ERROR",
    "error": "ไม่สามารถเชื่อมต่อกับระบบ AMSS++ สพม.อุดรธานี ได้ในขณะนี้ กรุณาตรวจสอบสถานะเว็บปลายทาง"
  }
  ```

---

## 3. มาตรฐานการแสดงผลฝั่ง Client (UI Error Boundaries)

1. **การดักจับ:** ใช้ไฟล์ `error.tsx` ประจำโมดูลย่อย (`attendance/error.tsx`, `document/error.tsx`)
2. **การฟื้นคืนสภาพ (Reset/Retry):**
   - หน้าจอแสดงผล Error ต้องไม่พังแถบเมนูนำทาง (Layout หลักต้องยังคงใช้งานได้)
   - หน้าจอต้องมีปุ่ม **"ลองใหม่อีกครั้ง"** ที่ไปกระตุ้นฟังก์ชัน `reset()` เพื่อขอเรนเดอร์คอมโพเนนต์ใหม่อีกครั้งโดยไม่ต้องรีเฟรชทั้งหน้าเว็บ
3. **การแสดงผลทางเทคนิค:** หากมีข้อมูล `technicalDetails` ให้แสดงผลเป็นกล่องข้อความซ่อนไว้ในปุ่มดีเทล เพื่อให้ผู้ใช้งานสามารถกดคัดลอกส่งต่อให้แอดมินช่วยแก้ปัญหาได้ง่ายขึ้น

---

## 📜 ตัวอย่างโค้ดมาตรฐาน (Standard Templates)

### ตัวอย่าง Server Action ในหลังบ้าน:
```typescript
"use server";

import { db } from "@/lib/db";
import { ActionResponse } from "@/types/actions";

export async function submitDocument(data: any): Promise<ActionResponse> {
  try {
    // 1. ตรวจสอบสิทธิ์การใช้งาน
    const session = await getSession();
    if (!session) {
      return { success: false, code: "UNAUTHORIZED", error: "สิทธิ์การเข้าใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
    }

    // 2. ดำเนินการทางธุรกิจ (Business Logic)
    const result = await db.document.create({
      data: { ...data, userId: session.user.id }
    });

    return { success: true, data: result };

  } catch (err: any) {
    // บันทึก Log เข้าระบบของเซิร์ฟเวอร์อย่างปลอดภัย
    console.error("🔒 [Error Log in submitDocument]:", err);

    return { 
      success: false, 
      code: "DATABASE_ERROR", 
      error: "บันทึกเอกสารไม่สำเร็จเนื่องจากระบบหลังบ้านขัดข้อง",
      technicalDetails: process.env.NODE_ENV === "development" ? err.message : undefined
    };
  }
}
```
