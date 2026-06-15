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
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
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
            
            {/* Embedded styles for Sarabun font and exact A4 formatting */}
            <style jsx global>{`
              @font-face {
  font-family: 'Sarabun';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff2;base64,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) format('woff2');
}
@font-face {
  font-family: 'Sarabun';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(data:font/woff2;base64,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) format('woff2');
}
              
              .print-container {
                font-family: 'Sarabun', sans-serif !important;
                line-height: 1.5 !important;
                font-size: 11.5pt !important; /* adjusted body font size down to 11.5pt */
                color: #000 !important;
                letter-spacing: normal !important;
                font-feature-settings: "kern" on, "liga" on !important;
                text-rendering: optimizeLegibility !important;
              }
              
              .print-container h1, .print-container h2, .print-container h3,
              .print-container p, .print-container div, .print-container span,
              .print-container td, .print-container th {
                font-family: 'Sarabun', sans-serif !important;
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
                <div className="space-y-2 text-justify relative">
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
                  <div className="w-full mt-2 text-justify leading-relaxed indent-12">
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
                      <div className="w-full text-justify leading-relaxed">
                        <span>ไปช่วยเหลือภริยาโดยชอบด้วยกฎหมายชื่อ </span>
                        <span className={wifeName ? "form-line-dotted-inline px-2 font-semibold" : "form-line-dotted px-2 min-w-[200px]"}>{wifeName || "-"}</span>
                      </div>
                      <div className="w-full text-justify leading-relaxed">
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
                            <div className="w-full text-justify leading-relaxed">
                              <span>อุปสมบท ณ วัด </span>
                              <span className={templeName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{templeName || "-"}</span>
                              <span> ตั้งอยู่ ณ </span>
                              <span className={templeLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{templeLocation || "-"}</span>
                            </div>
                            <div className="w-full text-justify leading-relaxed">
                              <span>จะจำพรรษาอยู่วัด </span>
                              <span className={resideTempleName ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{resideTempleName || "-"}</span>
                              <span> ตั้งอยู่ ณ </span>
                              <span className={resideTempleLocation ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[200px]"}>{resideTempleLocation || "-"}</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full text-justify leading-relaxed">
                            <span>เดินทางไปประกอบพิธีฮัจญ์/อุปสมบท กำหนดเดินทางวันที่ </span>
                            <span className="form-line-dotted w-36 text-center">{ordinationDate ? toThaiDateString(ordinationDate) : "-"}</span>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Military Info Sub-block */}
                  {leaveType === "MILITARY" && (
                    <div className="space-y-1.5 my-1 text-sm">
                      <div className="w-full text-justify leading-relaxed">
                        <span>ได้รับหมายเรียกของ </span>
                        <span className={militaryOrderSource ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{militaryOrderSource || "-"}</span>
                        <span> ที่ </span>
                        <span className={militaryOrderNo ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[100px]"}>{militaryOrderNo || "-"}</span>
                        <span> ลงวันที่ </span>
                        <span className={militaryOrderDate ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[120px]"}>{militaryOrderDate ? toThaiDateStringShort(militaryOrderDate) : "-"}</span>
                      </div>
                      <div className="w-full text-justify leading-relaxed">
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
                      <div className="w-full text-justify leading-relaxed">
                        <span>ได้รับเงินเดือนเดือนละ </span>
                        <span className="form-line-dotted w-24 text-center">{userSalary}</span>
                        <span> บาท ไปศึกษาต่อ/ฝึกอบรม ณ ประเทศ </span>
                        <span className={studyCountry ? "form-line-dotted-inline px-2" : "form-line-dotted px-2 min-w-[150px]"}>{studyCountry || "-"}</span>
                      </div>
                      <div className="w-full text-justify leading-relaxed">
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
                  <div className="w-full text-justify leading-relaxed mt-1.5">
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
                  <div className="w-full text-justify leading-relaxed mt-1.5">
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

                  <div className="w-full text-justify leading-relaxed mt-1.5">
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
                  <div className="w-full mt-1.5 text-justify leading-relaxed">
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
