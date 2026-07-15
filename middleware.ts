import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Better Auth stores session token in cookies
  const sessionCookie = request.cookies.get("better-auth.session_token") || request.cookies.get("__Secure-better-auth.session_token");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isUploadRoute = request.nextUrl.pathname.startsWith("/uploads");

  if (isApiRoute || isUploadRoute) {
    return NextResponse.next();
  }

  const isAttendanceRoute = request.nextUrl.pathname.startsWith("/attendance");
  const isDocumentRoute = request.nextUrl.pathname.startsWith("/document");

  if (isAttendanceRoute && process.env.ENABLE_ATTENDANCE === "false") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isDocumentRoute && process.env.ENABLE_DOCUMENT === "false") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!sessionCookie) {
    if (!isAuthRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
