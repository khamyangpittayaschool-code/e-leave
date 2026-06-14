"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getBatchLeaveRequestsForPrint } from "@/app/actions/leave";
import { getSystemSettings } from "@/app/actions/settings";
import { Printer, ArrowLeft, X } from "lucide-react";

// Helper for Thai Date formatting (e.g. 10 มิถุนายน 2569)
function toThaiDateString(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543; // Buddhist year
  
  return `${d} ${m} พ.ศ. ${y}`;
}

// Short Thai Date (e.g. 10 มิ.ย. 2569)
function toThaiDateStringShort(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543;
  
  return `${d} ${m} ${y}`;
}

function getThaiDay(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  return date.getDate().toString();
}

function getThaiMonth(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  return months[date.getMonth()];
}

function getThaiYear(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  return (date.getFullYear() + 543).toString();
}

function BatchPrintPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const year = Number(searchParams.get("year") || "0");
  const start = Number(searchParams.get("start") || "0");
  const end = Number(searchParams.get("end") || "0");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [writtenAt, setWrittenAt] = useState("โรงเรียน");
  const [salutation, setSalutation] = useState("ผู้อำนวยการโรงเรียน");

  useEffect(() => {
    if (!year || !start || !end) {
      setError("กรุณาระบุปีงบประมาณ ลำดับเริ่มต้น และลำดับสิ้นสุดให้ถูกต้อง");
      setLoading(false);
      return;
    }

    Promise.all([
      getBatchLeaveRequestsForPrint(year, start, end),
      getSystemSettings()
    ])
      .then(([data, sysSettings]) => {
        setBatchData(data);
        setSettings(sysSettings);
        
        if (sysSettings?.schoolName) {
          setWrittenAt(sysSettings.schoolName);
          setSalutation(`ผู้อำนวยการ${sysSettings.schoolName}`);
        }
        
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลใบลา");
        setLoading(false);
      });
  }, [year, start, end]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">กำลังดาวน์โหลดข้อมูลใบลาทั้งหมด...</p>
      </div>
    );
  }

  if (error || batchData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center">
          <X className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">ไม่พบข้อมูลคำขอลา</h2>
        <p className="text-sm text-slate-500 max-w-md text-center">{error || "ไม่พบใบลาที่ได้รับอนุมัติในช่วงและปีงบประมาณที่กำหนด"}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับไปรายงาน
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 font-sans pb-12">
      {/* Control Panel (Hidden during Print) */}
      <div className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-950 dark:text-white">พิมพ์แบบฟอร์มคำขอลาเป็นชุด (PDF)</h1>
              <p className="text-xs text-slate-500">
                พบข้อมูลคำขอลาที่อนุมัติแล้ว ทั้งหมด {batchData.length} ฉบับ (ลำดับที่ {start} ถึง {end} ปีงบประมาณ {year})
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-sm hover:bg-purple-700 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4.5 h-4.5" />
              พิมพ์ {batchData.length} ฉบับ / บันทึก PDF
            </button>
          </div>
        </div>
      </div>

      {/* Forms Container */}
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-8 p-4 md:p-8">
        
        {batchData.map((item, index) => {
          const { request, stats, lastLeaveInfo, headApprover, execApprover, inspector } = item;
          const leaveType = request.type;

          let extra: any = {};
          if (request.extraFields) {
            try {
              extra = JSON.parse(request.extraFields);
            } catch (e) {
              console.error("Failed to parse extraFields:", e);
            }
          }

          const getLeaveLabel = (type: string): string => {
            if (type === "ORDINATION") {
              return extra.isHajj ? "ไปประกอบพิธีฮัจญ์" : "อุปสมบท";
            }
            const map: Record<string, string> = {
              SICK: "ป่วย",
              PERSONAL: "กิจส่วนตัว",
              MATERNITY: "คลอดบุตร",
              VACATION: "พักผ่อน",
              PATERNITY: "ช่วยเหลือภริยาที่คลอดบุตร",
              MILITARY: "เข้ารับการตรวจเลือกหรือเตรียมพล",
              STUDY: "ศึกษาต่อ/ฝึกอบรม/ดูงาน",
              INTERNATIONAL: "ไปปฏิบัติงานในองค์การระหว่างประเทศ",
              SPOUSE: "ติดตามคู่สมรส",
              REHABILITATION: "ฟื้นฟูสมรรถภาพด้านอาชีพ",
            };
            return map[type] || type;
          };

          const getLeaveTypeName = (type: string): string => {
            if (type === "ORDINATION") {
              return extra.isHajj ? "ลาไปประกอบพิธีฮัจญ์" : "ลาอุปสมบท";
            }
            const map: Record<string, string> = {
              SICK: "ลาป่วย",
              MATERNITY: "ลาคลอดบุตร",
              PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
              PERSONAL: "ลากิจส่วนตัว",
              VACATION: "ลาพักผ่อน",
              MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
              STUDY: "ลาศึกษาต่อ ฝึกอบรม หรือดูงาน",
              INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
              SPOUSE: "ลาติดตามคู่สมรส",
              REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
            };
            return map[type] || type;
          };

          return (
            <div key={request.id} className="print-container bg-white dark:bg-slate-950 text-black border border-slate-300 dark:border-slate-850 pt-[20mm] pb-[15mm] pl-[25mm] pr-[15mm] w-[210mm] min-h-[297mm] shadow-lg relative print:shadow-none print:border-none page-break">
              
              <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');
                
                .print-container {
                  font-family: 'Sarabun', sans-serif !important;
                  line-height: 1.5 !important;
                  font-size: 11.5pt !important;
                  color: #000 !important;
                }
                
                .print-container h1, .print-container h2, .print-container h3,
                .print-container p, .print-container div, .print-container span,
                .print-container td, .print-container th {
                  font-family: 'Sarabun', sans-serif !important;
                  color: #000 !important;
                }

                .print-container .min-w-\[50px\] { min-width: 37.5pt !important; }
                .print-container .min-w-\[60px\] { min-width: 45pt !important; }
                .print-container .min-w-\[80px\] { min-width: 60pt !important; }
                .print-container .min-w-\[100px\] { min-width: 75pt !important; }
                .print-container .min-w-\[120px\] { min-width: 90pt !important; }
                .print-container .min-w-\[140px\] { min-width: 105pt !important; }
                .print-container .min-w-\[150px\] { min-width: 112.5pt !important; }
                .print-container .min-w-\[180px\] { min-width: 135pt !important; }
                .print-container .min-w-\[200px\] { min-width: 150pt !important; }
                .print-container .min-w-\[250px\] { min-width: 187.5pt !important; }
                .print-container .min-w-\[350px\] { min-width: 262.5pt !important; }
                .print-container .min-w-\[380px\] { min-width: 285pt !important; }

                .print-container .text-lg {
                  font-size: 15pt !important;
                  font-weight: bold !important;
                  line-height: 1.5 !important;
                }

                .print-container .text-sm,
                .print-container .indent-12,
                .print-container .leading-relaxed {
                  font-size: 11.5pt !important;
                  line-height: 1.5 !important;
                }

                .print-container .text-sm.text-slate-600 {
                  font-size: 10.5pt !important;
                }

                .print-container .text-xs,
                .print-container table {
                  font-size: 10pt !important;
                  line-height: 1.25 !important;
                }

                .print-container th,
                .print-container td {
                  font-size: 8.5pt !important;
                  line-height: 1.2 !important;
                }

                .print-container .text-\[11px\] {
                  font-size: 9.5pt !important;
                  line-height: 1.2 !important;
                }

                .form-line-dotted {
                  border-bottom: 1px dotted #222;
                  display: inline-block;
                  padding-left: 5px;
                  padding-right: 5px;
                }

                .form-line-dotted-inline {
                  border-bottom: 1px dotted #222;
                  display: inline;
                  padding-left: 5px;
                  padding-right: 5px;
                }

                .form-checkbox {
                  width: 14px;
                  height: 14px;
                  border: 1px solid #000;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  margin-right: 6px;
                  font-size: 9pt;
                  font-weight: bold;
                  vertical-align: middle;
                }

                @media print {
                  body {
                    background-color: white !important;
                    color: black !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .print-container {
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    color: black !important;
                    width: 210mm !important;
                    min-height: 297mm !important;
                    margin: 0 !important;
                    padding: 20mm 15mm 15mm 25mm !important;
                    box-sizing: border-box !important;
                  }
                  .page-break {
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                  .page-break:last-child {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                  }
                  @page {
                    size: A4;
                    margin: 0 !important;
                  }
                }
              `}</style>

              <div className="space-y-2 text-justify relative">
                {/* Absolute Top-Right Request Number */}
                <div className="absolute top-[-10mm] right-0 text-[9pt] text-neutral-700 font-normal no-print:text-neutral-500">
                  <span>เลขที่อนุมัติ: {request.approvedSeq || "-"}/{request.fiscalYear || "-"}</span>
                </div>

                {/* Header */}
                <div className="text-center font-bold text-lg">
                  แบบใบลาออนไลน์
                </div>

                {/* Meta info */}
                <div className="flex flex-col items-end space-y-1 text-sm w-full">
                  <div className="flex items-baseline w-[280px]">
                    <span>เขียนที่</span>
                    <span className="flex-1 form-line-dotted text-center min-w-[50px]">{writtenAt || ""}</span>
                  </div>
                  <div className="flex items-baseline w-[280px] gap-1">
                    <span>วันที่</span>
                    <span className="form-line-dotted w-10 text-center">{getThaiDay(request.createdAt)}</span>
                    <span>เดือน</span>
                    <span className="flex-1 form-line-dotted text-center min-w-[80px]">{getThaiMonth(request.createdAt)}</span>
                    <span>พ.ศ.</span>
                    <span className="form-line-dotted w-14 text-center">{getThaiYear(request.createdAt)}</span>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1 w-full mt-1">
                  <div className="flex items-baseline w-full">
                    <span className="shrink-0">เรื่อง</span>
                    <span className="flex-1 form-line-dotted pl-2 font-bold">ขอลา{getLeaveLabel(leaveType)}</span>
                  </div>
                  <div className="flex items-baseline w-full">
                    <span className="shrink-0">เรียน</span>
                    <span className="flex-1 form-line-dotted pl-2">{salutation}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="w-full mt-2 text-justify leading-relaxed indent-12">
                  <span>ข้าพเจ้า </span>
                  <span className="form-line-dotted-inline px-2 font-bold">{request.user.name}</span>
                  <span> ตำแหน่ง </span>
                  <span className="form-line-dotted-inline px-2">{request.user.position || "ครู"}</span>
                  <span> ระดับ </span>
                  <span className="form-line-dotted-inline px-2">{request.user.level || "-"}</span>
                  <span> สังกัด </span>
                  <span className="form-line-dotted-inline px-2">{settings?.affiliation || request.user.subjectGroup || "ฝ่ายการสอน"}</span>
                </div>

                {/* Vacation Leave Balance Row */}
                {leaveType === "VACATION" && (
                  <div className="w-full text-justify leading-relaxed mt-1.5">
                    <span>มีวันลาพักผ่อนสะสม </span>
                    <span className="form-line-dotted w-12 text-center font-semibold">{extra.vacationAccumulated || 0}</span>
                    <span> วันทำการ มีสิทธิลาพักผ่อนประจำปีนี้อีก </span>
                    <span className="form-line-dotted w-12 text-center font-semibold">{extra.vacationThisYear || 0}</span>
                    <span> วันทำการ รวมเป็น </span>
                    <span className="form-line-dotted w-16 text-center font-bold">{(Number(extra.vacationAccumulated) || 0) + (Number(extra.vacationThisYear) || 0)}</span>
                    <span> วันทำการ</span>
                  </div>
                )}

                {/* Request Type */}
                <div className="w-full my-1.5 text-justify leading-relaxed">
                  <span>ขอลา </span>
                  <span className="form-line-dotted text-center font-bold min-w-[120px]">{getLeaveTypeName(leaveType)}</span>
                  <span> เนื่องจาก </span>
                  <span className={request.reason ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>
                    {request.reason || "-"}
                  </span>
                </div>

                {/* Paternity Info Sub-block */}
                {leaveType === "PATERNITY" && (
                  <div className="space-y-1.5 my-1 text-sm">
                    <div className="w-full text-justify leading-relaxed">
                      <span>ไปช่วยเหลือภริยาโดยชอบด้วยกฎหมายชื่อ </span>
                      <span className={extra.wifeName ? "form-line-dotted-inline px-2 font-semibold" : "form-line-dotted px-2 min-w-[200px]"}>{extra.wifeName || "-"}</span>
                    </div>
                    <div className="w-full text-justify leading-relaxed">
                      <span>ซึ่งคลอดบุตรเมื่อวันที่ </span>
                      <span className="form-line-dotted w-36 text-center">{extra.wifeBirthDate ? toThaiDateString(extra.wifeBirthDate) : "-"}</span>
                      <span> โดยแนบหลักฐาน: </span>
                      <span className="form-checkbox">{extra.hasMarriageCert ? "✓" : ""}</span>
                      <span> สำเนาใบสำคัญการสมรส </span>
                      <span className="form-checkbox">{extra.hasBirthCert ? "✓" : ""}</span>
                      <span> สำเนาสูติบัตร</span>
                    </div>
                  </div>
                )}

                {/* Ordination Info Sub-block */}
                {leaveType === "ORDINATION" && (
                  <div className="space-y-1.5 my-1 text-sm">
                    {!extra.isHajj ? (
                      <>
                        <div className="w-full text-justify leading-relaxed">
                          <span>อุปสมบท ณ วัด </span>
                          <span className={extra.templeName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{extra.templeName || "-"}</span>
                          <span> ตั้งอยู่ ณ </span>
                          <span className={extra.templeLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{extra.templeLocation || "-"}</span>
                        </div>
                        <div className="w-full text-justify leading-relaxed">
                          <span>จะจำพรรษาอยู่วัด </span>
                          <span className={extra.resideTempleName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{extra.resideTempleName || "-"}</span>
                          <span> ตั้งอยู่ ณ </span>
                          <span className={extra.resideTempleLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{extra.resideTempleLocation || "-"}</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full text-justify leading-relaxed">
                        <span>เดินทางไปประกอบพิธีฮัจญ์/อุปสมบท กำหนดเดินทางวันที่ </span>
                        <span className="form-line-dotted w-36 text-center">{extra.ordinationDate ? toThaiDateString(extra.ordinationDate) : "-"}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Military Info Sub-block */}
                {leaveType === "MILITARY" && (
                  <div className="space-y-1.5 my-1 text-sm">
                    <div className="w-full text-justify leading-relaxed">
                      <span>ได้รับหมายเรียกของ </span>
                      <span className={extra.militaryOrderSource ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{extra.militaryOrderSource || "-"}</span>
                      <span> ที่ </span>
                      <span className={extra.militaryOrderNo ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[100px]"}>{extra.militaryOrderNo || "-"}</span>
                      <span> ลงวันที่ </span>
                      <span className={extra.militaryOrderDate ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[120px]"}>{extra.militaryOrderDate ? toThaiDateStringShort(extra.militaryOrderDate) : "-"}</span>
                    </div>
                    <div className="w-full text-justify leading-relaxed">
                      <span>ให้เข้ารับการ </span>
                      <span className={extra.militaryDutyType ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{extra.militaryDutyType || "-"}</span>
                      <span> ณ สถานที่ </span>
                      <span className={extra.militaryLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{extra.militaryLocation || "-"}</span>
                    </div>
                  </div>
                )}

                {/* Study Info Sub-block */}
                {leaveType === "STUDY" && (
                  <div className="space-y-1.5 my-1 text-sm">
                    <div className="w-full text-justify leading-relaxed">
                      <span>ได้รับเงินเดือนเดือนละ </span>
                      <span className="form-line-dotted w-24 text-center">{extra.userSalary || ""}</span>
                      <span> บาท ไปศึกษาต่อ/ฝึกอบรม ณ ประเทศ </span>
                      <span className={extra.studyCountry ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{extra.studyCountry || "-"}</span>
                    </div>
                    <div className="w-full text-justify leading-relaxed">
                      <span>ด้วยทุน </span>
                      <span className={extra.scholarshipName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{extra.scholarshipName || "-"}</span>
                      <span> มีกำหนดเวลา </span>
                      <span className="form-line-dotted w-12 text-center">{extra.studyDurationYears || "0"}</span>
                      <span> ปี </span>
                      <span className="form-line-dotted w-12 text-center">{extra.studyDurationMonths || "0"}</span>
                      <span> เดือน </span>
                      <span className="form-line-dotted w-12 text-center">{extra.studyDurationDays || "0"}</span>
                      <span> วัน</span>
                    </div>
                  </div>
                )}

                {/* Leave Dates */}
                <div className="w-full text-justify leading-relaxed mt-1.5">
                  <span>ตั้งแต่วันที่ </span>
                  <span className="form-line-dotted w-10 text-center">{getThaiDay(request.startDate)}</span>
                  <span> เดือน </span>
                  <span className="form-line-dotted w-28 text-center">{getThaiMonth(request.startDate)}</span>
                  <span> พ.ศ. </span>
                  <span className="form-line-dotted w-14 text-center">{getThaiYear(request.startDate)}</span>
                  <span> ถึงวันที่ </span>
                  <span className="form-line-dotted w-10 text-center">{getThaiDay(request.endDate)}</span>
                  <span> เดือน </span>
                  <span className="form-line-dotted w-28 text-center">{getThaiMonth(request.endDate)}</span>
                  <span> พ.ศ. </span>
                  <span className="form-line-dotted w-14 text-center">{getThaiYear(request.endDate)}</span>
                  <span> มีกำหนด </span>
                  <span className="form-line-dotted w-12 text-center font-bold">{request.days}</span>
                  <span> วัน</span>
                </div>

                {/* Last Leave History */}
                <div className="w-full text-justify leading-relaxed mt-1.5">
                  <span>ข้าพเจ้าได้ลา </span>
                  <span className="form-line-dotted text-center font-bold min-w-[120px]">
                    {lastLeaveInfo ? getLeaveTypeName(lastLeaveInfo.type) : "-"}
                  </span>
                  <span> ครั้งสุดท้ายตั้งแต่วันที่ </span>
                  <span className="form-line-dotted w-10 text-center">{lastLeaveInfo ? getThaiDay(lastLeaveInfo.startDate) : "-"}</span>
                  <span> เดือน </span>
                  <span className="form-line-dotted w-28 text-center">{lastLeaveInfo ? getThaiMonth(lastLeaveInfo.startDate) : "-"}</span>
                  <span> พ.ศ. </span>
                  <span className="form-line-dotted w-14 text-center">{lastLeaveInfo ? getThaiYear(lastLeaveInfo.startDate) : "-"}</span>
                </div>

                <div className="w-full text-justify leading-relaxed mt-1.5">
                  <span>ถึงวันที่ </span>
                  <span className="form-line-dotted w-10 text-center">{lastLeaveInfo ? getThaiDay(lastLeaveInfo.endDate) : "-"}</span>
                  <span> เดือน </span>
                  <span className="form-line-dotted w-28 text-center">{lastLeaveInfo ? getThaiMonth(lastLeaveInfo.endDate) : "-"}</span>
                  <span> พ.ศ. </span>
                  <span className="form-line-dotted w-14 text-center">{lastLeaveInfo ? getThaiYear(lastLeaveInfo.endDate) : "-"}</span>
                  <span> มีกำหนด </span>
                  <span className="form-line-dotted w-12 text-center">{lastLeaveInfo ? lastLeaveInfo.days : "-"}</span>
                  <span> วัน</span>
                </div>

                {/* Contact Info */}
                <div className="w-full mt-1.5 text-justify leading-relaxed">
                  <span>ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ </span>
                  <span className={request.user.address ? "form-line-dotted-inline px-2 font-bold" : "form-line-dotted px-2 min-w-[280px]"}>
                    {request.user.address || "-"}
                  </span>
                  <span> โทรศัพท์ </span>
                  <span className={request.user.phoneNumber ? "form-line-dotted-inline px-2 font-bold" : "form-line-dotted px-2 min-w-[120px] text-center"}>
                    {request.user.phoneNumber || "-"}
                  </span>
                </div>

                {/* User Signature */}
                <div className="flex flex-col items-center justify-center mt-3 space-y-1 ml-auto w-[300px] text-center relative">
                  <div className="text-sm">ขอแสดงความนับถือ</div>
                  
                  <div className="h-10 flex items-center justify-center relative w-full">
                    {request.user.signatureUrl && (
                      <img src={request.user.signatureUrl} alt="Signature" className="max-h-10 max-w-full object-contain absolute bottom-0 dark:invert" />
                    )}
                  </div>
                  
                  <div>(ลงชื่อ) ........................................ ผู้ลา</div>
                  <div className="font-semibold">( {request.user.name} )</div>
                </div>

                {/* Bottom Stats & Approvals Split Layout */}
                <div className="grid grid-cols-2 gap-4 pt-2 mt-2 border-t border-slate-200">
                  
                  {/* Left: Stats Table & Inspector */}
                  <div className="space-y-2">
                    <div className="font-bold text-xs underline">สถิติการลาในปีงบประมาณนี้</div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-black p-1 font-bold text-center">ประเภท</th>
                          <th className="border border-black p-1 font-bold text-center">ลามาแล้ว</th>
                          <th className="border border-black p-1 font-bold text-center">ครั้งนี้</th>
                          <th className="border border-black p-1 font-bold text-center">รวมเป็น</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats || {}).map(([key, statVal]: [string, any]) => {
                          const unit = key === "VACATION" ? "วันทำการ" : "วัน";
                          return (
                            <tr key={key}>
                              <td className="border border-black p-1 text-center font-bold">{statVal.name}</td>
                              <td className="border border-black p-1 text-center">{statVal.prev} {unit}</td>
                              <td className="border border-black p-1 text-center">
                                {statVal.current > 0 ? `${statVal.current} ${unit}` : "-"}
                              </td>
                              <td className="border border-black p-1 text-center font-semibold">{statVal.total} {unit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Inspector Signature */}
                    <div className="text-center pt-1.5 space-y-1">
                      <div className="h-8 flex items-center justify-center relative w-full">
                        {inspector?.signatureUrl && (
                          <img src={inspector.signatureUrl} alt="Signature" className="max-h-8 max-w-full object-contain absolute dark:invert" />
                        )}
                      </div>
                      <div>(ลงชื่อ) ........................................ ผู้ตรวจสอบ</div>
                      <div>( {inspector ? inspector.name : "..................................................."} )</div>
                      <div className="text-[11px] text-slate-500">ตำแหน่ง {inspector?.position === "ผู้ตรวจสอบ" ? "ครู" : (inspector?.position || "หัวหน้างานบุคคล")}</div>
                      <div className="text-[11px] text-slate-500">วันที่ {request.createdAt ? toThaiDateString(request.createdAt) : "........./........../.........."}</div>
                    </div>
                  </div>

                  {/* Right: Opinion & Decision */}
                  <div className="space-y-3">
                    {/* Opinion Box */}
                    <div className="space-y-2">
                      <div className="font-bold text-xs underline">ความเห็นของผู้บังคับบัญชา</div>
                      <div className="text-sm text-slate-600 italic leading-relaxed min-h-[30px] border-b border-dashed border-slate-200">
                        {request.status === "PENDING_EXEC" || request.status === "APPROVED" ? "✓ เห็นควรเสนอผู้อำนวยการเพื่อพิจารณาอนุญาต" : "..........................................................................."}
                      </div>
                      <div className="text-center pt-1.5 space-y-1">
                        <div className="h-8 flex items-center justify-center relative w-full">
                          {headApprover?.signatureUrl && (
                            <img src={headApprover.signatureUrl} alt="Signature" className="max-h-8 max-w-full object-contain absolute dark:invert" />
                          )}
                        </div>
                        <div>(ลงชื่อ) ........................................</div>
                        <div>( {headApprover ? headApprover.name : "..................................................."} )</div>
                        <div className="text-[11px] text-slate-500">ตำแหน่ง {headApprover ? (headApprover.position || "หัวหน้างานบุคคล") : "หัวหน้างานบุคคล"}</div>
                      </div>
                    </div>

                    {/* Order Box */}
                    <div className="space-y-2 border border-black/30 p-3 rounded-xl">
                      <div className="font-bold text-xs underline">คำสั่ง</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center">
                          <span className="form-checkbox">
                            {request.status === "APPROVED" ? "✓" : ""}
                          </span>
                          <span>อนุญาต</span>
                        </div>
                        <div className="flex items-baseline flex-wrap">
                          <span className="form-checkbox shrink-0">
                            {request.status === "REJECTED" ? "✓" : ""}
                          </span>
                          <span className="shrink-0">ไม่อนุญาต เนื่องจาก</span>
                          <span className="flex-1 form-line-dotted pl-2 min-w-[120px] text-center font-bold">
                            {request.status === "REJECTED" ? (request.rejectReason || "ไม่อนุญาต") : ""}
                          </span>
                        </div>
                      </div>
                      <div className="text-center pt-1.5 space-y-1">
                        <div className="h-8 flex items-center justify-center relative w-full">
                          {execApprover?.signatureUrl && (
                            <img src={execApprover.signatureUrl} alt="Signature" className="max-h-8 max-w-full object-contain absolute dark:invert" />
                          )}
                        </div>
                        <div>(ลงชื่อ) ........................................</div>
                        <div>( {execApprover ? execApprover.name : "..................................................."} )</div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap">ตำแหน่ง {execApprover ? (execApprover.position || "ผู้อำนวยการ" + (settings?.schoolName || "โรงเรียน")) : "ผู้อำนวยการ" + (settings?.schoolName || "โรงเรียน")}</div>
                        <div className="text-[11px] text-slate-500">วันที่ {request.execApproverId ? toThaiDateString(request.updatedAt) : "........./........../.........."}</div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          );
        })}

      </div>
    </div>
  );
}

export default function BatchPrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">กำลังดาวน์โหลดข้อมูลใบลาทั้งหมด...</p>
      </div>
    }>
      <BatchPrintPageContent />
    </Suspense>
  );
}
