# Repair System UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and harmonize the Repair Request System UI/UX to seamlessly match the Leave Management System's modern design language (Tailwind CSS, glassmorphism, responsive cards/tables, smooth Framer Motion micro-animations, mobile-first layouts, and unified color palette across all devices).

**Architecture:** Refactor `src/app/(app)/repair/_components/` pages (`RepairListPage`, `RepairDetailPage`, `RepairNewPage`, `RepairDashboardPage`, `RepairPhotosPanel`, `RepairSummaryReportView`) to use the exact card tokens, stat badges, glassmorphic headers, responsive mobile cards / desktop table toggles, and step form layouts established in the Leave System.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, Framer Motion, Lucide React icons, Prisma ORM, Better Auth, HTML2Canvas / Browser Print.

## Global Constraints

- Must maintain full backward compatibility with all existing server actions (`src/app/actions/repair/`).
- Must adhere strictly to `hasRepairPermission` matrix (`src/lib/permissions.ts`).
- Mobile-first responsive layout (smooth collapse from desktop 1080p to iPhone/Android mobile view).
- Follow Leave System design tokens (rounded-2xl cards, font-semibold titles, HSL tailored badges, glassmorphism headers, subtle drop shadows).
- No hardcoded pixel magic offsets; use responsive flex/grid gap layouts.

---

### Task 1: Harmonies Design System & Color Tokens for Repair Module

**Files:**
- Create: `src/app/(app)/repair/_components/repair-ui-tokens.ts`
- Test: `src/app/(app)/repair/_components/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `REPAIR_STATUS_THEME`, `REPAIR_CATEGORY_THEME`, `REPAIR_URGENCY_THEME` unified design tokens.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/(app)/repair/_components/__tests__/tokens.test.ts
import { REPAIR_STATUS_THEME, REPAIR_CATEGORY_THEME } from "../repair-ui-tokens";

describe("Repair UI Tokens", () => {
  it("should provide consistent status colors matching leave design system", () => {
    expect(REPAIR_STATUS_THEME.PENDING.label).toBe("รอดำเนินการ");
    expect(REPAIR_STATUS_THEME.PENDING.badgeClass).toContain("bg-amber");
    expect(REPAIR_STATUS_THEME.COMPLETED.label).toBe("เสร็จสิ้น");
    expect(REPAIR_STATUS_THEME.COMPLETED.badgeClass).toContain("bg-emerald");
  });

  it("should provide category icons and labels", () => {
    expect(REPAIR_CATEGORY_THEME.ELECTRICAL.label).toBe("ไฟฟ้า");
    expect(REPAIR_CATEGORY_THEME.BUILDING.label).toBe("อาคาร/โครงสร้าง");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/\(app\)/repair/_components/__tests__/tokens.test.ts`
Expected: FAIL with module not found `repair-ui-tokens`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/(app)/repair/_components/repair-ui-tokens.ts
import {
  Clock, AlertCircle, Wrench, CheckCircle2, XCircle,
  Zap, Droplet, Building2, Laptop, Package, MoreHorizontal
} from "lucide-react";

export const REPAIR_STATUS_THEME = {
  PENDING: {
    label: "รอดำเนินการ",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 ring-1 ring-amber-500/20",
    icon: Clock,
  },
  ASSIGNED: {
    label: "มอบหมายช่างแล้ว",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 ring-1 ring-blue-500/20",
    icon: AlertCircle,
  },
  IN_PROGRESS: {
    label: "กำลังซ่อมแซม",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 ring-1 ring-purple-500/20",
    icon: Wrench,
  },
  COMPLETED: {
    label: "เสร็จสิ้น",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 ring-1 ring-emerald-500/20",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "ยกเลิกคำขอ",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 ring-1 ring-slate-500/20",
    icon: XCircle,
  },
};

export const REPAIR_CATEGORY_THEME = {
  ELECTRICAL: { label: "ไฟฟ้า", icon: Zap, color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10" },
  PLUMBING: { label: "ประปา", icon: Droplet, color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10" },
  BUILDING: { label: "อาคาร/โครงสร้าง", icon: Building2, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  IT: { label: "อุปกรณ์ IT", icon: Laptop, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" },
  EQUIPMENT: { label: "ครุภัณฑ์/เฟอร์นิเจอร์", icon: Package, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" },
  OTHER: { label: "อื่น ๆ", icon: MoreHorizontal, color: "text-gray-500 bg-gray-50 dark:bg-gray-800" },
};

export const REPAIR_URGENCY_THEME = {
  NORMAL: { label: "ปกติ", class: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  URGENT: { label: "เร่งด่วน", class: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 font-semibold" },
  URGENT_MOST: { label: "เร่งด่วนมาก", class: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-bold animate-pulse" },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/\(app\)/repair/_components/__tests__/tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/repair/_components/repair-ui-tokens.ts src/app/\(app\)/repair/_components/__tests__/tokens.test.ts
git commit -m "feat(repair): add unified design tokens and color scheme for repair system UI"
```

---

### Task 2: Redesign `RepairListPage` UI with Glassmorphic Hero Banner & Dual View (Cards + Table)

**Files:**
- Modify: `src/app/(app)/repair/_components/RepairListPage.tsx:1-345`

**Interfaces:**
- Consumes: `REPAIR_STATUS_THEME`, `REPAIR_CATEGORY_THEME`, `getRepairsAction`
- Produces: Enhanced responsive Repair Request list UI matching Leave System history layout.

- [ ] **Step 1: Write UI component structure enhancement**

Update `RepairListPage.tsx` to include:
- Glassmorphic top hero banner with gradient accents & quick stats counters.
- Mobile view: Touch-friendly cards with category icons, urgency pill, location, and progress bar.
- Desktop view: Styled data table with avatar badges, technician info, and status indicators.
- Quick filter tabs (ทั้งหมด / รอดำเนินการ / มอบหมายแล้ว / กำลังซ่อม / เสร็จสิ้น / ยกเลิก) + Search box.

- [ ] **Step 2: Run build test**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/repair/_components/RepairListPage.tsx
git commit -m "refactor(repair): overhaul RepairListPage UI with glassmorphic hero, mobile cards, and tab filters"
```

---

### Task 3: Redesign `RepairDetailPage` UI with Interactive Timeline & Photo Gallery

**Files:**
- Modify: `src/app/(app)/repair/_components/RepairDetailPage.tsx:1-734`

**Interfaces:**
- Consumes: `RepairRequest` data, `submitRepairRatingAction`, technician assignment actions.
- Produces: Premium detailed view with status timeline, A4 printable view preview tab, rating stars widget, and before/after photo slider.

- [ ] **Step 1: Enhance RepairDetailPage layout**

Update `RepairDetailPage.tsx` to include:
- Visual step-by-step progress timeline (ยื่นคำขอ -> มอบหมายช่าง -> กำลังซ่อม -> เสร็จสิ้น/ประเมิน).
- Tabbed interface: [รายละเอียดปัญหา] | [รูปภาพก่อน-หลังซ่อม] | [ประวัติการดำเนินการ] | [พิมพ์ใบแจ้งซ่อม A4].
- Requester rating & feedback widget for completed repairs with star rating micro-animation.
- Technician action toolbar (Start Repair, Complete with Cost/Note, Cancel).

- [ ] **Step 2: Run build test**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/repair/_components/RepairDetailPage.tsx
git commit -m "refactor(repair): modernize RepairDetailPage UI with timeline, photo gallery, and rating panel"
```

---

### Task 4: Redesign `RepairNewPage` UI with Drag-and-Drop Uploader & Progress Bar

**Files:**
- Modify: `src/app/(app)/repair/_components/RepairNewPage.tsx:1-500`

**Interfaces:**
- Consumes: `createRepairAction`, photo upload API.
- Produces: Intuitive multi-step / wizard form for submitting repair requests.

- [ ] **Step 1: Enhance RepairNewPage layout**

Update `RepairNewPage.tsx` to include:
- Visual category selector chips with icons (ไฟฟ้า, ประปา, IT, อาคาร, ครุภัณฑ์).
- Location & urgency selector cards with visual indicator tags.
- Drag-and-drop photo upload box with real-time image preview thumbnails and client-side compression progress bar.
- Auto-redirect back to `/repair` list page immediately after submission with toast notification.

- [ ] **Step 2: Run build test**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/repair/_components/RepairNewPage.tsx
git commit -m "refactor(repair): overhaul RepairNewPage UI with category chips, drag-drop uploader, and progress bar"
```

---

### Task 5: Redesign `RepairDashboardPage` UI with Analytics & SLA Metrics

**Files:**
- Modify: `src/app/(app)/repair/_components/RepairDashboardPage.tsx:1-400`

**Interfaces:**
- Consumes: `getRepairDashboardDataAction`
- Produces: Executive analytics dashboard for Repair System.

- [ ] **Step 1: Enhance RepairDashboardPage layout**

Update `RepairDashboardPage.tsx` to include:
- KPI summary cards (Total requests, Pending, In Progress, Completed, SLA Warning).
- Technician workload distribution table & completion rate stats.
- User satisfaction average star rating score card.

- [ ] **Step 2: Run build test**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/repair/_components/RepairDashboardPage.tsx
git commit -m "refactor(repair): update RepairDashboardPage with KPI metrics, SLA tracking, and rating analytics"
```

---

### Task 6: End-to-End Verification & Production Build Verification

**Files:**
- Test: All repair pages and build output.

- [ ] **Step 1: Execute full TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run Next.js production build**

Run: `npm run build`
Expected: Successfully compiled all pages (`/repair`, `/repair/new`, `/repair/[id]`, `/repair/dashboard`).

- [ ] **Step 3: Deploy & Verify on Vercel**

Run: `git push origin main` and verify Vercel deployment status.

---

## Execution Choice Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-24-repair-ui-ux-overhaul.md`.
