import http from "http";
import https from "https";
import { toThaiNumerals } from "./document-utils";

export const AMSS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "max-age=0",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1"
};

interface AMSSBookDetails {
  registerNo: string;
  year: string;
  bookNo: string;
  from: string;
  to: string;
  subject: string;
  docDate?: Date;
}

/**
 * Native HTTP/HTTPS implementation of fetch to bypass Next.js patched fetch
 * and work around Cloudflare bot-detection heuristics (JA3/JA4).
 */
export function nativeFetch(
  urlStr: string,
  options: any = {},
  redirectCount = 0
): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("Too many redirects"));
      return;
    }
    const url = new URL(urlStr);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const chromeCiphers = [
      "TLS_AES_128_GCM_SHA256",
      "TLS_AES_256_GCM_SHA384",
      "TLS_CHACHA20_POLY1305_SHA256",
      "ECDHE-ECDSA-AES128-GCM-SHA256",
      "ECDHE-RSA-AES128-GCM-SHA256",
      "ECDHE-ECDSA-AES256-GCM-SHA384",
      "ECDHE-RSA-AES256-GCM-SHA384",
      "ECDHE-ECDSA-CHACHA20-POLY1305",
      "ECDHE-RSA-CHACHA20-POLY1305",
      "DHE-RSA-AES128-GCM-SHA256",
      "DHE-RSA-AES256-GCM-SHA384"
    ].join(":");

    const reqOptions: any = {
      method: options.method || "GET",
      headers: {
        "Host": url.host,
        "Connection": "keep-alive",
        ...(options.headers || {})
      },
      rejectUnauthorized: options.rejectUnauthorized !== false,
      ciphers: chromeCiphers,
      ecdhCurve: "auto",
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.3"
    };

    if (options.signal) {
      reqOptions.signal = options.signal;
    }

    const req = lib.request(urlStr, reqOptions, (res) => {
      const statusCode = res.statusCode || 0;
      if (options.redirect !== "manual" && [301, 302, 303, 307, 308].includes(statusCode)) {
        const location = res.headers.location;
        if (location) {
          const resolvedUrl = new URL(location, urlStr).toString();
          const nextOptions = { ...options };
          if ([301, 302, 303].includes(statusCode)) {
            nextOptions.method = "GET";
            delete nextOptions.body;
          }
          resolve(nativeFetch(resolvedUrl, nextOptions, redirectCount + 1));
          return;
        }
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const headerMap = {
          get(name: string) {
            const val = res.headers[name.toLowerCase()];
            if (Array.isArray(val)) return val.join(", ");
            return val || null;
          },
          getSetCookie() {
            const val = res.headers["set-cookie"];
            if (Array.isArray(val)) return val;
            if (val) return [val];
            return [];
          },
        };

        const mockResponse = {
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          statusText: res.statusMessage || "",
          headers: headerMap,
          text: async () => buffer.toString("utf-8"),
          arrayBuffer: async () => {
            const arrayBuf = new ArrayBuffer(buffer.length);
            const view = new Uint8Array(arrayBuf);
            for (let i = 0; i < buffer.length; ++i) {
              view[i] = buffer[i];
            }
            return arrayBuf;
          },
        };

        resolve(mockResponse as unknown as Response);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Parses AMSS++ book details page to extract metadata.
 * Uses HTTP fetch and RegExp parsing to avoid heavy libraries like Cheerio or JSDOM.
 */
export async function fetchWithTlsFallback(url: string | URL, init?: RequestInit): Promise<Response> {
  const mergedHeaders = {
    ...AMSS_HEADERS,
    ...(init?.headers || {})
  };
  try {
    return await nativeFetch(url.toString(), { ...init, headers: mergedHeaders });
  } catch (error: any) {
    const isTlsError = 
      error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      error.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
      error.code === "CERT_HAS_EXPIRED" ||
      (error.message && (
        error.message.includes("certificate") ||
        error.message.includes("TLS") ||
        error.message.includes("ssl") ||
        error.message.includes("self-signed")
      ));
    
    if (isTlsError) {
      console.warn(`TLS certificate error detected for ${url.toString()}. Retrying with Reject Unauthorized disabled.`);
      const originalVal = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      try {
        return await nativeFetch(url.toString(), { ...init, headers: mergedHeaders });
      } finally {
        if (originalVal === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalVal;
        }
      }
    }
    throw error;
  }
}

export async function parseAMSSUrl(urlStr: string, cookieHeader?: string): Promise<AMSSBookDetails | null> {
  try {
    const url = new URL(urlStr);
    if (!url.hostname.includes("amss")) {
      throw new Error("Not a valid AMSS domain");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetchWithTlsFallback(urlStr, {
      signal: controller.signal,
      headers: {
        ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch AMSS page, status: ${response.status}`);
    }

    // Convert response to text using Windows-874 or UTF-8 depending on AMSS response headers
    // Thai school systems often use ISO-8859-11 / TIS-620 / Windows-874. 
    // Let's decode properly.
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "";
    
    let decoder = new TextDecoder("utf-8");
    if (contentType.toLowerCase().includes("tis-620") || contentType.toLowerCase().includes("windows-874")) {
      decoder = new TextDecoder("windows-874");
    } else {
      // Auto-detect: if we see TIS-620 or windows-874 in HTML meta, we re-decode
      const initialText = new TextDecoder("utf-8").decode(buffer);
      if (initialText.toLowerCase().includes("tis-620") || initialText.toLowerCase().includes("windows-874")) {
        decoder = new TextDecoder("windows-874");
      }
    }
    
    const html = decoder.decode(buffer);

    // Extract fields using Regex matching common AMSS++ patterns
    // 1. Subject / Title
    let subject = "";
    const subjectMatch = html.match(/เรื่อง\s*[:：]?\s*<\/font>\s*<font[^>]*>(.*?)<\/font>/i) ||
                         html.match(/เรื่อง\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                         html.match(/เรื่อง\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (subjectMatch) {
      subject = cleanHtmlText(subjectMatch[1]);
    }

    // 2. Book Number (เลขที่หนังสือ)
    let bookNo = "";
    const bookNoMatch = html.match(/รายละเอียดหนังสือ\s*([^\r\n<]+)/i) ||
                        html.match(/(?<!วัน)(?:ที่|เลขที่หนังสือ)\s*[:：]?\s*<\/font>\s*<font[^>]*>(.*?)<\/font>/i) ||
                        html.match(/(?<!วัน)(?:เลขที่หนังสือ|ที่)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                        html.match(/(?<!วัน)(?:เลขที่หนังสือ|ที่)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (bookNoMatch) {
      bookNo = cleanHtmlText(bookNoMatch[1]);
    }

    // 3. Register No (เลขทะเบียนรับ)
    let registerNo = "";
    const registerNoMatch = html.match(/(?:เลขทะเบียนหนังสือรับ|ทะเบียนรับ|เลขรับที่)\s*[:：]?\s*<\/font>\s*<font[^>]*>(.*?)<\/font>/i) ||
                            html.match(/(?:ทะเบียนรับ|เลขรับที่)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                            html.match(/(?:ทะเบียนรับ|เลขรับที่)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (registerNoMatch) {
      registerNo = cleanHtmlText(registerNoMatch[1]);
    }

    // 4. From (จาก)
    let fromVal = "";
    const fromMatch = html.match(/(?:ส่งโดย|จาก|หน่วยงานผู้ส่ง|ผู้ส่ง)\s*[:：]?\s*<\/font>\s*<font[^>]*>(.*?)<\/font>/i) ||
                      html.match(/(?:จาก|หน่วยงานผู้ส่ง|ผู้ส่ง)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                      html.match(/(?:จาก|หน่วยงานผู้ส่ง|ผู้ส่ง)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (fromMatch) {
      fromVal = cleanHtmlText(fromMatch[1]);
    }

    // 5. To (ถึง)
    let toVal = "";
    const toMatch = html.match(/(?:ถึง|เรียน|หน่วยงานผู้รับ)\s*[:：]?\s*<\/font>\s*<font[^>]*>(.*?)<\/font>/i) ||
                    html.match(/(?:ถึง|เรียน|หน่วยงานผู้รับ)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                    html.match(/(?:ถึง|เรียน|หน่วยงานผู้รับ)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (toMatch) {
      toVal = cleanHtmlText(toMatch[1]);
    }

    // 6. Year (ปี)
    let year = new Date().getFullYear().toString();
    const yearMatch = html.match(/ปี\s*[:：]\s*(\d{4})/i) || html.match(/พ\.ศ\.\s*(\d{4})/i);
    if (yearMatch) {
      year = yearMatch[1];
    } else {
      // fallback to current Thai year
      year = (new Date().getFullYear() + 543).toString();
    }

    // 7. Date of Document (ลงวันที่)
    let docDate: Date | undefined;
    const dateMatch = html.match(/(?:หนังสือลงวันที่|ลงวันที่|วันที่)\s*[:：]?\s*<\/font>\s*<font[^>]*>(.*?)<\/font>/i) ||
                      html.match(/(?:ลงวันที่|วันที่)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) ||
                      html.match(/(?:ลงวันที่|วันที่)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (dateMatch) {
      const parsedDate = parseThaiDateStr(cleanHtmlText(dateMatch[1]));
      if (parsedDate) docDate = parsedDate;
    }

    return {
      registerNo: registerNo || "รอดำเนินการ",
      year: year,
      bookNo: bookNo || "ที่สพท. ...",
      from: fromVal || "สำนักงานเขตพื้นที่การศึกษา",
      to: toVal || "ผู้อำนวยการโรงเรียน",
      subject: subject || "หนังสือราชการภายนอก",
      docDate: docDate,
    };
  } catch (error) {
    console.error("Error scraping AMSS++ URL:", error);
    return null;
  }
}

function cleanHtmlText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/&nbsp;/g, " ") // replace nbsp
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")    // collapse whitespaces
    .trim();
}

/**
 * Parses Thai date formats like "30 มิถุนายน 2569" or "30 มิ.ย. 2569" or "30/06/2569"
 */
function parseThaiDateStr(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const thaiShortMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  // Try slash format: 30/06/2569
  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    let year = parseInt(slashMatch[3]);
    if (year > 2400) year -= 543; // Convert BE to AD
    return new Date(year, month, day);
  }

  // Try text format: 30 มิถุนายน 2569
  const textParts = dateStr.split(/\s+/);
  if (textParts.length >= 3) {
    const day = parseInt(textParts[0]);
    let monthIdx = -1;
    
    // Find month
    const monthName = textParts[1].trim();
    monthIdx = thaiMonths.findIndex(m => m === monthName);
    if (monthIdx === -1) {
      monthIdx = thaiShortMonths.findIndex(m => {
        const cleanM = m.replace(/\./g, "");
        const cleanName = monthName.replace(/\./g, "");
        return cleanName.startsWith(cleanM) || cleanM.startsWith(cleanName);
      });
    }

    let year = parseInt(textParts[2]);
    if (year > 2400) year -= 543; // BE to AD

    if (!isNaN(day) && monthIdx !== -1 && !isNaN(year)) {
      return new Date(year, monthIdx, day);
    }
  }

  return undefined;
}

/**
 * Handles PHP session cookies and forms-based login to AMSS++
 */
export async function loginToAMSS(baseUrl: string, username: string, passwordSecret: string): Promise<string | null> {
  try {
    const url = new URL(baseUrl);
    
    // Resolve base path for subdirectories
    let basePath = url.origin + url.pathname;
    if (basePath.endsWith(".php")) {
      basePath = basePath.substring(0, basePath.lastIndexOf("/"));
    }
    if (!basePath.endsWith("/")) {
      basePath += "/";
    }
    
    const initUrl = baseUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const initRes = await fetchWithTlsFallback(initUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const initHtml = await initRes.text();
    const setCookieHeaders = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get("set-cookie")].filter(Boolean) as string[];
    
    let cookies = setCookieHeaders.map(c => c.split(";")[0]).join("; ");
    
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

    // Determine login post URL relative to base path
    const postUrl = `${basePath}index.php`;
    
    // Build payload using 'pass', 'user_os', and 'login_submit'
    const payload = new URLSearchParams({
      ...hiddenInputs,
      username: username,
      pass: passwordSecret,
      user_os: "desktop",
      login_submit: "Login",
    });
    
    const postController = new AbortController();
    const postTimeoutId = setTimeout(() => postController.abort(), 12000);
    
    const loginRes = await fetchWithTlsFallback(postUrl, {
      method: "POST",
      signal: postController.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookies,
      },
      body: payload.toString(),
      redirect: "manual" // Prevent auto-redirect to capture new set-cookie headers
    });
    clearTimeout(postTimeoutId);
    
    const postCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")].filter(Boolean) as string[];
    if (postCookies.length > 0) {
      cookies = postCookies.map(c => c.split(";")[0]).join("; ");
    }
    
    return cookies;
  } catch (error) {
    console.error("AMSS++ Login failed:", error);
    return null;
  }
}
