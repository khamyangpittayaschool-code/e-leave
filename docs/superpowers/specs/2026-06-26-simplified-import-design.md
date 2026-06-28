# Design Spec - Simplified Leave Import & Excel Export Removal

This specification details the changes to simplify the leave import process, support signatures for various final approvers (Director, Deputy Director, or Acting Director), and remove the Excel export option in favor of JSON and CSV exports.

---

## 1. Requirements

### 1.1 Simplified Import Template
We need to support importing leave requests from a simplified Excel or CSV format with the following fields:
1. **Username (ไอดีเข้าใช้งาน)**: The employee's login ID (e.g. `1002`). Can also match by email or DB ID.
2. **Start Date (วันที่เริ่ม)**: Date format `YYYY-MM-DD`.
3. **End Date (วันที่สิ้นสุด)**: Date format `YYYY-MM-DD`.
4. **Leave Type (ประเภทการลา)**: e.g. `SICK`, `PERSONAL`, `VACATION`, or Thai equivalent like `ลาป่วย`, `ลากิจ`.
5. **Leave Status (สถานะการลา)**: e.g. `APPROVED`, `REJECTED`, or Thai equivalent.
6. **Final Approver (ไอดีผู้อนุมัติ)**: Optional. The login ID (e.g. `1001`) of the Director, Deputy Director, or teacher acting on their behalf who signed the form. Stored as `execApproverId`.
7. **Head Approver (ไอดีผู้ตรวจสอบ)**: Optional. The login ID (e.g. `1005`) of the inspector or Department Head. Stored as `headApproverId`.
8. **Reason (เหตุผล)**: Optional. Defaults to `"นำเข้าข้อมูลเข้าระบบ"`.

### 1.2 UI References & Helpers
- Provide a downloadable CSV template with headers and mock rows.
- Provide a searchable reference modal showing:
  - List of active users with their `ไอดีเข้าใช้งาน (Username)`, `ชื่อ-นามสกุล`, and `ตำแหน่ง` for easy copy-pasting.
  - Valid Leave Type codes (e.g. `SICK`, `PERSONAL`).
  - Valid Leave Status codes (e.g. `APPROVED`, `REJECTED`).

### 1.3 Excel Export Removal
- Remove Excel export (`handleExportLeaveExcel` button and client-side logic) to avoid issues with library-specific character limits, leaving only JSON and CSV exports.

---

## 2. Technical Architecture

### 2.1 Backend Server Action (`src/app/actions/archive.ts`)
We will expose a new server action:
```typescript
export async function importLeaveSimple(
  records: SimpleImportRecord[],
  mode: "merge" | "replace"
): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
}>
```

**Workflow**:
1. Validate admin session.
2. Load all existing users from the database.
3. If `mode === "replace"`, delete all existing leave requests within the current fiscal year's leave cycle.
4. Iterate through `records`:
   - Resolve the applicant using `username`, `email`, or `id`.
   - Resolve `finalApproverUsername` (if provided) to set `execApproverId`.
   - Resolve `headApproverUsername` (if provided) to set `headApproverId`.
   - Map leave types and statuses to their uppercase codes with fallback handling.
   - If `mode === "merge"`, skip records with matching `userId`, `type`, `startDate`, and `endDate`.
   - Create `LeaveRequest` database records.
5. Call `ensureSequencesPopulated()` from `leave.ts` to assign serial numbers.

### 2.2 Frontend Integration (`src/app/(app)/settings/page.tsx`)
- Update `handleImportLeave` file input handler:
  - If a spreadsheet/CSV is uploaded, parse it.
  - Dynamically match column headers using regex (supporting both Thai and English variants).
  - Map row objects to `SimpleImportRecord` objects and call `importLeaveSimple`.
- Render a downloadable CSV template.
- Add a overlay modal triggered by a **"ดูตารางอ้างอิงข้อมูล"** button.

---

## 3. Verification Plan
- Run local compilation test `npx tsc --noEmit`.
- Run Vercel build and deploy.
