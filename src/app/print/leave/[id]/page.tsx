"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLeaveRequestForPrint } from "@/app/actions/leave";
import { getSystemSettings } from "@/app/actions/settings";
import { Printer, ArrowLeft, Settings, Check, X, Phone, MapPin, Eye, FileText } from "lucide-react";

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


export default function PrintLeavePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // Editable fields for form
  const [writtenAt, setWrittenAt] = useState("โรงเรียน");
  const [salutation, setSalutation] = useState("ผู้อำนวยการโรงเรียน");
  const [contactAddress, setContactAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // Specific inputs for Paternity leave
  const [wifeName, setWifeName] = useState("");
  const [wifeBirthDate, setWifeBirthDate] = useState("");
  const [hasMarriageCert, setHasMarriageCert] = useState(true);
  const [hasBirthCert, setHasBirthCert] = useState(true);

  // Specific inputs for Vacation leave
  const [vacationAccumulated, setVacationAccumulated] = useState(10);
  const [vacationThisYear, setVacationThisYear] = useState(10);

  // Specific inputs for Ordination leave
  const [isHajj, setIsHajj] = useState(false);
  const [templeName, setTempleName] = useState("");
  const [templeLocation, setTempleLocation] = useState("");
  const [resideTempleName, setResideTempleName] = useState("");
  const [resideTempleLocation, setResideTempleLocation] = useState("");
  const [ordinationDate, setOrdinationDate] = useState("");

  // Specific inputs for Military leave
  const [militaryOrderSource, setMilitaryOrderSource] = useState("");
  const [militaryOrderNo, setMilitaryOrderNo] = useState("");
  const [militaryOrderDate, setMilitaryOrderDate] = useState("");
  const [militaryDutyType, setMilitaryDutyType] = useState("เข้ารับการตรวจเลือก");
  const [militaryLocation, setMilitaryLocation] = useState("");

  // Specific inputs for Study leave
  const [userSalary, setUserSalary] = useState("15,000");
  const [scholarshipName, setScholarshipName] = useState("ทุนส่วนตัว");
  const [studyCountry, setStudyCountry] = useState("ประเทศไทย");
  const [studyDurationYears, setStudyDurationYears] = useState("1");
  const [studyDurationMonths, setStudyDurationMonths] = useState("0");
  const [studyDurationDays, setStudyDurationDays] = useState("0");

  useEffect(() => {
    if (!id) return;

    Promise.all([
      getLeaveRequestForPrint(id),
      getSystemSettings()
    ])
      .then(([data, sysSettings]) => {
        setPrintData(data);
        setSettings(sysSettings);
        
        // Pre-fill fields
        if (sysSettings?.schoolName) {
          setWrittenAt(sysSettings.schoolName);
          setSalutation(`ผู้อำนวยการ${sysSettings.schoolName}`);
        }
        
        const { request } = data;
        if (request?.user?.address) {
          setContactAddress(request.user.address);
        }
        if (request?.user?.phoneNumber) {
          setPhoneNumber(request.user.phoneNumber);
        }

        if (request?.extraFields) {
          try {
            const extra = JSON.parse(request.extraFields);
            if (extra.wifeName) setWifeName(extra.wifeName);
            if (extra.wifeBirthDate) setWifeBirthDate(extra.wifeBirthDate);
            if (extra.hasMarriageCert !== undefined) setHasMarriageCert(extra.hasMarriageCert);
            if (extra.hasBirthCert !== undefined) setHasBirthCert(extra.hasBirthCert);
            if (extra.vacationAccumulated !== undefined) setVacationAccumulated(Number(extra.vacationAccumulated));
            if (extra.vacationThisYear !== undefined) setVacationThisYear(Number(extra.vacationThisYear));
            if (extra.isHajj !== undefined) setIsHajj(extra.isHajj);
            if (extra.templeName) setTempleName(extra.templeName);
            if (extra.templeLocation) setTempleLocation(extra.templeLocation);
            if (extra.resideTempleName) setResideTempleName(extra.resideTempleName);
            if (extra.resideTempleLocation) setResideTempleLocation(extra.resideTempleLocation);
            if (extra.ordinationDate) setOrdinationDate(extra.ordinationDate);
            if (extra.militaryOrderSource) setMilitaryOrderSource(extra.militaryOrderSource);
            if (extra.militaryOrderNo) setMilitaryOrderNo(extra.militaryOrderNo);
            if (extra.militaryOrderDate) setMilitaryOrderDate(extra.militaryOrderDate);
            if (extra.militaryDutyType) setMilitaryDutyType(extra.militaryDutyType);
            if (extra.militaryLocation) setMilitaryLocation(extra.militaryLocation);
            if (extra.userSalary) setUserSalary(extra.userSalary);
            if (extra.scholarshipName) setScholarshipName(extra.scholarshipName);
            if (extra.studyCountry) setStudyCountry(extra.studyCountry);
            if (extra.studyDurationYears) setStudyDurationYears(extra.studyDurationYears);
            if (extra.studyDurationMonths) setStudyDurationMonths(extra.studyDurationMonths);
            if (extra.studyDurationDays) setStudyDurationDays(extra.studyDurationDays);
          } catch (e) {
            console.error("Failed to parse extraFields:", e);
          }
        }
        
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        setLoading(false);
      });
  }, [id]);
  
  useEffect(() => {
    if (!loading) {
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        if (error || !printData) {
          window.parent.postMessage({
            type: "ELEAVE_PRINT_ERROR",
            id,
            error: error || "ไม่พบข้อมูลใบลาหรือไม่ได้รับอนุญาตให้เข้าถึง"
          }, "*");
        } else {
          // Wait for fonts to be ready
          document.fonts.ready.then(() => {
            const timer = setTimeout(() => {
              window.parent.postMessage({ type: "ELEAVE_PRINT_READY", id }, "*");
            }, 1000);
            return () => clearTimeout(timer);
          }).catch((fontErr) => {
            console.error("Failed to wait for fonts ready:", fontErr);
            const timer = setTimeout(() => {
              window.parent.postMessage({ type: "ELEAVE_PRINT_READY", id }, "*");
            }, 1500);
            return () => clearTimeout(timer);
          });
        }
      }
    }
  }, [loading, printData, error, id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">กำลังดาวน์โหลดข้อมูลใบลา...</p>
      </div>
    );
  }

  if (error || !printData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center">
          <X className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">ไม่สามารถเปิดแบบฟอร์มได้</h2>
        <p className="text-sm text-slate-500 max-w-md text-center">{error || "ขออภัย คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันการพิมพ์สำหรับคำขอลานี้"}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const { request, stats, lastLeaveInfo, headApprover, execApprover, inspector } = printData;
  const leaveType = request.type;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 font-sans pb-12">
      {/* Explicitly load Google Fonts Link to make sure it loads inside the iframe immediately */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings?.pdfFont || 'Prompt').replace(/ /g, '+')}:wght@300;400;500;600;700;800&display=swap`} rel="stylesheet" crossOrigin="anonymous" />
      {/* Control Panel (Hidden during Print) */}
      <div className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-950 dark:text-white">พิมพ์แบบฟอร์มคำขอลาอิเล็กทรอนิกส์</h1>
              <p className="text-xs text-slate-500">พิมพ์เอกสารทางการ หรือบันทึกเป็น PDF เพื่อส่งมอบให้งานบุคคล</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-sm hover:bg-purple-700 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4.5 h-4.5" />
              พิมพ์เอกสาร / บันทึก PDF
            </button>
          </div>
        </div>
      </div>

      {/* Document Container (Centered, Sidebar Removed) */}
      <div className="max-w-6xl mx-auto flex justify-center p-4 md:p-8">
        
        {/* Paper Container */}
        <div className="flex justify-center">
          <div id="print-content" className="print-container bg-white dark:bg-slate-950 text-black border border-slate-300 dark:border-slate-850 pt-[20mm] pb-[15mm] pl-[25mm] pr-[15mm] w-[210mm] min-h-[297mm] shadow-lg relative print:shadow-none print:border-none">
            
            {/* Embedded styles for dynamic font and exact A4 formatting */}
            <style jsx global>{`
              .print-container {
                font-family: '${settings?.pdfFont || 'Prompt'}', sans-serif !important;
                line-height: 1.5 !important;
                font-size: 11.5pt !important;
                color: #000 !important;
                letter-spacing: normal !important;
                font-feature-settings: "kern" on, "liga" on !important;
                text-rendering: optimizeLegibility !important;
              }
              
              .print-container h1, .print-container h2, .print-container h3,
              .print-container p, .print-container div, .print-container span,
              .print-container td, .print-container th {
                font-family: '${settings?.pdfFont || 'Prompt'}', sans-serif !important;
                color: #000 !important;
                letter-spacing: normal !important;
              }

              /* Convert pixel-based min-widths to pt to scale perfectly with font-size */
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

              /* 1. Header (was text-lg) */
              .print-container .text-lg {
                font-size: 15pt !important;
                font-weight: bold !important;
                line-height: 1.35 !important;
              }

              /* 2. Metadata, Date, Subject, User Signature (was text-sm / inherited body) */
              .print-container .text-sm,
              .print-container .indent-12,
              .print-container .leading-relaxed {
                font-size: 11.5pt !important;
                line-height: 1.5 !important;
              }

              /* Opinion italic subtext can be slightly smaller to fit perfectly */
              .print-container .text-sm.text-slate-600 {
                font-size: 10.5pt !important;
              }

              /* 3. Small details: Table header, table cells, titles of opinion boxes (was text-xs) */
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

              /* 4. Extra small details: Approver subtexts, dates (was text-[11px]) */
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
                  padding: 20mm 15mm 15mm 25mm !important; /* Top Right Bottom Left */
                  box-sizing: border-box !important;
                }
                @page {
                  size: A4;
                  margin: 0 !important;
                }
              }
            `}</style>

            {/* RENDERING ENGINE: ALL LEAVE TYPES USE THE UNIFIED SICK/PERSONAL/MATERNITY LEAVE FORM LAYOUT */}
            {(() => {
              const getLeaveLabel = (type: string): string => {
                if (type === "ORDINATION") {
                  return isHajj ? "ไปประกอบพิธีฮัจญ์" : "อุปสมบท";
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
                  return isHajj ? "ลาไปประกอบพิธีฮัจญ์" : "ลาอุปสมบท";
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
                <div className="space-y-2 text-left relative">
                  {/* Absolute Top-Right Request Number */}
                  <div className="absolute top-[-10mm] right-0 text-[9pt] text-neutral-700 font-normal no-print:text-neutral-500">
                    {request.status === "APPROVED" ? (
                      <span>เลขที่อนุมัติ: {request.approvedSeq || "-"}/{request.fiscalYear || "-"}</span>
                    ) : (
                      <span>เลขที่คำขอ: {request.pendingSeq || "-"}/{request.fiscalYear || "-"}</span>
                    )}
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
                  <div className="w-full mt-2 text-left leading-relaxed indent-12">
                    <span>ข้าพเจ้า </span>
                    <span className="form-line-dotted-inline px-2 font-bold">{request.user.name}</span>
                    <span> ตำแหน่ง </span>
                    <span className="form-line-dotted-inline px-2">{request.user.position || "ครู"}</span>
                    <span> ระดับ </span>
                    <span className="form-line-dotted-inline px-2">{request.user.level || "-"}</span>
                    <span> สังกัด </span>
                    <span className="form-line-dotted-inline px-2">{settings?.affiliation || request.user.subjectGroup || "ฝ่ายการสอน"}</span>

                    {leaveType === "VACATION" && (
                      <>
                        <span> มีวันลาพักผ่อนสะสม </span>
                        <span className="form-line-dotted-inline px-2 font-semibold">{vacationAccumulated}</span>
                        <span> วันทำการ มีสิทธิลาพักผ่อนประจำปีนี้อีก </span>
                        <span className="form-line-dotted-inline px-2 font-semibold">{vacationThisYear}</span>
                        <span> วันทำการ รวมเป็น </span>
                        <span className="form-line-dotted-inline px-2 font-bold">{vacationAccumulated + vacationThisYear}</span>
                        <span> วันทำการ</span>
                      </>
                    )}

                    <span> ขอลา </span>
                    <span className="form-line-dotted-inline px-2 font-bold">{getLeaveTypeName(leaveType)}</span>
                    <span> เนื่องจาก </span>
                    <span className={request.reason ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>
                      {request.reason || "-"}
                    </span>
                  </div>

                  {/* Paternity Info Sub-block */}
                  {leaveType === "PATERNITY" && (
                    <div className="space-y-1.5 my-1 text-sm">
                      <div className="w-full text-left leading-relaxed">
                        <span>ไปช่วยเหลือภริยาโดยชอบด้วยกฎหมายชื่อ </span>
                        <span className={wifeName ? "form-line-dotted-inline px-2 font-semibold" : "form-line-dotted px-2 min-w-[200px]"}>{wifeName || "-"}</span>
                      </div>
                      <div className="w-full text-left leading-relaxed">
                        <span>ซึ่งคลอดบุตรเมื่อวันที่ </span>
                        <span className="form-line-dotted w-36 text-center">{wifeBirthDate ? toThaiDateString(wifeBirthDate) : "-"}</span>
                        <span> โดยแนบหลักฐาน: </span>
                        <span className="form-checkbox">{hasMarriageCert ? "✓" : ""}</span>
                        <span> สำเนาใบสำคัญการสมรส </span>
                        <span className="form-checkbox">{hasBirthCert ? "✓" : ""}</span>
                        <span> สำเนาสูติบัตร</span>
                      </div>
                    </div>
                  )}

                  {/* Ordination Info Sub-block */}
                  {leaveType === "ORDINATION" && (
                    <div className="space-y-1.5 my-1 text-sm">
                      {!isHajj ? (
                          <>
                            <div className="w-full text-left leading-relaxed">
                              <span>อุปสมบท ณ วัด </span>
                              <span className={templeName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{templeName || "-"}</span>
                              <span> ตั้งอยู่ ณ </span>
                              <span className={templeLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{templeLocation || "-"}</span>
                            </div>
                            <div className="w-full text-left leading-relaxed">
                              <span>จะจำพรรษาอยู่วัด </span>
                              <span className={resideTempleName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{resideTempleName || "-"}</span>
                              <span> ตั้งอยู่ ณ </span>
                              <span className={resideTempleLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{resideTempleLocation || "-"}</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full text-left leading-relaxed">
                            <span>เดินทางไปประกอบพิธีฮัจญ์/อุปสมบท กำหนดเดินทางวันที่ </span>
                            <span className="form-line-dotted w-36 text-center">{ordinationDate ? toThaiDateString(ordinationDate) : "-"}</span>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Military Info Sub-block */}
                  {leaveType === "MILITARY" && (
                    <div className="space-y-1.5 my-1 text-sm">
                      <div className="w-full text-left leading-relaxed">
                        <span>ได้รับหมายเรียกของ </span>
                        <span className={militaryOrderSource ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{militaryOrderSource || "-"}</span>
                        <span> ที่ </span>
                        <span className={militaryOrderNo ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[100px]"}>{militaryOrderNo || "-"}</span>
                        <span> ลงวันที่ </span>
                        <span className={militaryOrderDate ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[120px]"}>{militaryOrderDate ? toThaiDateStringShort(militaryOrderDate) : "-"}</span>
                      </div>
                      <div className="w-full text-left leading-relaxed">
                        <span>ให้เข้ารับการ </span>
                        <span className={militaryDutyType ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{militaryDutyType || "-"}</span>
                        <span> ณ สถานที่ </span>
                        <span className={militaryLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{militaryLocation || "-"}</span>
                      </div>
                    </div>
                  )}

                  {/* Study Info Sub-block */}
                  {leaveType === "STUDY" && (
                    <div className="space-y-1.5 my-1 text-sm">
                      <div className="w-full text-left leading-relaxed">
                        <span>ได้รับเงินเดือนเดือนละ </span>
                        <span className="form-line-dotted w-24 text-center">{userSalary}</span>
                        <span> บาท ไปศึกษาต่อ/ฝึกอบรม ณ ประเทศ </span>
                        <span className={studyCountry ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{studyCountry || "-"}</span>
                      </div>
                      <div className="w-full text-left leading-relaxed">
                        <span>ด้วยทุน </span>
                        <span className={scholarshipName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{scholarshipName || "-"}</span>
                        <span> มีกำหนดเวลา </span>
                        <span className="form-line-dotted w-12 text-center">{studyDurationYears}</span>
                        <span> ปี </span>
                        <span className="form-line-dotted w-12 text-center">{studyDurationMonths}</span>
                        <span> เดือน </span>
                        <span className="form-line-dotted w-12 text-center">{studyDurationDays}</span>
                        <span> วัน</span>
                      </div>
                    </div>
                  )}

                  {/* Leave Dates */}
                  <div className="w-full text-left leading-relaxed mt-1.5">
                    <span>ตั้งแต่วันที่&nbsp;</span>
                    <span className="form-line-dotted w-10 text-center">{getThaiDay(request.startDate)}</span>
                    <span>&nbsp;เดือน&nbsp;</span>
                    <span className="form-line-dotted w-28 text-center">{getThaiMonth(request.startDate)}</span>
                    <span>&nbsp;พ.ศ.&nbsp;</span>
                    <span className="form-line-dotted w-14 text-center">{getThaiYear(request.startDate)}</span>
                    <span>&nbsp;ถึงวันที่&nbsp;</span>
                    <span className="form-line-dotted w-10 text-center">{getThaiDay(request.endDate)}</span>
                    <span>&nbsp;เดือน&nbsp;</span>
                    <span className="form-line-dotted w-28 text-center">{getThaiMonth(request.endDate)}</span>
                    <span>&nbsp;พ.ศ.&nbsp;</span>
                    <span className="form-line-dotted w-14 text-center">{getThaiYear(request.endDate)}</span>
                    <span>&nbsp;มีกำหนด&nbsp;</span>
                    <span className="form-line-dotted w-12 text-center font-bold">{request.days}</span>
                    <span>&nbsp;วัน</span>
                  </div>

                  {/* Last Leave History */}
                  <div className="w-full text-left leading-relaxed mt-1.5">
                    <span>ข้าพเจ้าได้ลา&nbsp;</span>
                    <span className="form-line-dotted text-center font-bold min-w-[120px]">
                      {lastLeaveInfo ? getLeaveTypeName(lastLeaveInfo.type) : "-"}
                    </span>
                    <span>&nbsp;ครั้งสุดท้ายตั้งแต่วันที่&nbsp;</span>
                    <span className="form-line-dotted w-10 text-center">{lastLeaveInfo ? getThaiDay(lastLeaveInfo.startDate) : "-"}</span>
                    <span>&nbsp;เดือน&nbsp;</span>
                    <span className="form-line-dotted w-28 text-center">{lastLeaveInfo ? getThaiMonth(lastLeaveInfo.startDate) : "-"}</span>
                    <span>&nbsp;พ.ศ.&nbsp;</span>
                    <span className="form-line-dotted w-14 text-center">{lastLeaveInfo ? getThaiYear(lastLeaveInfo.startDate) : "-"}</span>
                  </div>

                  <div className="w-full text-left leading-relaxed mt-1.5">
                    <span>ถึงวันที่&nbsp;</span>
                    <span className="form-line-dotted w-10 text-center">{lastLeaveInfo ? getThaiDay(lastLeaveInfo.endDate) : "-"}</span>
                    <span>&nbsp;เดือน&nbsp;</span>
                    <span className="form-line-dotted w-28 text-center">{lastLeaveInfo ? getThaiMonth(lastLeaveInfo.endDate) : "-"}</span>
                    <span>&nbsp;พ.ศ.&nbsp;</span>
                    <span className="form-line-dotted w-14 text-center">{lastLeaveInfo ? getThaiYear(lastLeaveInfo.endDate) : "-"}</span>
                    <span>&nbsp;มีกำหนด&nbsp;</span>
                    <span className="form-line-dotted w-12 text-center">{lastLeaveInfo ? lastLeaveInfo.days : "-"}</span>
                    <span>&nbsp;วัน</span>
                  </div>

                  {/* Contact Info */}
                  <div className="w-full mt-1.5 text-left leading-relaxed">
                    <span>ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ </span>
                    <span className={contactAddress ? "form-line-dotted-inline px-2 font-bold" : "form-line-dotted px-2 min-w-[280px]"}>
                      {contactAddress || "-"}
                    </span>
                    <span> โทรศัพท์ </span>
                    <span className={phoneNumber ? "form-line-dotted-inline px-2 font-bold" : "form-line-dotted px-2 min-w-[120px] text-center"}>
                      {phoneNumber || "-"}
                    </span>
                  </div>

                  {/* User Signature */}
                  <div className="flex flex-col items-center justify-center mt-3 space-y-1 ml-auto w-[300px] text-center relative">
                    <div className="text-sm">ขอแสดงความนับถือ</div>
                    
                    <div className="relative w-full h-10 flex items-end justify-center">
                      <div className="z-10">(ลงชื่อ) ........................................ ผู้ลา</div>
                      {request.user.signatureUrl && (
                        <img 
                          src={request.user.signatureUrl} 
                          alt="Signature" 
                          className="max-h-12 max-w-[150px] object-contain absolute bottom-[2px] z-20 pointer-events-none dark:invert" 
                        />
                      )}
                    </div>
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
                        <div className="relative w-full h-8 flex items-end justify-center">
                          <div className="z-10">(ลงชื่อ) ........................................ ผู้ตรวจสอบ</div>
                          {inspector?.signatureUrl && (
                            <img 
                              src={inspector.signatureUrl} 
                              alt="Signature" 
                              className="max-h-10 max-w-[120px] object-contain absolute bottom-[2px] z-20 pointer-events-none dark:invert" 
                            />
                          )}
                        </div>
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
                          {request.status === "REJECTED" && !request.execApproverId ? (
                            <span className="text-rose-600 font-bold">❌ ไม่อนุมัติ เนื่องจาก {request.rejectReason}</span>
                          ) : (
                            request.status === "PENDING_EXEC" || request.status === "APPROVED" || (request.status === "REJECTED" && request.execApproverId) ? (
                              "✓ เห็นควรเสนอผู้อำนวยการเพื่อพิจารณาอนุญาต"
                            ) : (
                              "..........................................................................."
                            )
                          )}
                        </div>
                        <div className="text-center pt-1.5 space-y-1">
                          <div className="relative w-full h-8 flex items-end justify-center">
                            <div className="z-10">(ลงชื่อ) ........................................ ผู้ตรวจสอบ</div>
                            {headApprover?.signatureUrl && (
                              <img 
                                src={headApprover.signatureUrl} 
                                alt="Signature" 
                                className="max-h-10 max-w-[120px] object-contain absolute bottom-[2px] z-20 pointer-events-none dark:invert" 
                              />
                            )}
                          </div>
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
                              {(request.status === "REJECTED" && request.execApproverId) ? "✓" : ""}
                            </span>
                            <span className="shrink-0">ไม่อนุญาต เนื่องจาก</span>
                            <span className="flex-1 form-line-dotted pl-2 min-w-[120px] text-center font-bold">
                              {(request.status === "REJECTED" && request.execApproverId) ? (request.rejectReason || "ไม่อนุญาต") : ""}
                            </span>
                          </div>
                        </div>
                        <div className="text-center pt-1.5 space-y-1">
                          <div className="relative w-full h-8 flex items-end justify-center">
                            <div className="z-10">(ลงชื่อ) ........................................</div>
                            {execApprover?.signatureUrl && (
                              <img 
                                src={execApprover.signatureUrl} 
                                alt="Signature" 
                                className="max-h-10 max-w-[120px] object-contain absolute bottom-[2px] z-20 pointer-events-none dark:invert" 
                              />
                            )}
                          </div>
                          <div>( {execApprover ? execApprover.name : "..................................................."} )</div>
                          {(() => {
                            const isDeputy = execApprover?.position && (execApprover.position.includes("รองผู้อำนวยการ") || execApprover.position.startsWith("รอง"));
                            const school = settings?.schoolName || "โรงเรียน";
                            const formattedPosition = execApprover 
                              ? (execApprover.position.includes("โรงเรียน") ? execApprover.position : `${execApprover.position}${school}`)
                              : `ผู้อำนวยการ${school}`;
                            return (
                              <>
                                <div className="text-[11px] text-slate-500 whitespace-nowrap">ตำแหน่ง {formattedPosition}</div>
                                {execApprover && isDeputy && settings?.showActingDirectorTitle !== false && (
                                  <div className="text-[11px] text-slate-500 whitespace-nowrap">
                                    {settings?.actingDirectorTitle || "รักษาการในตำแหน่งผู้อำนวยการโรงเรียน"}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div className="text-[11px] text-slate-500">วันที่ {request.execApproverId ? toThaiDateString(request.updatedAt) : "........./........../.........."}</div>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              );
            })()}

          </div>
        </div>

      </div>
    </div>
  );
}
