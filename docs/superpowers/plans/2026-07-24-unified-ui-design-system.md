# Unified UI Design System & Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standardized, reusable UI component library (`PageHeader`, `StatCard`, `TableSkeleton`, `CardSkeleton`, `EmptyState`) in `src/components/ui/` and apply it across all main subsystems (Leave, Repair, Attendance, Document) to achieve a unified, ultra-premium design language with responsive layouts and smooth micro-animations.

**Architecture:** Build modular, accessible UI primitives styled with Tailwind CSS, Framer Motion, and Lucide React icons. Replace ad-hoc header banners and skeleton implementations across `/history`, `/repair`, `/attendance`, and `/document` with these centralized components.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, Framer Motion, Lucide React icons, TypeScript.

## Global Constraints

- Must follow the established glassmorphic design language (`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-800`).
- Must support light mode and dark mode natively.
- Must be fully responsive across mobile (375px+), tablet, and desktop viewports.
- Must preserve 100% of existing functional capabilities and data fetching.

---

### Task 1: Create Centralized Shared UI Components (`src/components/ui/`)

**Files:**
- Create: `src/components/ui/page-header.tsx`
- Create: `src/components/ui/stat-card.tsx`
- Create: `src/components/ui/skeletons.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Test: `src/components/ui/__tests__/components.test.tsx`

**Interfaces:**
- Consumes: Tailwind CSS, Framer Motion, Lucide icons
- Produces: `PageHeader`, `StatCard`, `TableSkeleton`, `CardSkeleton`, `EmptyState` primitives.

- [ ] **Step 1: Write test for shared UI components**

```typescript
// src/components/ui/__tests__/components.test.tsx
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../page-header";
import { StatCard } from "../stat-card";

describe("Shared UI Components", () => {
  it("renders PageHeader title and description", () => {
    render(<PageHeader title="ประวัติการลา" description="รายการใบลาทั้งหมดของคุณ" />);
    expect(screen.getByText("ประวัติการลา")).toBeInTheDocument();
    expect(screen.getByText("รายการใบลาทั้งหมดของคุณ")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ui/__tests__/components.test.tsx`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `page-header.tsx`, `stat-card.tsx`, `skeletons.tsx`, and `empty-state.tsx`**

```tsx
// src/components/ui/page-header.tsx
"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
  badge?: string;
  icon?: LucideIcon;
  gradient?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  badge,
  icon: Icon,
  gradient = "from-indigo-600 to-purple-600",
  action,
}: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
      {/* Background ambient glow */}
      <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-3xl pointer-events-none`} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 mt-0.5`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div>
            {badge && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 mb-2">
                {badge}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
```

```tsx
// src/components/ui/stat-card.tsx
"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  gradient?: string;
  subtext?: string;
  delay?: number;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  gradient = "bg-indigo-500",
  subtext,
  delay = 0,
  onClick,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${
        onClick ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all" : ""
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${gradient} bg-opacity-15 text-slate-900 dark:text-white`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {subtext && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtext}</p>}
    </motion.div>
  );
}
```

```tsx
// src/components/ui/skeletons.tsx
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl w-1/4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-50 dark:bg-slate-800/50 rounded-xl w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
```

```tsx
// src/components/ui/empty-state.tsx
"use client";

import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 my-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/page-header.tsx src/components/ui/stat-card.tsx src/components/ui/skeletons.tsx src/components/ui/empty-state.tsx
git commit -m "feat(ui): create reusable PageHeader, StatCard, TableSkeleton, and EmptyState primitives"
```

---

### Task 2: Refactor Leave System (`/history`) to Use Shared UI Components

**Files:**
- Modify: `src/app/(app)/history/page.tsx`

- [ ] **Step 1: Integrate `PageHeader`, `StatCard`, and `TableSkeleton` into `HistoryPage`**

Replace custom header banners and skeleton loaders in `src/app/(app)/history/page.tsx` with standard `PageHeader` and `TableSkeleton`.

- [ ] **Step 2: Test TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/history/page.tsx
git commit -m "refactor(history): standardize leave history page using shared UI primitives"
```

---

### Task 3: Refactor Repair System (`/repair`) to Use Shared UI Components

**Files:**
- Modify: `src/app/(app)/repair/_components/RepairListPage.tsx`

- [ ] **Step 1: Integrate `PageHeader`, `StatCard`, and `TableSkeleton` into `RepairListPage`**

Update `RepairListPage.tsx` to consume the standard `PageHeader` and `StatCard` primitives.

- [ ] **Step 2: Test TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/repair/_components/RepairListPage.tsx
git commit -m "refactor(repair): standardize repair list page using shared UI primitives"
```

---

### Task 4: Refactor Attendance System (`/attendance`) to Use Shared UI Components

**Files:**
- Modify: `src/app/(app)/attendance/page.tsx`

- [ ] **Step 1: Integrate `PageHeader` and `StatCard` into `AttendancePage`**

Update `AttendancePage` header and summary cards to use `PageHeader` and `StatCard`.

- [ ] **Step 2: Test TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/attendance/page.tsx
git commit -m "refactor(attendance): standardize attendance page using shared UI primitives"
```

---

### Task 5: Refactor Document System (`/document`) to Use Shared UI Components

**Files:**
- Modify: `src/app/(app)/document/page.tsx`

- [ ] **Step 1: Integrate `PageHeader` and `StatCard` into `DocumentPage`**

Update `DocumentPage` header and stat cards to use `PageHeader` and `StatCard`.

- [ ] **Step 2: Test TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/document/page.tsx
git commit -m "refactor(document): standardize document page using shared UI primitives"
```

---

### Task 6: Full Verification & Vercel Production Build

- [ ] **Step 1: Run `npx tsc --noEmit`**
- [ ] **Step 2: Run `git push origin main` and check Vercel build status**
