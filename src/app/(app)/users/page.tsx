"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { getAllUsers, updateUserProfile, deleteUser, approveUser, resetUserPasswordByAdmin, suspendUser, createUserByAdmin, importUsersByAdmin } from "@/app/actions/admin";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Shield, Trash2, Search, UserCog, ChevronDown, Key, Ban, UserX, CheckCircle, Plus, Upload, Download, Phone, MapPin, Fingerprint } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import * as XLSX from "xlsx";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; name: string } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [editingData, setEditingData] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addingData, setAddingData] = useState<any>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { t, lang, tPosition, tSubjectGroup, tLevel } = useI18n();
  const levelOptions = [
    "",
    "ครูผู้ช่วย",
    "ครู",
    "ครูชำนาญการ",
    "ครูชำนาญการพิเศษ",
    "ครูเชี่ยวชาญ",
    "ครูเชี่ยวชาญพิเศษ",
    "รองผู้อำนวยการชำนาญการ",
    "รองผู้อำนวยการชำนาญการพิเศษ",
    "รองผู้อำนวยการเชี่ยวชาญ",
    "ผู้อำนวยการชำนาญการ",
    "ผู้อำนวยการชำนาญการพิเศษ",
    "ผู้อำนวยการเชี่ยวชาญ",
    "ผู้อำนวยการเชี่ยวชาญพิเศษ",
  ];
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const loadUsers = () => {
    setLoading(true);
    getAllUsers()
      .then(setUsers)
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = users.map((u: any) => ({
        [lang === "en" ? "Login ID" : "ไอดีเข้าใช้งาน"]: u.username || "",
        [lang === "en" ? "Email" : "อีเมล"]: u.email || "",
        [lang === "en" ? "Full Name" : "ชื่อ-นามสกุล"]: u.name || "",
        [lang === "en" ? "Position" : "ตำแหน่ง"]: tPosition(u.position) || "",
        [lang === "en" ? "Subject Group" : "กลุ่มสาระ"]: tSubjectGroup(u.subjectGroup) || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, lang === "en" ? "Teacher List" : "รายชื่อครู");
      XLSX.writeFile(workbook, "teacher_list.xlsx");
    } catch (err: any) {
      alert(t("exportExcelError") + (err.message || err));
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = users.map((u: any) => ({
        [lang === "en" ? "Login ID" : "ไอดีเข้าใช้งาน"]: u.username || "",
        [lang === "en" ? "Email" : "อีเมล"]: u.email || "",
        [lang === "en" ? "Full Name" : "ชื่อ-นามสกุล"]: u.name || "",
        [lang === "en" ? "Position" : "ตำแหน่ง"]: tPosition(u.position) || "",
        [lang === "en" ? "Subject Group" : "กลุ่มสาระ"]: tSubjectGroup(u.subjectGroup) || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvOutput], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "teacher_list.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(t("exportCsvError") + (err.message || err));
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawData.length === 0) {
          alert(t("noDataInFile"));
          return;
        }

        const mappedUsers = rawData.map((row: any) => {
          let usernameVal = String(
            row["ไอดีเข้าใช้งาน"] || 
            row["username"] || 
            row["ID"] || 
            row["รหัสผู้ใช้"] || 
            row["Login ID"] ||
            ""
          ).trim();

          let emailVal = String(
            row["อีเมล"] || 
            row["email"] || 
            row["Email"] ||
            ""
          ).trim();

          // Auto map missing fields
          if (!emailVal && usernameVal) {
            if (usernameVal.includes("@")) {
              emailVal = usernameVal.toLowerCase();
              usernameVal = usernameVal.split("@")[0];
            } else {
              emailVal = `${usernameVal.toLowerCase()}@eleave.local`;
            }
          } else if (emailVal && !usernameVal) {
            usernameVal = emailVal.split("@")[0];
          }

          return {
            name: String(row["ชื่อ-นามสกุล"] || row["ชื่อ"] || row["name"] || row["Full Name"] || "").trim(),
            email: emailVal,
            username: usernameVal || undefined,
            position: row["ตำแหน่ง"] || row["position"] || row["Position"] ? String(row["ตำแหน่ง"] || row["position"] || row["Position"]).trim() : undefined,
            subjectGroup: row["กลุ่มสาระ"] || row["กลุ่มสาระฯ"] || row["subjectGroup"] || row["Subject Group"] ? String(row["กลุ่มสาระ"] || row["กลุ่มสาระฯ"] || row["subjectGroup"] || row["Subject Group"]).trim() : undefined,
          };
        });

        const validUsers = mappedUsers.filter(u => u.name && u.email);
        if (validUsers.length === 0) {
          alert(t("invalidImportFormat"));
          return;
        }

        const result = await importUsersByAdmin(validUsers);
        setImportResult(result);
        loadUsers();
      } catch (err: any) {
        alert(t("readImportFileError") + (err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  const handleSaveEdit = async () => {
    if (!editingData) return;
    const role = editingData.position === "แอดมิน" ? "ADMIN" : "TEACHER";
    await updateUserProfile(editingData.id, {
      name: editingData.name,
      email: editingData.email,
      username: editingData.username,
      role,
      position: editingData.position,
      subjectGroup: editingData.subjectGroup,
      level: editingData.level || ""
    });
    setEditingData(null);
    loadUsers();
  };

  const handleSaveAdd = async () => {
    if (!addingData) return;
    try {
      await createUserByAdmin({
        name: addingData.name,
        email: addingData.email,
        username: addingData.username,
        password: addingData.password,
        position: addingData.position,
        subjectGroup: addingData.subjectGroup,
        level: addingData.level || ""
      });
      setIsAddingUser(false);
      setAddingData(null);
      loadUsers();
    } catch (err: any) {
      alert(err.message || t("createUserError"));
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await approveUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
    } catch (err: any) {
      alert(t("approveUserError"));
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    const input = prompt(`${t("confirmDeleteUser")} "${name}"`);
    if (input !== name) {
      if (input !== null) alert(t("deleteUserCancelled"));
      return;
    }
    try {
      await deleteUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
      alert(t("deleteUserSuccess"));
    } catch (err: any) {
      alert(err.message || (lang === "en" ? "An error occurred" : "เกิดข้อผิดพลาด"));
    }
  };

  const handleReject = async (userId: string, name: string) => {
    if (!confirm(t("confirmRejectUser").replace("{name}", name))) return;
    try {
      await deleteUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
    } catch (err: any) {
      alert(err.message || (lang === "en" ? "An error occurred" : "เกิดข้อผิดพลาด"));
    }
  };

  const handleSuspend = async (userId: string, name: string) => {
    if (!confirm(t("confirmSuspendUser").replace("{name}", name))) return;
    try {
      await suspendUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
    } catch (err: any) {
      alert(err.message || (lang === "en" ? "An error occurred" : "เกิดข้อผิดพลาด"));
    }
  };

  const filteredUsers = users.filter(u =>
    !searchText ||
    u.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.position?.toLowerCase().includes(searchText.toLowerCase())
  );

  const positionOptions = ["ครู", "ลูกจ้างประจำ", "ลูกจ้างชั่วคราว", "นักศึกษาฝึกประสบการณ์", "ผู้ตรวจสอบ", "หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล", "รองผู้อำนวยการ", "ผู้อำนวยการ", "แอดมิน"];
  const subjectGroupOptions = [
    "วิทยาศาสตร์และเทคโนโลยี",
    "คณิตศาสตร์",
    "ภาษาไทย",
    "ภาษาต่างประเทศ",
    "สังคมศึกษา ศาสนา และวัฒนธรรม",
    "สุขศึกษาและพลศึกษา",
    "ศิลปะ",
    "การงานอาชีพ",
    "กิจกรรมพัฒนาผู้เรียน",
    "แอดมิน / ผู้อำนวยการ"
  ];

  const getPositionBadge = (position: string, role: string) => {
    if (role === "ADMIN" || position === "แอดมิน") return { text: tPosition("แอดมิน"), cls: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-800" };
    if (position === "ผู้อำนวยการ") return { text: tPosition("ผู้อำนวยการ"), cls: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800" };
    if (position === "รองผู้อำนวยการ") return { text: tPosition("รองผู้อำนวยการ"), cls: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-800" };
    if (position === "หัวหน้างานบุคคล") return { text: tPosition("หัวหน้างานบุคคล"), cls: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800" };
    if (position === "เจ้าหน้าที่บุคคล") return { text: tPosition("เจ้าหน้าที่บุคคล"), cls: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-800" };
    if (position === "ผู้ตรวจสอบ") return { text: tPosition("ผู้ตรวจสอบ"), cls: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800" };
    if (position === "นักศึกษาฝึกประสบการณ์") return { text: tPosition("นักศึกษาฝึกประสบการณ์"), cls: "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-800" };
    return { text: tPosition(position || "ครู"), cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("usersTitle")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("usersSubtitle")} • {users.length} {t("persons")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {lang === "en" ? "Export to Excel" : "ส่งออกเป็น Excel"}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {t("exportCsvBtn")}
          </button>
          
          <button
            onClick={() => {
              const fileInput = document.getElementById("import-file-input");
              if (fileInput) fileInput.click();
            }}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {t("importTeacherDataTitle")}
          </button>
          <input
            id="import-file-input"
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            onClick={() => {
              setIsAddingUser(true);
              setAddingData({ name: "", email: "", username: "", password: "", position: "ครู", subjectGroup: "", level: "" });
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("addUser")}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-3 border-purple-200 border-t-purple-500 rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("user")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("loginIdCol")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("email")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("position")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("subjectGroup")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("registeredDateCol")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("lastLoginCol")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-right">{t("manage")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(() => {
                  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                  return paginatedUsers.map((user) => {
                    const badge = getPositionBadge(user.position, user.role);
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {user.image ? (
                              <img 
                                src={user.image} 
                                alt={user.name} 
                                onClick={() => setZoomedImage({ src: user.image, name: user.name })}
                                className="w-9 h-9 rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-700 cursor-zoom-in hover:opacity-90 transition-opacity" 
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                {user.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white block">{user.name || "-"}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span title={user.hasPhone ? (lang === "en" ? "Phone number provided" : "เบอร์โทรศัพท์ (บันทึกแล้ว)") : (lang === "en" ? "No phone number" : "เบอร์โทรศัพท์ (ยังไม่มี)")}>
                                  <Phone className={`w-3.5 h-3.5 ${user.hasPhone ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                                </span>
                                <span title={user.hasAddress ? (lang === "en" ? "Address provided" : "ที่อยู่ (บันทึกแล้ว)") : (lang === "en" ? "No address" : "ที่อยู่ (ยังไม่มี)")}>
                                  <MapPin className={`w-3.5 h-3.5 ${user.hasAddress ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                                </span>
                                <span title={user.hasSignature ? (lang === "en" ? "Signature provided" : "ลายเซ็น (บันทึกแล้ว)") : (lang === "en" ? "No signature" : "ลายเซ็น (ยังไม่มี)")}>
                                  <Fingerprint className={`w-3.5 h-3.5 ${user.hasSignature ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-900 dark:text-white text-xs font-semibold">{user.username || "-"}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{tSubjectGroup(user.subjectGroup) || "-"}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {new Date(user.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US")}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {user.lastLogin ? (
                            <>
                              <span className="block font-medium text-slate-700 dark:text-slate-300">
                                {new Date(user.lastLogin).toLocaleDateString(lang === "th" ? "th-TH" : "en-US")}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {new Date(user.lastLogin).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                                {lang === "th" ? " น." : ""}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                          {!user.isApproved ? (
                            <>
                              <button
                                onClick={() => handleApprove(user.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> {t("approve")}
                              </button>
                              <button
                                onClick={() => handleReject(user.id, user.name)}
                                className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <UserX className="w-3.5 h-3.5" /> {t("reject")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleSuspend(user.id, user.name)}
                                className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors cursor-pointer"
                                title={t("suspendUser")}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingData(user)}
                                className="p-2 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors cursor-pointer"
                                title={t("editUser")}
                              >
                                <UserCog className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setResettingId(user.id);
                                  setNewPassword("");
                                }}
                                className="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title={t("resetPassword")}
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(user.id, user.name)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title={t("deleteUser")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {!loading && filteredUsers.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] mt-4">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            {lang === "en" ? "Showing" : "แสดง"} {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} {lang === "en" ? "of" : "จาก"} {filteredUsers.length} {lang === "en" ? "users" : "คน"}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-855 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm cursor-pointer"
            >
              {lang === "en" ? "Previous" : "ก่อนหน้า"}
            </button>

            {(() => {
              const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
              return [...Array(totalPages)].map((_, index) => {
                const pageNum = index + 1;
                if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className="px-1 text-xs text-slate-400 dark:text-slate-600">...</span>;
                  }
                  return null;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === pageNum
                      ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                      : "border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-855 text-slate-700 dark:text-slate-300 shadow-sm"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              });
            })()}

            <button
              onClick={() => {
                const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
                setCurrentPage(prev => Math.min(prev + 1, totalPages));
              }}
              disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-855 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm cursor-pointer"
            >
              {lang === "en" ? "Next" : "ถัดไป"}
            </button>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              {t("resetPasswordTitle")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("resetPasswordDesc")}
            </p>

            <input
              type="text"
              placeholder={t("newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-4 mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-all"
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setResettingId(null);
                  setNewPassword("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUser = users.find(u => u.id === resettingId);
                  if (targetUser) {
                    if (!confirm(t("confirmResetPasswordByAdmin").replace("{name}", targetUser.name))) return;
                    resetUserPasswordByAdmin(resettingId, newPassword)
                      .then(() => {
                        alert(t("resetPasswordSuccessAlert"));
                        setResettingId(null);
                        setNewPassword("");
                      })
                      .catch((err) => {
                        alert(err.message || (lang === "en" ? "An error occurred" : "เกิดข้อผิดพลาด"));
                      });
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                {t("saveNewPassword")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-purple-500" />
              {t("editUserModalTitle")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("fullNameLabel")}</label>
                <input
                  type="text"
                  value={editingData.name || ""}
                  onChange={e => setEditingData({ ...editingData, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("usernameLabel")}</label>
                <input
                  type="text"
                  value={editingData.username || ""}
                  onChange={e => setEditingData({ ...editingData, username: e.target.value })}
                  placeholder={t("usernameEditPlaceholder")}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("email")}</label>
                <input
                  type="text"
                  value={editingData.email || ""}
                  onChange={e => setEditingData({ ...editingData, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("positionLabel")}</label>
                <select
                  value={editingData.position || "ครู"}
                  onChange={e => setEditingData({ ...editingData, position: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30"
                >
                  {positionOptions.map(p => <option key={p} value={p}>{tPosition(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("departmentLabel")}</label>
                <select
                  value={editingData.subjectGroup || ""}
                  onChange={e => setEditingData({ ...editingData, subjectGroup: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  <option value="">{t("selectDepartmentPlaceholder")}</option>
                  {subjectGroupOptions.map(sg => <option key={sg} value={sg}>{tSubjectGroup(sg)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === "en" ? "Level" : "ระดับ"}</label>
                <select
                  value={editingData.level || ""}
                  onChange={e => setEditingData({ ...editingData, level: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  {levelOptions.map(lvl => <option key={lvl} value={lvl}>{tLevel(lvl)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingData(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                {t("saveData")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddingUser && addingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              {t("addUserModalTitle")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("fullNameLabel")}</label>
                <input
                  type="text"
                  value={addingData.name || ""}
                  onChange={e => setAddingData({ ...addingData, name: e.target.value })}
                  placeholder={t("fullNamePlaceholder")}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("usernameLabel")}</label>
                <input
                  type="text"
                  value={addingData.username || ""}
                  onChange={e => setAddingData({ ...addingData, username: e.target.value })}
                  placeholder={t("usernamePlaceholderText")}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("email")}</label>
                <input
                  type="text"
                  value={addingData.email || ""}
                  onChange={e => setAddingData({ ...addingData, email: e.target.value })}
                  placeholder={t("emailPlaceholder")}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("passwordAddPlaceholder")}</label>
                <input
                  type="password"
                  value={addingData.password || ""}
                  onChange={e => setAddingData({ ...addingData, password: e.target.value })}
                  placeholder="******"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("positionLabel")}</label>
                <select
                  value={addingData.position || "ครู"}
                  onChange={e => setAddingData({ ...addingData, position: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-855 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  {positionOptions.map(p => <option key={p} value={p}>{tPosition(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("departmentLabel")}</label>
                <select
                  value={addingData.subjectGroup || ""}
                  onChange={e => setAddingData({ ...addingData, subjectGroup: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-855 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  <option value="">{t("selectDepartmentPlaceholder")}</option>
                  {subjectGroupOptions.map(sg => <option key={sg} value={sg}>{tSubjectGroup(sg)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === "en" ? "Level" : "ระดับ"}</label>
                <select
                  value={addingData.level || ""}
                  onChange={e => setAddingData({ ...addingData, level: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-855 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  {levelOptions.map(lvl => <option key={lvl} value={lvl}>{tLevel(lvl)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setIsAddingUser(false);
                  setAddingData(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSaveAdd}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                {t("addUserBtn")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              {t("importTeacherResultTitle")}
            </h3>
            
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-center border border-emerald-100 dark:border-emerald-950">
                <span className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t("importResultCreated")}</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{importResult.created}</span>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl text-center border border-blue-100 dark:border-blue-950">
                <span className="block text-xs font-semibold text-blue-600 dark:text-blue-400">{t("importResultUpdated")}</span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{importResult.updated}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center border border-slate-200 dark:border-slate-700">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{t("importResultSkipped")}</span>
                <span className="text-xl font-bold text-slate-700 dark:text-slate-300">{importResult.skipped}</span>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-4">
                <span className="block text-xs font-semibold text-rose-500 mb-1">{t("importResultErrorsHeader")}</span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950 text-xs text-rose-600 dark:text-rose-400">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="flex gap-1.5">
                      <span>•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setImportResult(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {t("closeModalBtn")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Zoomed Image Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-md cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-2xl max-h-[85vh] overflow-hidden flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={zoomedImage.src} 
                alt={zoomedImage.name} 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl border border-white/10 shadow-2xl"
              />
              <div className="mt-3 text-center text-white font-bold text-sm bg-slate-900/60 backdrop-blur-md py-1.5 px-4 rounded-full border border-white/10">
                {zoomedImage.name}
              </div>
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white flex items-center justify-center font-bold text-sm cursor-pointer border border-white/10"
              >
                ✕
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
