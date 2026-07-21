interface AMSSParsedRow {
  amssLink: string;
  receiveNo: string;
  docRefNo: string;
  title: string;
  senderOrg: string;
  dateText: string;
}

export function parseAMSSListHtml(html: string, baseUrl?: string): AMSSParsedRow[] {
  const documents: AMSSParsedRow[] = [];
  
  // Find all table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = rowRegex.exec(html)) !== null) {
    const rowContent = match[1];
    
    // Look for standard href or onclick check(...) link
    let amssLink = "";
    const hrefMatch = rowContent.match(/href=["']([^"']*bookdetail_receive_sch\.php\?id=(\d+)[^"']*)["']/i);
    if (hrefMatch) {
      amssLink = hrefMatch[1];
    } else {
      // Look for onclick check('page.php', id)
      const onclickMatch = rowContent.match(/check\(['"]([^'"]+)['"]\s*,\s*(\d+)/i) ||
                           rowContent.match(/check\(['"]([^'"]+)['"]\s*,\s*['"](\d+)['"]/i);
      if (onclickMatch) {
        const page = onclickMatch[1];
        const b_id = onclickMatch[2];
        amssLink = `modules/book/main/${page}?b_id=${b_id}`;
      }
    }

    if (!amssLink) continue;
    
    // If baseUrl is provided and link is relative, make it absolute
    if (baseUrl && !amssLink.startsWith("http://") && !amssLink.startsWith("https://")) {
      const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
      try {
        amssLink = new URL(amssLink, base).toString();
      } catch (e) {
        // preserve relative if invalid URL
      }
    }

    // Extract td contents
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch;
    
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      tds.push(
        tdMatch[1]
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      );
    }
    
    if (tds.length >= 7) {
      // 7-column layout (with onclick link style)
      // Index 0: Running Register / Receive No (152590)
      // Index 1: Doc Ref No / Book No (ที่ ศธ 04349/ว3694)
      // Index 2: Title / Subject (เสนอรายชื่อคณะกรรมการ...)
      // Index 3: Click details
      // Index 4: Date (18 กย 2568)
      // Index 5: Sender Org (กลุ่มส่งเสริมการจัดการศึกษา)
      // Index 6: Send timestamp
      const receiveNo = tds[0] || "";
      const docRefNo = tds[1] || "";
      const title = tds[2] || "";
      const dateText = tds[4] || "";
      const senderOrg = tds[5] || "";
      
      documents.push({
        amssLink,
        receiveNo,
        docRefNo,
        title,
        senderOrg,
        dateText
      });
    } else if (tds.length >= 5) {
      // Legacy 5-column layout
      const receiveNo = tds[1] || "";
      const docRefNo = tds[2] || "";
      const title = tds[3] || "";
      const senderOrg = tds[4] || "";
      const dateText = tds[5] || "";
      
      documents.push({
        amssLink,
        receiveNo,
        docRefNo,
        title,
        senderOrg,
        dateText
      });
    }
  }
  
  return documents;
}
