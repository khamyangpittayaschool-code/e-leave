"use client";

import { useState, useEffect } from "react";
import { getAllUsers, updateUserProfile, deleteUser, approveUser, resetUserPasswordByAdmin, suspendUser, createUserByAdmin } from "@/app/actions/admin";
import { motion } from "framer-motion";
import { Users, Shield, Trash2, Search, UserCog, ChevronDown, Key, Ban, UserX, CheckCircle, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [editingData, setEditingData] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addingData, setAddingData] = useState<any>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { t, lang, tPosition } = useI18n();

  const loadUsers = () => {
    setLoading(true);
    getAllUsers()
      .then(setUsers)
      .catch(() => { })
      .finally(() => setLoading(false));
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
      role,
      position: editingData.position,
      subjectGroup: editingData.subjectGroup
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
        password: addingData.password,
        position: addingData.position,
        subjectGroup: addingData.subjectGroup
      });
      setIsAddingUser(false);
      setAddingData(null);
      loadUsers();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการสร้างบัญชี");
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await approveUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการอนุมัติผู้ใช้");
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    const input = prompt(`⚠️ อันตราย: การลบผู้ใช้จะลบประวัติการลาทั้งหมดด้วย!\nหากต้องการลบ กรุณาพิมพ์ชื่อผู้ใช้ให้ตรงกัน: "${name}"`);
    if (input !== name) {
      if (input !== null) alert("ยกเลิกการลบ (พิมพ์ชื่อไม่ถูกต้อง)");
      return;
    }
    try {
      await deleteUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
      alert("ลบผู้ใช้สำเร็จ");
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleReject = async (userId: string, name: string) => {
    if (!confirm(`คุณต้องการปฏิเสธคำขอและลบบัญชี "${name}" ออกจากระบบใช่หรือไม่?`)) return;
    try {
      await deleteUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleSuspend = async (userId: string, name: string) => {
    if (!confirm(`คุณต้องการระงับการใช้งานบัญชี "${name}" ใช่หรือไม่?\nผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบได้อีกจนกว่าจะได้รับการอนุมัติใหม่`)) return;
    try {
      await suspendUser(userId);
      loadUsers();
      window.dispatchEvent(new Event("noti-refresh"));
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const filteredUsers = users.filter(u =>
    !searchText ||
    u.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchText.toLowerCase()) ||
    u.position?.toLowerCase().includes(searchText.toLowerCase())
  );

  const positionOptions = ["ครู", "หัวหน้างานบุคคล", "ผู้บริหาร", "แอดมิน"];
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
    "แอดมิน / ผู้บริหาร"
  ];

  const getPositionBadge = (position: string, role: string) => {
    if (role === "ADMIN" || position === "แอดมิน") return { text: "แอดมิน", cls: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-800" };
    if (position === "ผู้บริหาร") return { text: "ผู้บริหาร", cls: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800" };
    if (position === "หัวหน้างานบุคคล") return { text: "หัวหน้างานบุคคล", cls: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800" };
    return { text: position || "ครู", cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" };
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
        <button
          onClick={() => {
            setIsAddingUser(true);
            setAddingData({ name: "", email: "", password: "", position: "ครู", subjectGroup: "" });
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {t("addUser")}
        </button>
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
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("email")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("position")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("subjectGroup")}</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">{t("registeredDate")}</th>
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
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                              {user.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{user.name || "-"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{user.subjectGroup || "-"}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {new Date(user.createdAt).toLocaleDateString("th-TH")}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                          {!user.isApproved ? (
                            <>
                              <button
                                onClick={() => handleApprove(user.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> อนุมัติ
                              </button>
                              <button
                                onClick={() => handleReject(user.id, user.name)}
                                className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <UserX className="w-3.5 h-3.5" /> ปฏิเสธ
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleSuspend(user.id, user.name)}
                                className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                                title="ระงับการใช้งาน"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingData(user)}
                                className="p-2 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                title="แก้ไขผู้ใช้"
                              >
                                <UserCog className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setResettingId(user.id);
                                  setNewPassword("");
                                }}
                                className="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                title="รีเซ็ตรหัสผ่าน"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(user.id, user.name)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                title="ลบผู้ใช้ (อันตราย)"
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
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
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
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${currentPage === pageNum
                      ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                      : "border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 shadow-sm"
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
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
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
              รีเซ็ตรหัสผ่านผู้ใช้งาน
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ระบุรหัสผ่านใหม่สำหรับผู้ใช้คนนี้ (ขั้นต่ำ 6 ตัวอักษร)
            </p>

            <input
              type="text"
              placeholder="รหัสผ่านใหม่"
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUser = users.find(u => u.id === resettingId);
                  if (targetUser) {
                    if (!confirm(`คุณแน่ใจว่าต้องการตั้งรหัสผ่านใหม่ให้กับ "${targetUser.name}" ใช่หรือไม่?`)) return;
                    resetUserPasswordByAdmin(resettingId, newPassword)
                      .then(() => {
                        alert("รีเซ็ตรหัสผ่านสำเร็จ!");
                        setResettingId(null);
                        setNewPassword("");
                      })
                      .catch((err) => {
                        alert(err.message || "เกิดข้อผิดพลาด");
                      });
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-white shadow-md shadow-amber-500/20 transition-all"
              >
                บันทึกรหัสผ่านใหม่
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
              แก้ไขข้อมูลผู้ใช้
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ - นามสกุล</label>
                <input
                  type="text"
                  value={editingData.name || ""}
                  onChange={e => setEditingData({ ...editingData, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={editingData.email || ""}
                  onChange={e => setEditingData({ ...editingData, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ตำแหน่ง/หน้าที่</label>
                <select
                  value={editingData.position || "ครู"}
                  onChange={e => setEditingData({ ...editingData, position: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30"
                >
                  {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">กลุ่มสาระฯ (หมวด)</label>
                <select
                  value={editingData.subjectGroup || ""}
                  onChange={e => setEditingData({ ...editingData, subjectGroup: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {subjectGroupOptions.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingData(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all"
              >
                บันทึกข้อมูล
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
              เพิ่มบัญชีผู้ใช้ใหม่
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ - นามสกุล</label>
                <input
                  type="text"
                  value={addingData.name || ""}
                  onChange={e => setAddingData({ ...addingData, name: e.target.value })}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={addingData.email || ""}
                  onChange={e => setAddingData({ ...addingData, email: e.target.value })}
                  placeholder="เช่น somchai@gmail.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">รหัสผ่าน (เว้นว่างไว้สำหรับค่าเริ่มต้น: 123456)</label>
                <input
                  type="password"
                  value={addingData.password || ""}
                  onChange={e => setAddingData({ ...addingData, password: e.target.value })}
                  placeholder="******"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ตำแหน่ง/หน้าที่</label>
                <select
                  value={addingData.position || "ครู"}
                  onChange={e => setAddingData({ ...addingData, position: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">กลุ่มสาระฯ (หมวด)</label>
                <select
                  value={addingData.subjectGroup || ""}
                  onChange={e => setAddingData({ ...addingData, subjectGroup: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {subjectGroupOptions.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setIsAddingUser(false);
                  setAddingData(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveAdd}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all"
              >
                เพิ่มผู้ใช้
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
