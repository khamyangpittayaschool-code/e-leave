import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const handler = toNextJsHandler(auth.handler);

export async function GET(request: NextRequest, ctx: any) {
  const url = new URL(request.url);
  
  if (url.pathname.endsWith("/get-session") || url.pathname.endsWith("/session")) {
    const response = await handler.GET(request);
    
    if (response.ok) {
      try {
        const data = await response.clone().json();
        if (data && data.user) {
          // Safe DB query to verify if the actual user is a database admin
          const dbUser = await prisma.user.findUnique({
            where: { id: data.user.id },
            select: { role: true, position: true }
          });
          
          const isActualAdmin = dbUser?.role === "ADMIN" || dbUser?.position === "แอดมิน";
          
          if (isActualAdmin) {
            data.user.isActualAdmin = true;
            const cookieStore = await cookies();
            let impPosition = cookieStore.get("imp_position")?.value;
            const impRole = cookieStore.get("imp_role")?.value;
            
            if (impPosition) {
              try {
                impPosition = decodeURIComponent(impPosition);
              } catch (e) {}
              data.user.position = impPosition === "CLEAR" ? null : impPosition;
            }
            if (impRole) {
              data.user.role = impRole === "CLEAR" ? "TEACHER" : impRole;
            }
            
            return NextResponse.json(data);
          }
        }
      } catch (err) {
        console.error("Error intercepting session response:", err);
      }
    }
    return response;
  }
  
  return handler.GET(request);
}

export const POST = handler.POST;
