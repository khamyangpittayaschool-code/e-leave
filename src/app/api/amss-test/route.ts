import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loginToAMSS, AMSS_HEADERS, fetchWithTlsFallback } from "@/lib/amss-parser";
import { decrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  const logs: { step: string; status: "success" | "error" | "warning" | "info"; message: string }[] = [];
  
  try {
    // 1. Session check
    let user: any = null;
    if (process.env.BYPASS_AUTH === "true") {
      user = await prisma.user.findUnique({ where: { id: "NCtfppV4YeHKGmNOt2aefmBx5TI3A7Cp" } }) || await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: "test-user-id",
            name: "Test User",
            email: "test@example.com",
            role: "ADMIN",
            isApproved: true
          }
        });
      }
    } else {
      const { headers } = await import("next/headers");
      const { auth } = await import("@/lib/auth");
      const session = await auth.api.getSession({
        headers: await headers()
      });
      if (session?.user) {
        user = session.user;
      }
    }

    if (!user) {
      logs.push({ step: "AUTH", status: "error", message: "Unauthorized: No active session" });
      return NextResponse.json({ success: false, logs }, { status: 401 });
    }

    logs.push({ step: "AUTH", status: "success", message: `Authenticated as ${user.email} (Role: ${user.role})` });

    // 2. Parse request payload
    const body = await req.json().catch(() => ({}));
    let targetUrl = body.url ? body.url.trim() : "";
    let targetUsername = body.username ? body.username.trim() : "";
    let targetPassword = body.password ? body.password : "";

    // If URL or Username is not provided, load saved credentials for this user
    if (!targetUrl || !targetUsername) {
      logs.push({ step: "CREDENTIALS", status: "info", message: "Reading saved credentials from database..." });
      const saved = await prisma.aMSSCredentials.findUnique({
        where: { userId: user.id }
      });
      if (!saved) {
        logs.push({ step: "CREDENTIALS", status: "error", message: "No credentials provided and none found in database" });
        return NextResponse.json({ success: false, logs }, { status: 400 });
      }
      targetUrl = saved.url;
      targetUsername = saved.username;
      targetPassword = decrypt(saved.password);
      logs.push({ step: "CREDENTIALS", status: "success", message: `Using saved credentials for user: ${targetUsername}` });
    } else {
      logs.push({ step: "CREDENTIALS", status: "success", message: `Testing provided credentials for user: ${targetUsername}` });
      // Fallback: If password was omitted but URL & Username match the database, use the saved password
      if (!targetPassword) {
        const saved = await prisma.aMSSCredentials.findUnique({
          where: { userId: user.id }
        });
        if (saved && saved.url === targetUrl && saved.username === targetUsername) {
          targetPassword = decrypt(saved.password);
          logs.push({ step: "CREDENTIALS", status: "info", message: "Loaded saved password from database" });
        } else {
          logs.push({ step: "CREDENTIALS", status: "warning", message: "No password provided" });
        }
      }
    }

    // 3. URL check
    logs.push({ step: "URL_VALIDATION", status: "info", message: `Validating URL format: ${targetUrl}` });
    let urlObj: URL;
    try {
      urlObj = new URL(targetUrl);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        throw new Error("Protocol must be HTTP or HTTPS");
      }
    } catch (e: any) {
      logs.push({ step: "URL_VALIDATION", status: "error", message: `Invalid URL format: ${e.message}` });
      return NextResponse.json({ success: false, logs });
    }
    logs.push({ step: "URL_VALIDATION", status: "success", message: `URL is valid. Host: ${urlObj.host}` });

    // 4. Initial HTTP Get (Handshake & Cookies extraction)
    logs.push({ step: "HTTP_HANDSHAKE", status: "info", message: `Fetching base login page: ${targetUrl}` });
    
    let basePath = urlObj.origin + urlObj.pathname;
    if (basePath.endsWith(".php")) {
      basePath = basePath.substring(0, basePath.lastIndexOf("/"));
    }
    if (!basePath.endsWith("/")) {
      basePath += "/";
    }

    const initUrl = targetUrl;
    let initRes: Response;
    let cookies = "";

    try {
      initRes = await fetchWithTlsFallback(initUrl);
    } catch (err: any) {
      logs.push({ step: "HTTP_HANDSHAKE", status: "error", message: `Network connection failed: ${err.message}` });
      return NextResponse.json({ success: false, logs });
    }

    if (!initRes.ok) {
      logs.push({ step: "HTTP_HANDSHAKE", status: "error", message: `Server returned non-2xx code: ${initRes.status} ${initRes.statusText}` });
      return NextResponse.json({ success: false, logs });
    }

    const initHtml = await initRes.text();
    const setCookieHeaders = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get("set-cookie")].filter(Boolean) as string[];
    cookies = setCookieHeaders.map(c => c.split(";")[0]).join("; ");
    
    logs.push({ 
      step: "HTTP_HANDSHAKE", 
      status: "success", 
      message: `Successfully connected. Status: ${initRes.status}. Cookies received: ${cookies || "None"}` 
    });

    // 5. Form Hidden Inputs Extraction
    logs.push({ step: "FORM_PARSING", status: "info", message: "Searching for hidden input fields..." });
    const hiddenInputs: Record<string, string> = {};
    const inputRegex = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
    let match;
    while ((match = inputRegex.exec(initHtml)) !== null) {
      hiddenInputs[match[1]] = match[2];
    }
    const inputRegexReverse = /<input[^>]*type=["']hidden["'][^>]*value=["']([^"']*)["'][^>]*name=["']([^"']+)["']/gi;
    while ((match = inputRegexReverse.exec(initHtml)) !== null) {
      hiddenInputs[match[2]] = match[1];
    }

    const foundKeys = Object.keys(hiddenInputs);
    if (foundKeys.length > 0) {
      logs.push({ step: "FORM_PARSING", status: "success", message: `Extracted inputs: ${foundKeys.join(", ")}` });
    } else {
      logs.push({ step: "FORM_PARSING", status: "warning", message: "No hidden inputs found in the page form (AMSS++ version may vary)" });
    }

    // 6. POST Login request
    const postUrl = `${basePath}index.php`;
    logs.push({ step: "LOGIN_POST", status: "info", message: `Sending POST login request to: ${postUrl}` });

    const payload = new URLSearchParams({
      ...hiddenInputs,
      username: targetUsername,
      pass: targetPassword,
      user_os: "desktop",
      login_submit: "Login"
    });

    let loginRes: Response;
    try {
      loginRes = await fetchWithTlsFallback(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookies,
        },
        body: payload.toString(),
        redirect: "manual"
      });
    } catch (err: any) {
      logs.push({ step: "LOGIN_POST", status: "error", message: `Login post request failed: ${err.message}` });
      return NextResponse.json({ success: false, logs });
    }

    const postCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")].filter(Boolean) as string[];
    if (postCookies.length > 0) {
      cookies = postCookies.map(c => c.split(";")[0]).join("; ");
      logs.push({ step: "LOGIN_POST", status: "info", message: `Updated session cookies received: ${cookies}` });
    }

    logs.push({ 
      step: "LOGIN_POST", 
      status: "success", 
      message: `Login request processed. Status: ${loginRes.status} (manual redirect capture).` 
    });

    // 7. Verify session against document page
    const checkUrls = [
      `${basePath}modules/document/receive_sch.php`,
      `${basePath}document/receive_sch.php`,
      `${basePath}receive_sch.php`,
      `${basePath}index.php?option=book&task=main/receive`
    ];

    logs.push({ step: "SESSION_VERIFICATION", status: "info", message: "Verifying authenticated session access..." });
    let authHtml = "";
    let verifiedUrl = "";

    try {
      for (const checkUrl of checkUrls) {
        logs.push({ step: "SESSION_VERIFICATION", status: "info", message: `Trying to fetch: ${checkUrl}` });
        const res = await fetchWithTlsFallback(checkUrl, {
          headers: {
            "Cookie": cookies,
          }
        });
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const decoded = new TextDecoder("windows-874").decode(buffer);
          if (
            decoded.includes("bookdetail") ||
            decoded.includes("onclick=\"check") ||
            decoded.includes("saraban_index")
          ) {
            authHtml = decoded;
            verifiedUrl = checkUrl;
            break;
          }
        }
      }
    } catch (err: any) {
      logs.push({ step: "SESSION_VERIFICATION", status: "error", message: `Verification request failed: ${err.message}` });
      return NextResponse.json({ success: false, logs });
    }

    if (!authHtml) {
      logs.push({ 
        step: "SESSION_VERIFICATION", 
        status: "error", 
        message: "Failed to access document list page. The session may be invalid, credentials wrong, or URL structure unrecognized." 
      });
      return NextResponse.json({ success: false, logs });
    }

    logs.push({ 
      step: "SESSION_VERIFICATION", 
      status: "success", 
      message: `Session verified successfully. Confirmed access to: ${verifiedUrl}` 
    });

    return NextResponse.json({ success: true, logs });

  } catch (globalErr: any) {
    logs.push({ step: "SYSTEM", status: "error", message: `Unexpected error: ${globalErr.message || globalErr}` });
    return NextResponse.json({ success: false, logs }, { status: 500 });
  }
}
