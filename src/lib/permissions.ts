/**
 * Capability-based Permission Matrix for the Repair Request System (v7.2)
 *
 * Role → Permission mapping is defined here in ONE place.
 * All Server Actions and Services must call `hasRepairPermission()` — never check `user.role` directly.
 *
 * Roles:
 *   TEACHER    → ผู้แจ้ง (creates and views own requests)
 *   TECHNICIAN → ช่าง   (views all and updates status)
 *   HEAD       → หัวหน้าหมวด (assigns + sees cost)
 *   ADMIN      → แอดมิน (full access)
 *
 * Positions that map to roles:
 *   "แอดมิน"         → ADMIN
 *   "ช่าง"           → TECHNICIAN
 *   "หัวหน้างาน"     → HEAD
 *   everything else  → TEACHER
 */

export type RepairPermission =
  | "repair:create"
  | "repair:view.own"
  | "repair:view.all"
  | "repair:view.cost"
  | "repair:dashboard"
  | "repair:assign"
  | "repair:update"
  | "repair:export"
  | "repair:delete"
  | "repair:archive";

type RepairRole = "TEACHER" | "TECHNICIAN" | "HEAD" | "ADMIN" | "REPAIR_MANAGER";

/** Static permission matrix — change role capabilities here, not in component/action code */
const REPAIR_PERMISSION_MATRIX: Record<RepairRole, RepairPermission[]> = {
  TEACHER: ["repair:create", "repair:view.own"],
  TECHNICIAN: ["repair:create", "repair:view.own", "repair:view.all", "repair:update", "repair:dashboard"],
  HEAD: ["repair:create", "repair:view.own", "repair:view.all", "repair:assign", "repair:view.cost", "repair:dashboard"],
  REPAIR_MANAGER: [
    "repair:create",
    "repair:view.own",
    "repair:view.all",
    "repair:view.cost",
    "repair:dashboard",
    "repair:assign",
    "repair:update",
    "repair:export",
    "repair:delete",
    "repair:archive",
  ],
  ADMIN: [
    "repair:create",
    "repair:view.own",
    "repair:view.all",
    "repair:view.cost",
    "repair:dashboard",
    "repair:assign",
    "repair:update",
    "repair:export",
    "repair:delete",
    "repair:archive",
  ],
};

/** Derive repair role from a user's position and role fields */
export function getRepairRole(user: {
  role: string;
  position?: string | null;
}): RepairRole {
  if (user.role === "ADMIN" || user.position === "แอดมิน") return "ADMIN";
  if (user.role === "REPAIR_MANAGER" || user.position === "ผู้จัดการเรื่องระบบซ่อม") return "REPAIR_MANAGER";
  if (user.role === "TECHNICIAN" || user.position === "ช่าง") return "TECHNICIAN";
  if (
    user.position === "หัวหน้างาน" ||
    user.position === "หัวหน้าหมวด" ||
    user.position === "ผู้อำนวยการ"
  )
    return "HEAD";
  return "TEACHER";
}

/** Check if a user has a specific repair permission */
export function hasRepairPermission(
  user: { role: string; position?: string | null },
  permission: RepairPermission
): boolean {
  const repairRole = getRepairRole(user);
  return REPAIR_PERMISSION_MATRIX[repairRole].includes(permission);
}

/** Assert a permission — throws an error if the user doesn't have it */
export function assertRepairPermission(
  user: { role: string; position?: string | null },
  permission: RepairPermission
): void {
  if (!hasRepairPermission(user, permission)) {
    throw new Error(
      `ไม่มีสิทธิ์ดำเนินการนี้ (required: ${permission})`
    );
  }
}
