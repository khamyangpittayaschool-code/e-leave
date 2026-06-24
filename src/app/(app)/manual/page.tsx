"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, 
  Download, 
  Users, 
  ShieldAlert, 
  LogIn, 
  FileText, 
  History, 
  CheckSquare, 
  FileSpreadsheet, 
  Settings, 
  X, 
  ZoomIn 
} from "lucide-react";

interface Step {
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  images: string[];
  icon: any;
}

export default function ManualPage() {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<"staff" | "admin">("staff");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const staffSteps: Step[] = [
    {
      titleTh: "1. สมัครสมาชิก & เข้าสู่ระบบ",
      titleEn: "1. Register & Login",
      descTh: "ลงทะเบียนสมาชิกใหม่ด้วยชื่อ-นามสกุลจริง กำหนดตำแหน่ง และกลุ่มสาระการเรียนรู้ จากนั้นเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้",
      descEn: "Register a new account with your real name, position, and subject group. Then log in with your registered email and password.",
      images: ["/manual/สมัครสมาชิก.jpg", "/manual/Login.jpg"],
      icon: LogIn
    },
    {
      titleTh: "2. หน้าแรกและแดชบอร์ดข้อมูล",
      titleEn: "2. Dashboard Overview",
      descTh: "เข้าสู่ระบบมาแล้วจะพบกับสถิติภาพรวมข้อมูลโควตาวันลาสะสมของคุณ รวมถึงวันลาคงเหลือแยกตามประเภท (ลาป่วย/ลากิจ/ลาพักร้อน) และสถิติแนวโน้มการลาประจำปี",
      descEn: "Once logged in, view your leave quota summary, remaining days by category (sick/personal/vacation), and leave trend charts.",
      images: ["/manual/dashboard.jpg"],
      icon: FileSpreadsheet
    },
    {
      titleTh: "3. ส่งใบลาออนไลน์",
      titleEn: "3. Submit Leave Request",
      descTh: "เข้าสู่เมนู 'ขอลา' เพื่อทำรายการ กรอกรายละเอียดประเภทการลา วันที่ต้องการลา เหตุผล และหากมีเอกสารรับรองแพทย์ (เช่น ลาป่วยเกิน 3 วัน) สามารถอัปโหลดไฟล์แนบเพิ่มเติมได้",
      descEn: "Go to 'Request Leave' menu. Select your leave type, dates, reason, and upload supporting files/medical certificates if necessary.",
      images: ["/manual/ขอลา.jpg"],
      icon: FileText
    },
    {
      titleTh: "4. ประวัติวันลา & ข้อมูลส่วนตัว",
      titleEn: "4. History & Profile Settings",
      descTh: "ตรวจสอบสถานะการอนุมัติคำขอลาที่ผ่านๆ มาในเมนู 'ประวัติ' และสามารถเข้าแก้ไขภาพโปรไฟล์หรือเซ็นชื่ออิเล็กทรอนิกส์ในหน้า 'โปรไฟล์ของฉัน' เพื่อนำไปใช้ลงนามบนใบลาพิมพ์ส่งโรงเรียน",
      descEn: "Monitor leave request statuses under 'History' and update your profile picture or draw your digital signature under 'My Profile' for reports printout.",
      images: ["/manual/ประวัติ.jpg", "/manual/Profile.jpg"],
      icon: History
    }
  ];

  const adminSteps: Step[] = [
    {
      titleTh: "1. การอนุมัติใบลาออนไลน์",
      titleEn: "1. Leave Request Approval",
      descTh: "ผู้มีอำนาจอนุมัติ (เช่น หัวหน้างานบุคคล หรือ ผู้อำนวยการ) สามารถกดปุ่ม 'อนุมัติ' เพื่อพิจารณาตรวจสอบรายละเอียดใบลา ความสมเหตุสมผล และกดยืนยันการอนุมัติหรือปฏิเสธพร้อมบันทึกหมายเหตุเพิ่มเติม",
      descEn: "Authorized personnel (e.g., HR heads or Directors) can view the 'Approvals' page to review, write remarks, and approve or reject leave requests.",
      images: ["/manual/อนุมัติ.jpg"],
      icon: CheckSquare
    },
    {
      titleTh: "2. การอนุมัติและจัดการข้อมูลผู้ใช้",
      titleEn: "2. Manage Staff Users",
      descTh: "แอดมินสามารถอนุมัติบัญชีสมัครใหม่ของบุคลากรภายในโรงเรียนเพื่อเปิดสิทธิ์เข้าใช้งาน, เปลี่ยนแปลงตำแหน่งสิทธิ์การอนุมัติ, และระงับบัญชี หรือรีเซ็ตรหัสผ่านให้แก่บุคลากรได้ทันที",
      descEn: "Admins can approve pending registrations to grant access, change roles/positions, suspend accounts, and reset passwords for staff.",
      images: ["/manual/User.jpg"],
      icon: Users
    },
    {
      titleTh: "3. ออกรายงานและสถิติภาพรวม",
      titleEn: "3. Leave History Reports",
      descTh: "แอดมินหรือเจ้าหน้าที่บุคคลสามารถดูรายงานสรุปยอดวันลาสะสม สถิติการหยุดงานแยกเป็นบุคคลหรือกลุ่มสาระ พร้อมดาวน์โหลดในรูปแบบไฟล์ Excel หรือ CSV เพื่อใช้ประเมินขั้นเลื่อนเงินเดือน",
      descEn: "Admins or HR staff can view leave summaries, filter by subject group or person, and export reports in Excel or CSV format.",
      images: ["/manual/รายงาน.jpg"],
      icon: FileText
    },
    {
      titleTh: "4. ตั้งค่าระบบโรงเรียนและเกณฑ์รอบการลา",
      titleEn: "4. System Settings & Policy Rules",
      descTh: "กำหนดชื่อโรงเรียน, อัปโหลดโลโก้โรงเรียนสำหรับหัวกระดาษรายงาน, ตั้งค่ารอบการประเมินการลา (รอบที่ 1 และ 2 ของปีงบประมาณ) และระบุผู้อนุมัติคนสุดท้ายของสถานศึกษา",
      descEn: "Configure school name, upload institutional logo, set fiscal leave evaluation cycles (Cycle 1 & 2), and configure final system approvers.",
      images: ["/manual/Setting.jpg"],
      icon: Settings
    }
  ];

  const activeSteps = activeTab === "staff" ? staffSteps : adminSteps;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {lang === "en" ? "User Manual" : "คู่มือการใช้งานระบบลาออนไลน์"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === "en" ? "Step-by-step guidelines and documentation" : "ขั้นตอนแนะนำการใช้งานฟังก์ชันต่างๆ ของระบบ"}
            </p>
          </div>
        </div>

        {/* PDF Download Button */}
        <a
          href="/manual/e-Leave_User_Guide.pdf"
          download
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shrink-0 cursor-pointer font-sans"
        >
          <Download className="w-4 h-4" />
          {lang === "en" ? "Download Full PDF Guide" : "ดาวน์โหลดคู่มือไฟล์ PDF"}
        </a>
      </div>

      {/* Interactive Tabs */}
      <div className="flex p-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl max-w-md border border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
            activeTab === "staff"
              ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          {lang === "en" ? "For General Staff" : "สำหรับบุคลากรทั่วไป"}
        </button>
        <button
          onClick={() => setActiveTab("admin")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
            activeTab === "admin"
              ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          {lang === "en" ? "For Admins & Approvers" : "สำหรับผู้อนุมัติ & แอดมิน"}
        </button>
      </div>

      {/* Steps List */}
      <div className="space-y-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-8"
          >
            {activeSteps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col lg:flex-row gap-8 items-start"
                >
                  {/* Step Description Card */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {lang === "en" ? step.titleEn : step.titleTh}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {lang === "en" ? step.descEn : step.descTh}
                    </p>
                  </div>

                  {/* Images Grid */}
                  <div className="w-full lg:w-[480px] shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {step.images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedImage(img)}
                        className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-zoom-in aspect-video shadow-sm"
                      >
                        <img
                          src={img}
                          alt={lang === "en" ? step.titleEn : step.titleTh}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white">
                          <ZoomIn className="w-6 h-6 transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lightbox / Zoom Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              src={selectedImage}
              alt="Zoomed Manual Preview"
              className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
