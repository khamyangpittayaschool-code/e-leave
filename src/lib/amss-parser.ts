import { toThaiNumerals } from "./document-utils";

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
 * Parses AMSS++ book details page to extract metadata.
 * Uses HTTP fetch and RegExp parsing to avoid heavy libraries like Cheerio or JSDOM.
 */
export async function parseAMSSUrl(urlStr: string, cookieHeader?: string): Promise<AMSSBookDetails | null> {
  try {
    // Validate URL shape
    const url = new URL(urlStr);
    if (!url.hostname.includes("amss")) {
      throw new Error("Not a valid AMSS domain");
    }

    // Fetch the page content with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
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
    // Match something like: <td><strong>เรื่อง :</strong></td> <td>...</td> or <td>เรื่อง : ...</td>
    let subject = "";
    const subjectMatch = html.match(/เรื่อง\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                         html.match(/เรื่อง\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (subjectMatch) {
      subject = cleanHtmlText(subjectMatch[1]);
    }

    // 2. Book Number (เลขที่หนังสือ)
    let bookNo = "";
    const bookNoMatch = html.match(/(?:เลขที่หนังสือ|ที่)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                        html.match(/(?:เลขที่หนังสือ|ที่)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (bookNoMatch) {
      bookNo = cleanHtmlText(bookNoMatch[1]);
    }

    // 3. Register No (เลขทะเบียนรับ)
    let registerNo = "";
    const registerNoMatch = html.match(/(?:ทะเบียนรับ|เลขรับที่)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                            html.match(/(?:ทะเบียนรับ|เลขรับที่)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (registerNoMatch) {
      registerNo = cleanHtmlText(registerNoMatch[1]);
    }

    // 4. From (จาก)
    let fromVal = "";
    const fromMatch = html.match(/(?:จาก|หน่วยงานผู้ส่ง|ผู้ส่ง)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
                      html.match(/(?:จาก|หน่วยงานผู้ส่ง|ผู้ส่ง)\s*[:：]\s*(.*?)(?:\r?\n|<br|\s*<\/td>)/i);
    if (fromMatch) {
      fromVal = cleanHtmlText(fromMatch[1]);
    }

    // 5. To (ถึง)
    let toVal = "";
    const toMatch = html.match(/(?:ถึง|เรียน|หน่วยงานผู้รับ)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) || 
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
    const dateMatch = html.match(/(?:ลงวันที่|วันที่)\s*[:：]?\s*(?:<\/strong>)?\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i) ||
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
      monthIdx = thaiShortMonths.findIndex(m => monthName.startsWith(m.replace(".", "")));
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
    const origin = url.origin;
    
    // Step 1: GET base URL with 5s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const initRes = await fetch(origin, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });
    clearTimeout(timeoutId);
    
    const initHtml = await initRes.text();
    const setCookieHeaders = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get("set-cookie")].filter(Boolean) as string[];
    
    let cookies = setCookieHeaders.map(c => c.split(";")[0]).join("; ");
    
    // Extract hidden inputs using regex to avoid Cheerio
    const hiddenInputs: Record<string, string> = {};
    const inputRegex = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
    let match;
    while ((match = inputRegex.exec(initHtml)) !== null) {
      hiddenInputs[match[1]] = match[2];
    }
    
    // Also try matching inputs where value is before name
    const inputRegexReverse = /<input[^>]*type=["']hidden["'][^>]*value=["']([^"']*)["'][^>]*name=["']([^"']+)["']/gi;
    while ((match = inputRegexReverse.exec(initHtml)) !== null) {
      hiddenInputs[match[2]] = match[1];
    }

    // Determine login post URL
    const postUrl = `${origin}/index.php`;
    
    // Build payload
    const payload = new URLSearchParams({
      ...hiddenInputs,
      username: username,
      password: passwordSecret,
    });
    
    // Step 2: POST login request with 5s timeout
    const postController = new AbortController();
    const postTimeoutId = setTimeout(() => postController.abort(), 5000);
    
    const loginRes = await fetch(postUrl, {
      method: "POST",
      signal: postController.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
