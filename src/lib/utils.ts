import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_API_ERROR"
  | "UNKNOWN_ERROR";

export type ActionResponse<T = any> = 
  | {
      success: true;
      data: T;
      message?: string;
    }
  | {
      success: false;
      error: string;
      code: ErrorCode;
      technicalDetails?: string;
    };

export function safeAction<Args extends any[], ReturnType>(
  action: (...args: Args) => Promise<ReturnType>
): (...args: Args) => Promise<ActionResponse<ReturnType>> {
  return async (...args: Args) => {
    try {
      const result = await action(...args);
      return { success: true, data: result };
    } catch (err: any) {
      console.error(`🔒 [SafeAction Error Catch]:`, err);
      
      if (err.message === "Unauthorized") {
        return {
          success: false,
          code: "UNAUTHORIZED",
          error: "กรุณาเข้าสู่ระบบก่อนทำรายการนี้"
        };
      }
      if (err.message === "Permission denied") {
        return {
          success: false,
          code: "FORBIDDEN",
          error: "คุณไม่มีสิทธิ์ทำรายการนี้"
        };
      }
      
      return {
        success: false,
        code: "DATABASE_ERROR",
        error: err.message || "เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง",
        technicalDetails: process.env.NODE_ENV === "development" ? err.message : undefined
      };
    }
  };
}
