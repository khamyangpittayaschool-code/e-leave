"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { getPendingApprovals, approveLeaveRequest, rejectLeaveRequest, uploadLeavePdf } from "@/app/actions/leave";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { UserCircle, Calendar, FileText, Check, X, AlertCircle, Printer, Paperclip } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function calculateDays(startDateStr: string, endDateStr: string, type: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  
  if (type === "MATERNITY") {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }
  
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

const handleViewAttachment = (preview: string, fileName?: string) => {
  if (preview.startsWith("data:")) {
    try {
      const parts = preview.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.error("Failed to open data URL", e);
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(
          `<iframe src="${preview}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      }
    }
  } else {
    window.open(preview, '_blank');
  }
};

const renderDocumentLinks = (documentUrl: string) => {
  if (!documentUrl) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200/10 dark:border-slate-800/10">
        ไม่มีเอกสารแนบ
      </span>
    );
  }

  let files: { name?: string; preview: string }[] = [];

  if (documentUrl.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(documentUrl);
      if (Array.isArray(parsed)) {
        files = parsed.map((file: any) => {
          if (typeof file === "string") {
            return { preview: file };
          }
          return { name: file.name, preview: file.preview };
        });
      }
    } catch (e) {
      console.error("Failed to parse documentUrl JSON", e);
    }
  }

  if (files.length > 0) {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
        {files.map((file, idx) => (
          <button
            key={idx}
            onClick={() => handleViewAttachment(file.preview, file.name)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-200/40 dark:border-purple-800/40 transition-colors cursor-pointer"
          >
            <Paperclip className="w-3 h-3" />
            เอกสาร {idx + 1}
          </button>
        ))}
      </div>
    );
  }

  // Fallback for single/comma-separated strings
  const urls = documentUrl.split(",");
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
      {urls.map((url, idx) => (
        <button
          key={idx}
          onClick={() => handleViewAttachment(url.trim())}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-200/40 dark:border-purple-800/40 transition-colors cursor-pointer"
        >
          <Paperclip className="w-3 h-3" />
          {urls.length > 1 ? `เอกสาร ${idx + 1}` : "เปิดดูเอกสาร"}
        </button>
      ))}
    </div>
  );
};

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN" || user?.position === "แอดมิน";

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useI18n();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    getPendingApprovals()
      .then(setPendingRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const getLeaveTypeName = (type: string) => {
    const map: Record<string, string> = { SICK: t("sickLeave"), PERSONAL: t("personalLeave"), VACATION: t("vacationLeave") };
    return map[type] || type;
  };

  const generatePdfForRequest = (id: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      iframe.style.border = "none";
      
      iframe.src = `/print/leave/${id}`;
      
      const messageListener = async (event: MessageEvent) => {
        if (event.data?.id === id) {
          if (event.data?.type === "ELEAVE_PRINT_READY") {
            try {
              setProcessingStatus("capturing");
              const iframeWindow = iframe.contentWindow;
              if (!iframeWindow) {
                cleanup();
                reject(new Error("Iframe window not available"));
                return;
              }
              
              const printContent = iframeWindow.document.getElementById("print-content");
              if (!printContent) {
                cleanup();
                reject(new Error("Print content element not found in iframe"));
                return;
              }
              
              // Wait for iframe fonts to be ready
              try {
                await iframeWindow.document.fonts.ready;
              } catch (fErr) {
                console.warn("Iframe fonts ready check failed:", fErr);
              }

              const canvas = await html2canvas(printContent, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
                logging: false
              });

              const imgData = canvas.toDataURL("image/jpeg", 0.95);
              
              const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
              });

              pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
              const pdfBase64 = pdf.output("datauristring").split(",")[1];
              
              cleanup();
              resolve(pdfBase64);
            } catch (err) {
              cleanup();
              reject(err);
            }
          } else if (event.data?.type === "ELEAVE_PRINT_ERROR") {
            cleanup();
            reject(new Error(event.data.error || "ไม่สามารถโหลดข้อมูลหน้าใบลาใน iframe ได้"));
          }
        }
      };

      const cleanup = () => {
        window.removeEventListener("message", messageListener);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };

      window.addEventListener("message", messageListener);
      document.body.appendChild(iframe);
      
      // Safety timeout after 15 seconds
      setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for PDF generation"));
      }, 15000);
    });
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setProcessingStatus("updating_db");
    try {
      const res = await approveLeaveRequest(id, undefined, true);
      
      if (res?.newStatus === "APPROVED") {
        setProcessingStatus("loading_iframe");
        let pdfBase64: string | undefined = undefined;
        try {
          pdfBase64 = await generatePdfForRequest(id);
        } catch (pdfErr: any) {
          console.error("Failed to generate PDF client-side:", pdfErr);
          alert(`คำเตือน: อนุมัติสำเร็จแล้ว แต่ไม่สามารถสร้างไฟล์ PDF บนคลาวด์ได้เนื่องจากปัญหาทางเทคนิค\n\nรายละเอียด: ${pdfErr?.message || pdfErr}`);
        }

        if (pdfBase64) {
          setProcessingStatus("uploading");
          await uploadLeavePdf(id, pdfBase64, false);
        }
      }

      window.dispatchEvent(new Event("noti-refresh"));
      loadData();
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + (error?.message || error));
    } finally {
      setProcessingId(null);
      setProcessingStatus(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("กรุณากรอกความเห็น/เหตุผลในการไม้อนุมัติ:");
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      alert(lang === "en" ? "Rejection reason is required." : "จำเป็นต้องระบุเหตุผลในการปฏิเสธการอนุมัติ");
      return;
    }

    setProcessingId(id);
    setProcessingStatus("updating_db");
    try {
      await rejectLeaveRequest(id, trimmedReason, undefined, true);

      setProcessingStatus("loading_iframe");
      let pdfBase64: string | undefined = undefined;
      try {
        pdfBase64 = await generatePdfForRequest(id);
      } catch (pdfErr: any) {
        console.error("Failed to generate PDF client-side:", pdfErr);
        alert(`คำเตือน: ปฏิเสธการลาสำเร็จแล้ว แต่ไม่สามารถสร้างไฟล์ PDF บนคลาวด์ได้เนื่องจากปัญหาทางเทคนิค\n\nรายละเอียด: ${pdfErr?.message || pdfErr}`);
      }

      if (pdfBase64) {
        setProcessingStatus("uploading");
        await uploadLeavePdf(id, pdfBase64, true);
      }

      window.dispatchEvent(new Event("noti-refresh"));
      loadData();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setProcessingId(null);
      setProcessingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("pendingApprovalsTitle")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("pendingApprovalsSubtitle")}</p>
      </div>

      <div className="grid gap-6">
        {pendingRequests.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("noPendingApprovals")}</h3>
            <p className="text-slate-500 mt-1">{t("allDone")}</p>
          </div>
        ) : (
          pendingRequests.map((item) => (
            <div key={item.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row gap-6 items-start md:items-center">
              
              {/* User Info */}
              <div className="flex items-center gap-4 min-w-[240px]">
                {item.user?.image ? (
                  <img src={item.user.image} alt={item.user.name} className="w-12 h-12 rounded-2xl object-cover shadow-md border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                    {item.user?.name?.charAt(0) || "U"}
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{item.user?.name}</p>
                  <p className="text-xs text-slate-500">{item.user?.position || t("staffMember")} • {item.user?.subjectGroup}</p>
                </div>
              </div>

              {/* Leave Info */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-y md:border-y-0 md:border-x border-slate-100 dark:border-slate-800 py-4 md:py-0 md:px-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t("typeAndDate")} • คำขอที่ {item.pendingSeq}/{item.fiscalYear}
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800">
                      {item.status === "PENDING_HEAD" ? "รอหัวหน้างานบุคคล" : item.status === "PENDING_EXEC" ? "รอผู้อำนวยการ" : item.status}
                    </span>
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    {getLeaveTypeName(item.type)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(new Date(item.startDate), "dd MMM")} - {format(new Date(item.endDate), "dd MMM")}</span>
                    {calculateDays(item.startDate, item.endDate, item.type) === 0 && item.type !== "MATERNITY" ? (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]" title="วันที่เลือกตรงกับวันเสาร์-อาทิตย์ทั้งหมด">
                        (0 วัน - ตรงกับวันหยุดราชการ)
                      </span>
                    ) : (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                        ({calculateDays(item.startDate, item.endDate, item.type)} วัน)
                      </span>
                    )}
                  </p>
                  
                  {/* Attached Document Section */}
                  <div className="mt-2 flex gap-2">
                    {renderDocumentLinks(item.documentUrl)}

                    <a
                      href={`/print/leave/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-200/40 dark:border-indigo-800/40 transition-colors"
                    >
                      <Printer className="w-3 h-3" />
                      พิมพ์ใบลา
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t("reason")}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                    {item.reason}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full md:w-auto md:min-w-[200px] justify-end items-center">
                {isAdmin ? (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    แอดมิน (ดูเท่านั้น)
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-rose-600 font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      {t("reject")}
                    </button>
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      {t("approve")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {processingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {processingStatus === "updating_db" && "กำลังอัปเดตสถานะในระบบ..."}
                {processingStatus === "loading_iframe" && "กำลังโหลดแบบฟอร์มเอกสาร..."}
                {processingStatus === "capturing" && "กำลังแคปภาพและสร้างไฟล์ PDF..."}
                {processingStatus === "uploading" && "กำลังนำส่งเอกสารลง Google Drive..."}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                กรุณาอย่าปิดหน้าต่างนี้ ระบบกำลังดำเนินการอัปเดตสถานะและจัดเก็บเอกสารอย่างปลอดภัย
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
