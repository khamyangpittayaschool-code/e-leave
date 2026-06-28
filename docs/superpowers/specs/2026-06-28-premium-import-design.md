# Design Spec: Premium Leave Import Wizard

## Goal
To elevate the leave import functionality into a premium, SaaS-like administrative interface. The new interface will allow administrators to safely drag-and-drop spreadsheets/JSON files, preview and validate the rows locally against database usernames/types, download detailed error reports, inspect historical imports, and perform instant bulk undos of the last import batch.

---

## 1. User Interface Design

### 1.1 Drag & Drop Zone
- **UI State**: Dashed border using CSS transitions.
- **Normal State**: Purple border (`border-purple-200`), background `bg-purple-50/10` with upload cloud icon.
- **Active Drag Over State**: Border turns solid deep purple (`border-purple-500`), background darkens slightly (`bg-purple-50/30`), scaling icon up.
- **Accepted Files**: `.json`, `.csv`, `.xlsx`, `.xls`.

### 1.2 Interactive Preview Panel
- **Summary Banner**: Displays statistics of the uploaded file.
  - "พบข้อมูล {total} รายการ: ✓ ถูกต้อง {valid} รายการ, ⚠ ต้องตรวจสอบ {invalid} รายการ"
- **Preview Table**: Columnar preview of the first 5-10 rows showing:
  - User ID / Name (with check/cross icon)
  - Leave Type
  - Leave Period (Formatted Dates)
  - Leave Status
  - Validation Message (e.g., "ไม่พบผู้ใช้ในระบบ", "ประเภทการลาไม่ถูกต้อง")
- **Control Bar**:
  - `[ ยืนยันนำเข้าข้อมูล ({valid} รายการ) ]` (Confirm button - disabled if `valid === 0`).
  - `[ ดาวน์โหลดรายการที่ผิดพลาด ]` (Error report CSV download button - only shown if `invalid > 0`).
  - `[ ยกเลิก ]` (Cancel button - resets parser and file selection).

### 1.3 Post-Import Summary Dashboard
- After import completes, show:
  - Successfully imported: `Y`
  - Skipped (already exists): `Z`
  - Failed (database write error): `W`
  - Total records processed: `total`
- Provides button to close or download the import log.

### 1.4 Premium Undo Import
- If an import batch succeeded, display a top floating toast/banner:
  - "นำเข้าสำเร็จ {importedCount} รายการ [ ย้อนกลับการนำเข้าครั้งนี้ (Undo) ]"
- Valid for the duration of the current admin session, or until a page refresh.
- Performs a batch delete of the newly created leave requests.

### 1.5 Import History Panel
- Displays the last 10 import actions recorded in `SystemLog` table.
- Shows timestamp, filename, imported count, skipped count, and admin user who initiated it.

---

## 2. Technical Components & Interfaces

### 2.1 State Declarations (Client Component)
- `importStage`: `"idle" | "preview" | "summary"`
- `parsedRecords`: `ParsedRecord[]` (all rows loaded from spreadsheet)
- `validRecords`: `ParsedRecord[]` (rows matching system lookups)
- `invalidRecords`: `ParsedRecord[]` (rows with errors)
- `lastImportedIds`: `string[]` (CUIDs of created LeaveRequests for Undo action)
- `isRefModalOpen`: `boolean` (Reference modal)
- `importHistory`: `SystemLog[]` (History list)

### 2.2 Server Action updates

#### `importLeaveSimple(records: SimpleImportRecord[], mode: "merge" | "replace")`
- Modified to return the list of database IDs (`id`) of all newly created `LeaveRequest` records:
  ```typescript
  return {
    success: true,
    imported,
    skipped,
    createdIds: string[], // list of LeaveRequest CUIDs
    errors: string[],
    total: records.length
  };
  ```

#### `undoImportLeave(ids: string[])` [NEW]
- Verifies admin/HR role.
- Performs `deleteMany` on `LeaveRequest` where `id` is in the `ids` list.
- Creates a `SystemLog` entry: `actionType: "UNDO_IMPORT_LEAVE"`, `description: "ย้อนกลับการนำเข้าข้อมูลการลาจำนวน X รายการ"`.

#### `getImportHistory()` [NEW]
- Fetches recent system logs with `actionType === "IMPORT_LEAVE_SIMPLE"` or `"IMPORT_LEAVE_BACKUP"`.

---

## 3. Data Integrity & Validation Rules
- **Username Resolution**: Must resolve to a valid `User.id` via username or email matching.
- **Leave Type Resolution**: Matches Thai names (e.g., "ลาป่วย") or English codes (e.g., "SICK").
- **Fiscal Year Mapping**: Matches date automatically to the Thai fiscal year (Gregorian year + 543 if month >= October).
- **Transaction Safety**: Checks duplicates during merge mode. In replace mode, clears current cycle first.
