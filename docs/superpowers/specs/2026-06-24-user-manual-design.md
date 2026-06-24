# Design Spec: eLeave User Manual Page & Build Fix

**Date**: 2026-06-24  
**Feature**: User Manual Page (หน้าคู่มือการใช้งาน)  
**Issue Fixed**: Turbopack Build Failure (xlsx library import bug)

---

## 1. Goal Description
The purpose of this feature is to add a dedicated User Manual page within the `eLeave` Next.js application, where logged-in staff can access step-by-step instructions (tailored by user role) and download the complete user guide PDF. Additionally, this feature resolves a critical Next.js Turbopack build failure caused by a syntax typo when calling the `xlsx` library in `users/page.tsx`.

---

## 2. Requirements & UI Layout
- **Path**: `src/app/(app)/manual/page.tsx`
- **Sidebar Integration**: The sidebar layout will display a new link to `/manual` under the Account/Profile section with the `BookOpen` icon.
- **i18n Translations**: 
  - Thai: `userManual: "คู่มือการใช้งาน"`
  - English: `userManual: "User Manual"`
- **PDF Download Banner**: A prominent download section at the top of the manual page linking to `/manual/e-Leave_User_Guide.pdf` (already copied to the public folder).
- **Interactive Tabs by Role**:
  - **General Staff Tab**: Steps for Registration & Login, Dashboard view, Requesting Leave, and History/Profile management.
  - **Approvers & Admins Tab**: Steps for Leave Approvals, User Management, Reports export, and System settings.
- **Image Preview (Zoom Modal)**: A custom modal popup to view manual screenshots in full resolution when clicked.
- **Build Fix**: Resolve `xlsx` compilation error in `users/page.tsx` by replacing `XLSX.book_new()` with `XLSX.utils.book_new()`.

---

## 3. Proposed Changes

### Component 1: Translation & Layout Navigation
- **Modify** [i18n.tsx](file:///g:/My%20Drive/01%20Web%20app/01%20%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A5%E0%B8%B2/eLeave/src/lib/i18n.tsx)
  - Add translation key `userManual` under both `th` (คู่มือการใช้งาน) and `en` (User Manual).
- **Modify** [layout.tsx](file:///g:/My%20Drive/01%20Web%20app/01%20%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A5%E0%B8%B2/eLeave/src/app/(app)/layout.tsx)
  - Import `BookOpen` icon from `lucide-react`.
  - Add the `/manual` navigation item to the bottom of the main/account menu items array.

### Component 2: User Manual Page
- **New** [page.tsx](file:///g:/My%20Drive/01%20Web%20app/01%20%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A5%E0%B8%B2/eLeave/src/app/(app)/manual/page.tsx)
  - Create a page component displaying instructions, interactive tabs, screenshots, description cards, and a PDF download button.
  - Implement full-screen zoom model for screenshots.

### Component 3: Build Error Fix
- **Modify** [page.tsx](file:///g:/My%20Drive/01%20Web%20app/01%20%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A5%E0%B8%B2/eLeave/src/app/(app)/users/page.tsx)
  - Change line 48: `const workbook = XLSX.book_new();` to `const workbook = XLSX.utils.book_new();`

---

## 4. Verification Plan
- **Build Verification**: Run `pnpm run build` locally to confirm the Turbopack build finishes successfully without `xlsx` library errors.
- **Manual UI Verification**:
  1. Login as a user and check if the "คู่มือการใช้งาน" menu link is visible in the sidebar.
  2. Toggle language between TH/EN and verify translation works.
  3. Click on the link, navigate to `/manual`, and check that all images load correctly.
  4. Click on a screenshot to verify the zoom modal opens.
  5. Test downloading the PDF guide.
