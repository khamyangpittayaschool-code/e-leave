interface AMSSParsedRow {
  amssLink: string;
  receiveNo: string;
  docRefNo: string;
  title: string;
  senderOrg: string;
  dateText: string;
}

export function parseAMSSListHtml(html: string): AMSSParsedRow[] {
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
      const onclickMatch = rowContent.match(/onclick=["']check\(['"]([^'"]+)['"]\s*,\s*(\d+)/i) ||
                           rowContent.match(/onclick=["']check\(['"]([^'"]+)['"]\s*,\s*['"](\d+)['"]/i);
      if (onclickMatch) {
        const page = onclickMatch[1];
        const b_id = onclickMatch[2];
        amssLink = `modules/book/main/${page}?b_id=${b_id}`;
      }
    }

    if (!amssLink) continue;
    
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
      // Index 0: Running Register / Receive No
      // Index 1: Doc Ref No / Book No
      // Index 2: Title / Subject
      // Index 3: Click details
      // Index 4: Date
      // Index 5: Sender Org
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
      // Index 1 or 2 is receive no / register no
      // Index 2 or 3 is doc ref no (เลขที่หนังสือ)
      // Index 3 or 4 is title/subject (เรื่อง)
      // Index 4 or 5 is sender (จาก)
      // Index 5 is date text (ลงวันที่)
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
