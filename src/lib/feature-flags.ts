import { prisma } from "./db";

export type FeatureKey = "attendance" | "document";

/**
 * Asserts whether a feature is enabled by checking both the environment variables
 * and the database system settings.
 * 
 * If the feature is disabled, it throws a standard error that will be caught 
 * by the module's error boundary.
 */
export async function assertFeatureEnabled(feature: FeatureKey): Promise<void> {
  // 1. Check environment variable override first (main switch)
  if (feature === "attendance" && process.env.ENABLE_ATTENDANCE === "false") {
    throw new Error("ระบบลงเวลาปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ (Environment Override)");
  }
  if (feature === "document" && process.env.ENABLE_DOCUMENT === "false") {
    throw new Error("ระบบจัดการเอกสารปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ (Environment Override)");
  }

  // 2. Check Database system settings
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: {
        enableAttendance: true,
        enableDocument: true,
      },
    });

    if (feature === "attendance" && !settings?.enableAttendance) {
      throw new Error("ระบบลงเวลาเช็คอิน-เช็คเอาต์ยังไม่เปิดให้บริการในขณะนี้");
    }
    if (feature === "document" && !settings?.enableDocument) {
      throw new Error("ระบบจัดเก็บและลงรับเอกสารสารบรรณยังไม่เปิดให้บริการในขณะนี้");
    }
  } catch (err: any) {
    // If DB is down, but env variables are not explicitly disabled, we log but don't block
    console.error(`🔒 [Feature Flag Database Check Failed for ${feature}]:`, err);
    
    // If it's our own thrown error, propagate it
    if (err.message.includes("ยังไม่เปิดให้บริการ")) {
      throw err;
    }
    // Database connection error falls back to true (unless env overrides it) to avoid complete system freeze
  }
}
