# Simplified Leave Import & Excel Export Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the leave request import process by supporting User ID (username) lookups and optional final executive/head approver IDs, provide an overlay reference modal and a downloadable template in the UI, and remove Excel export in favor of CSV and JSON exports.

**Architecture:** We will create a new server action `importLeaveSimple` in `archive.ts` that handles user ID mapping, status mapping, and approval signature associations. We will update the settings page UI to download a dynamic template, provide a searchable modal list of references, adapt the parser to support the simplified headers, and remove the Excel export button.

**Tech Stack:** React, Next.js, Prisma, PostgreSQL, XLSX library, Tailwind CSS, Lucide Icons.

## Global Constraints
- Database connections must follow Prisma Client conventions.
- All strings in the UI must remain localized and bilingual (Thai/English) based on the `lang` state.
- Exclude `scratch` folder from all TypeScript builds.

---

### Task 1: Create Backend `importLeaveSimple` server action

**Files:**
- Modify: `src/app/actions/archive.ts`
- Test: Write a temporary scratch script `scratch/test_import_simple.ts` to test the action

**Interfaces:**
- Produces: `importLeaveSimple(records: SimpleImportRecord[], mode: "merge" | "replace")`
  where `SimpleImportRecord` is:
  ```typescript
  export interface SimpleImportRecord {
    username: string;
    startDate: string;
    endDate: string;
    type: string;
    status: string;
    finalApproverUsername?: string;
    headApproverUsername?: string;
    reason?: string;
  }
  ```

- [ ] **Step 1: Define `importLeaveSimple` server action in `src/app/actions/archive.ts`**
  Add the helper `getFiscalYear` and the `importLeaveSimple` server action:
  ```typescript
  function getFiscalYear(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0 = Jan, 9 = Oct
    return (month >= 9 ? year + 1 : year) + 543;
  }

  export async function importLeaveSimple(records: any[], mode: "merge" | "replace" = "merge") {
    const session = await requirePrivilegedLeaveBackup();
    
    // Load all active users to create lookups
    const existingUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, username: true }
    });

    const { getCurrentLeaveCycle } = await import("@/lib/cycle");
    const cycle = getCurrentLeaveCycle();

    // If replace mode, delete existing requests in this cycle
    if (mode === "replace") {
      await prisma.leaveRequest.deleteMany({
        where: {
          startDate: { gte: cycle.start, lte: cycle.end }
        }
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Load leave configurations for type matching
    const leaveConfigs = await prisma.leaveConfig.findMany();
    const typeMap: Record<string, string> = {};
    leaveConfigs.forEach((c) => {
      typeMap[c.name.trim()] = c.type;
    });

    for (const record of records) {
      if (!record.username || !record.startDate || !record.endDate || !record.type) {
        skipped++;
        errors.push("ข้อมูลไม่ครบถ้วน (ต้องระบุ Username, วันที่เริ่ม, วันที่สิ้นสุด, ประเภทการลา)");
        continue;
      }

      // Find applicant
      const matchedUser = existingUsers.find(u => 
        u.username?.toLowerCase() === String(record.username).trim().toLowerCase() ||
        u.email.toLowerCase() === String(record.username).trim().toLowerCase() ||
        u.id === String(record.username).trim()
      );

      if (!matchedUser) {
        skipped++;
        errors.push(`ไม่พบผู้ใช้งานไอดี: ${record.username}`);
        continue;
      }

      // Map leave type
      let mappedType = String(record.type).trim();
      if (typeMap[mappedType]) {
        mappedType = typeMap[mappedType];
      } else {
        const typeUpper = mappedType.toUpperCase();
        if (["SICK", "PERSONAL", "VACATION", "MATERNITY", "ORDINATION", "MILITARY", "STUDY"].includes(typeUpper)) {
          mappedType = typeUpper;
        } else if (mappedType.includes("ป่วย") || typeUpper.includes("SICK")) {
          mappedType = "SICK";
        } else if (mappedType.includes("กิจ") || typeUpper.includes("PERSONAL")) {
          mappedType = "PERSONAL";
        } else if (mappedType.includes("พัก") || typeUpper.includes("VACATION") || mappedType.includes("ร้อน")) {
          mappedType = "VACATION";
        } else {
          skipped++;
          errors.push(`ประเภทการลาไม่ถูกต้อง: ${record.type} (ผู้ใช้: ${matchedUser.name})`);
          continue;
        }
      }

      // Map status
      let mappedStatus = "APPROVED";
      const s = String(record.status || "APPROVED").trim().toUpperCase();
      if (["APPROVED", "REJECTED", "CANCELLED", "PENDING_HEAD", "PENDING_EXEC"].includes(s)) {
        mappedStatus = s;
      } else {
        if (s.includes("อนุมัติ") && !s.includes("รอ") && !s.includes("ไม่")) {
          mappedStatus = "APPROVED";
        } else if (s.includes("ปฏิเสธ") || s.includes("ไม่อนุมัติ") || s.includes("REJECT")) {
          mappedStatus = "REJECTED";
        } else if (s.includes("ยกเลิก") || s.includes("CANCEL")) {
          mappedStatus = "CANCELLED";
        } else if (s.includes("รอหัวหน้า") || s.includes("PENDING_HEAD")) {
          mappedStatus = "PENDING_HEAD";
        } else if (s.includes("รอผู้บริหาร") || s.includes("PENDING_EXEC")) {
          mappedStatus = "PENDING_EXEC";
        }
      }

      // Resolve final executive approver (e.g. Director)
      let execApproverId = null;
      if (record.finalApproverUsername) {
        const approver = existingUsers.find(u => 
          u.username?.toLowerCase() === String(record.finalApproverUsername).trim().toLowerCase() ||
          u.email.toLowerCase() === String(record.finalApproverUsername).trim().toLowerCase() ||
          u.id === String(record.finalApproverUsername).trim()
        );
        if (approver) {
          execApproverId = approver.id;
        }
      }

      // Resolve department head/inspector approver
      let headApproverId = null;
      if (record.headApproverUsername) {
        const approver = existingUsers.find(u => 
          u.username?.toLowerCase() === String(record.headApproverUsername).trim().toLowerCase() ||
          u.email.toLowerCase() === String(record.headApproverUsername).trim().toLowerCase() ||
          u.id === String(record.headApproverUsername).trim()
        );
        if (approver) {
          headApproverId = approver.id;
        }
      }

      // Check duplicate in merge mode
      if (mode === "merge") {
        const existing = await prisma.leaveRequest.findFirst({
          where: {
            userId: matchedUser.id,
            type: mappedType,
            startDate: new Date(record.startDate),
            endDate: new Date(record.endDate),
          }
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      try {
        const startD = new Date(record.startDate);
        const endD = new Date(record.endDate);
        const fy = getFiscalYear(startD);

        await prisma.leaveRequest.create({
          data: {
            userId: matchedUser.id,
            type: mappedType,
            startDate: startD,
            endDate: endD,
            reason: record.reason || "นำเข้าข้อมูลเข้าระบบ",
            status: mappedStatus,
            execApproverId,
            headApproverId,
            fiscalYear: fy,
          }
        });
        imported++;
      } catch (err: any) {
        skipped++;
        errors.push(`เกิดข้อผิดพลาดในการนำเข้ารายการ (ผู้ใช้: ${matchedUser.name}): ${err.message}`);
      }
    }

    // Backfill sequence counters
    const { ensureSequencesPopulated } = await import("./leave");
    await ensureSequencesPopulated();

    await prisma.systemLog.create({
      data: {
        actionType: "IMPORT_LEAVE_SIMPLE",
        description: `นำเข้าข้อมูลการลาอย่างง่าย: สำเร็จ ${imported} รายการ, ข้าม ${skipped} รายการ`,
        userId: session.user.id
      }
    });

    return {
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10),
      total: records.length
    };
  }
  ```

- [ ] **Step 2: Commit backend action**
  Run git commit:
  `git add src/app/actions/archive.ts`
  `git commit -m "feat: add importLeaveSimple server action"`

---

### Task 2: Remove Excel Export and Add CSV Template Download

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Remove `handleExportLeaveExcel` function and button**
  Locate `handleExportLeaveExcel` function (around line 359-421) and remove it.
  Locate Excel button rendering in JSX (around line 1374-1389) and remove it.
  Change layout `grid-cols-3` (line 1356) to `grid-cols-2`.
  Update settings description (line 1350-1351) to only mention JSON/CSV.

- [ ] **Step 2: Implement CSV Template Download**
  Add the template download function inside `settings/page.tsx`:
  ```typescript
  const handleDownloadCSVTemplate = () => {
    const headers = "Username,StartDate,EndDate,LeaveType,LeaveStatus,FinalApproverUsername,HeadApproverUsername,Reason";
    const sampleRow1 = "\n1002,2026-07-01,2026-07-03,SICK,APPROVED,1001,,ลารักษาอาการไข้หวัดใหญ่";
    const sampleRow2 = "\n1003,2026-07-10,2026-07-10,PERSONAL,APPROVED,1001,1005,ทำธุระติดต่อราชการเรื่องบ้าน";
    const csvContent = "\uFEFF" + headers + sampleRow1 + sampleRow2;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eleave_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  ```
  Add a button for template download in the UI right next to the import upload panel.

---

### Task 3: Implement Searchable Reference List Modal

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Declare state and users state**
  Add states:
  ```typescript
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [refModalTab, setRefModalTab] = useState<"users" | "types" | "statuses">("users");
  ```
  Load users inside settings page load:
  Add a server action or call `prisma` directly? No, `settings/page.tsx` is a client component (`"use client"`). We should create a server action `getAllUsersRef()` in `src/app/actions/settings.ts` or `src/app/actions/admin.ts` to return lightweight user details (Username, Name, Position).
  Wait! Let's check `admin.ts` to see if there is already an action we can use to fetch users, or create a small one:
  ```typescript
  // In settings.ts or admin.ts
  export async function getSimpleUsersList() {
    await requireHROrAdmin();
    return prisma.user.findMany({
      select: { username: true, name: true, position: true },
      orderBy: { username: "asc" }
    });
  }
  ```
  Let's add this function to `src/app/actions/settings.ts` (so we can import it).
  Then load it on modal open.

- [ ] **Step 2: Add Reference Modal UI markup**
  Render the overlay modal when `isRefModalOpen` is true.

---

### Task 4: Update `handleImportLeave` file input parser

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Update `handleImportLeave`**
  Modify it to parse CSV or Excel rows using the flexible column mapping:
  ```typescript
  // Mapped rows construction
  const mappedRequests = rawRows.map((row: any) => {
    let username = "";
    let startDate = "";
    let endDate = "";
    let type = "";
    let status = "";
    let finalApproverUsername = "";
    let headApproverUsername = "";
    let reason = "";

    Object.entries(row).forEach(([key, val]) => {
      const k = key.trim().toLowerCase();
      const v = val !== undefined && val !== null ? String(val).trim() : "";
      if (!v) return;

      if (k === "username" || k === "userid" || k === "user_id" || k.includes("ไอดีผู้ใช้") || k.includes("ไอดีเข้าใช้งาน") || k === "email" || k.includes("อีเมล")) {
        username = v;
      } else if (k.includes("start") || k.includes("เริ่ม") || k.includes("วันที่เริ่ม")) {
        startDate = String(val);
      } else if (k.includes("end") || k.includes("สิ้นสุด") || k.includes("ถึงวันที่")) {
        endDate = String(val);
      } else if (k.includes("type") || k.includes("ประเภท")) {
        type = v;
      } else if (k.includes("status") || k.includes("สถานะ")) {
        status = v;
      } else if (k.includes("final") || k.includes("director") || k.includes("ผู้อนุมัติ") || k.includes("ผอ")) {
        finalApproverUsername = v;
      } else if (k.includes("head") || k.includes("inspector") || k.includes("ผู้ตรวจสอบ") || k.includes("หัวหน้า")) {
        headApproverUsername = v;
      } else if (k.includes("reason") || k.includes("เหตุผล")) {
        reason = v;
      }
    });

    return {
      username,
      startDate,
      endDate,
      type,
      status,
      finalApproverUsername,
      headApproverUsername,
      reason
    };
  });
  ```
  Then call:
  `const result = await importLeaveSimple(validRequests, importLeaveMode);`

---

### Task 5: Build Verification and Deploy

- [ ] **Step 1: Run TypeScript validation**
  Run command: `npx tsc --noEmit` in `C:\temp-eleave-build` after copying updated files
- [ ] **Step 2: Vercel Deploy**
  Run command: `npx vercel deploy --prod --yes` in project directory
