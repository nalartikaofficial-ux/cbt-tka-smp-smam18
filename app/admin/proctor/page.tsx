"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Users,
    Award,
    Activity,
    PlusCircle,
    RefreshCw,
    Search,
    CheckCircle2,
    AlertTriangle,
    ChevronLeft,
    Trash2,
    Pencil,
    X,
    RotateCcw,
    Clock,
    KeyRound,
    Save,
    FastForward,
    Printer,
    FileText,
    Copy,
    Check,
    FileSpreadsheet,
    LogOut,
    LockKeyhole,
    LockKeyholeOpen
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface StudentItem {
    nisn: string;
    nama: string;
    kelas: string;
    asalSekolah?: string;
    status: string;
    violations: number;
    score: number;
    bindoScore: number;
    mtkScore: number;
    waktu_selesai?: string;
}

export interface MasterSession {
    paket_aktif: "PAKET_1" | "PAKET_2" | "PAKET_3";
    nama_paket: string;
    token_resmi: string;
    status_akses: "DIBUKA" | "TERKUNCI" | "SELESAI";
    waktu_mulai: string;
    waktu_selesai: string;
    durasi_bindo_detik: number;
    durasi_mtk_detik: number;
}

function getKepmendikdasmen56Badge(score: number, subject: "BINDO" | "MTK" = "BINDO") {
    const num = Number(score) || 0;
    const isMtk = subject === "MTK";
    const baikCutOff = isMtk ? 56.67 : 76.67;
    const memadaiCutOff = isMtk ? 33.33 : 50.0;

    if (num >= 95.0) {
        return { label: "Istimewa", color: "bg-indigo-100 text-indigo-800 border-indigo-300" };
    }
    if (num >= baikCutOff) {
        return { label: "Baik", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    }
    if (num >= memadaiCutOff) {
        return { label: "Memadai", color: "bg-blue-100 text-blue-800 border-blue-300" };
    }
    return { label: "Kurang", color: "bg-rose-100 text-rose-800 border-rose-300" };
}

function formatScoreID(score: number): string {
    return (Number(score) || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function normalizePhoneOrId(raw: string): string {
    let digits = raw.replace(/\D/g, "").trim();
    if (digits.startsWith("62")) {
        digits = "0" + digits.slice(2);
    }
    return digits;
}

export default function ProctorMasterDashboard() {
    const router = useRouter();

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentProctor, setCurrentProctor] = useState<{ nama: string; role: string }>({
        nama: "Fadhillah Umar, S.Pd.",
        role: "proctor"
    });

    const [activeTab, setActiveTab] = useState<"students" | "monitor" | "bap" | "scores">("monitor");
    const [students, setStudents] = useState<StudentItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [filterKelas, setFilterKelas] = useState<string>("ALL");
    const [tokenCopied, setTokenCopied] = useState(false);

    const [masterSession, setMasterSession] = useState<MasterSession>({
        paket_aktif: "PAKET_1",
        nama_paket: "Tryout Terstandarisasi TKA Jenjang SMP (30 BINDO & 30 MTK) 2026",
        token_resmi: "TKA18",
        status_akses: "DIBUKA",
        waktu_mulai: "2026-11-20T07:30",
        waktu_selesai: "2026-11-20T11:30",
        durasi_bindo_detik: 4500,
        durasi_mtk_detik: 4500
    });
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [customMinutes, setCustomMinutes] = useState<number>(5);

    const [newNisn, setNewNisn] = useState("");
    const [newNama, setNewNama] = useState("");
    const [newKelas, setNewKelas] = useState("");
    const [newTingkat, setNewTingkat] = useState("9");
    const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkRawText, setBulkRawText] = useState("");
    const [isBulkImporting, setIsBulkImporting] = useState(false);

    const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
    const [editNisn, setEditNisn] = useState("");
    const [editNama, setEditNama] = useState("");
    const [editKelas, setEditKelas] = useState("");
    const [editTingkat, setEditTingkat] = useState("9");
    const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

    const [bapData, setBapData] = useState({
        nomorSurat: "118/BAP-TKA-SMP/SMA-M18/2026",
        ruangUjian: "Laboratorium Komputer CBT SMA Muhammadiyah 18 Jakarta",
        catatanKhusus:
            "Pelaksanaan Tryout Tes Kemampuan Akademik (TKA) Jenjang SMP (60 Soal: Bahasa Indonesia & Matematika) berjalan tertib dan lancar sesuai standar Kepmendikdasmen No. 56 Tahun 2026.",
        kepalaSekolahNama: "Drs. H. Ahmad Dahlan, M.Pd.",
        kepalaSekolahNbm: "882.118.001",
        pengawasNama: "Fadhillah Umar, S.Pd.",
        pengawasNbm: "118.2026.091",
        isManualHadir: false,
        manualHadir: 0,
        manualTidakHadir: 0
    });

    const fetchMasterSession = async () => {
        try {
            const { data, error } = await supabase
                .from("tka_sessions")
                .select("*")
                .eq("id", 1)
                .single();

            if (!error && data) {
                setMasterSession({
                    paket_aktif: (data.paket_aktif as any) || "PAKET_1",
                    nama_paket: data.nama_paket || "Tryout Terstandarisasi TKA Jenjang SMP (30 BINDO & 30 MTK) 2026",
                    token_resmi: data.token_resmi || "TKA18",
                    status_akses: (data.status_akses as any) || "DIBUKA",
                    waktu_mulai: data.waktu_mulai ? String(data.waktu_mulai).substring(0, 16) : "2026-11-20T07:30",
                    waktu_selesai: data.waktu_selesai ? String(data.waktu_selesai).substring(0, 16) : "2026-11-20T11:30",
                    durasi_bindo_detik: Number(data?.durasi_bindo_detik ?? 4500),
                    durasi_mtk_detik: Number(data?.durasi_mtk_detik ?? 4500)
                });
            }
        } catch (err) {
            console.error("Gagal ambil jadwal dari Supabase:", err);
        }
    };

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            await fetchStudentsSilently();
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStudentsSilently = async () => {
        try {
            const { data, error } = await supabase
                .from("tka_students")
                .select("*")
                .order("created_at", { ascending: false });

            if (!error && Array.isArray(data)) {
                const cleanList: StudentItem[] = data.map((item: any) => {
                    const scoreVal = Number(item.score ?? 0);
                    const bindoVal = Number(item.bindo_score ?? scoreVal);
                    const mtkVal = Number(item.mtk_score ?? scoreVal);

                    return {
                        nisn: String(item.phone || "").replace(/\D/g, "").trim(),
                        nama: String(item.name || "").toUpperCase().trim(),
                        kelas: String(item.grade || "9").trim(),
                        asalSekolah: String(item.school || "").toUpperCase().trim(),
                        status: String(item.status || (scoreVal > 0 ? "Selesai" : "Belum Hadir")).trim(),
                        violations: Number(item.violations || 0),
                        score: scoreVal,
                        bindoScore: bindoVal,
                        mtkScore: mtkVal,
                        waktu_selesai: String(item.waktu_selesai || "-").trim()
                    };
                });
                setStudents(cleanList);
            }
        } catch (err) {
            console.error("Gagal polling data siswa dari Supabase:", err);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const raw = sessionStorage.getItem("logged_user");
            if (!raw) {
                setIsAuthorized(true);
                fetchMasterSession();
                fetchStudents();
                return;
            }

            try {
                const user = JSON.parse(raw);
                if (user.role === "admin" || user.role === "proctor") {
                    setCurrentProctor(user);
                    setBapData((prev) => ({
                        ...prev,
                        pengawasNama: user.nama || "Fadhillah Umar, S.Pd."
                    }));
                    setIsAuthorized(true);
                    fetchMasterSession();
                    fetchStudents();
                } else {
                    alert("Akses Dibatasi: Khusus Proktor Pengawas & Administrator.");
                    router.replace("/admin");
                }
            } catch {
                router.replace("/admin");
            }
        }
    }, [router]);

    useEffect(() => {
        if (!isAuthorized) return;
        const interval = setInterval(() => {
            fetchStudentsSilently();
        }, 5000);

        return () => clearInterval(interval);
    }, [isAuthorized]);

    const generateRandomToken = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let result = "TK";
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setMasterSession((prev) => ({ ...prev, token_resmi: result }));
    };

    const copyToken = () => {
        navigator.clipboard.writeText(masterSession.token_resmi);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
    };

    const handleUpdateSchedule = async (e?: React.FormEvent, customPayload?: Partial<MasterSession>) => {
        if (e) e.preventDefault();
        setIsSavingSchedule(true);

        const updatedSession = {
            ...masterSession,
            ...customPayload,
            token_resmi: (customPayload?.token_resmi || masterSession.token_resmi).toUpperCase()
        };

        try {
            const { error } = await supabase.from("tka_sessions").upsert(
                {
                    id: 1,
                    paket_aktif: updatedSession.paket_aktif,
                    nama_paket: updatedSession.nama_paket,
                    token_resmi: updatedSession.token_resmi,
                    status_akses: updatedSession.status_akses,
                    waktu_mulai: updatedSession.waktu_mulai,
                    waktu_selesai: updatedSession.waktu_selesai,
                    durasi_bindo_detik: Number(updatedSession.durasi_bindo_detik) || 4500,
                    durasi_mtk_detik: Number(updatedSession.durasi_mtk_detik) || 4500,
                    updated_at: new Date().toISOString()
                },
                { onConflict: "id" }
            );

            if (error) throw error;

            setMasterSession(updatedSession);
            alert("Jadwal dan durasi per mata uji Tryout TKA SMP berhasil diperbarui di Supabase!");
        } catch (err: any) {
            alert("Gagal menyimpan jadwal ke Supabase: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const toggleSessionLock = () => {
        const nextStatus = masterSession.status_akses === "DIBUKA" ? "TERKUNCI" : "DIBUKA";
        if (!confirm(`Ubah status akses bilik ujian menjadi: ${nextStatus}?`)) return;
        handleUpdateSchedule(undefined, { status_akses: nextStatus });
    };

    const handleAddCompensationTime = async (minutes: number) => {
        if (!confirm(`Tambahkan waktu darurat ${minutes} menit untuk seluruh peserta secara serentak?`)) return;

        try {
            const currentEnd = new Date(masterSession.waktu_selesai);
            const baseTime = isNaN(currentEnd.getTime()) ? new Date() : currentEnd;
            baseTime.setMinutes(baseTime.getMinutes() + minutes);

            const pad = (n: number) => String(n).padStart(2, "0");
            const newEndStr = `${baseTime.getFullYear()}-${pad(baseTime.getMonth() + 1)}-${pad(baseTime.getDate())}T${pad(
                baseTime.getHours()
            )}:${pad(baseTime.getMinutes())}`;

            await handleUpdateSchedule(undefined, { waktu_selesai: newEndStr });
        } catch {
            alert("Gagal menambahkan kompensasi waktu.");
        }
    };

    const handleResetStudent = async (student: StudentItem) => {
        if (!confirm(`Reset ujian ${student.nama}? Data pengerjaan akan dikembalikan ke awal.`)) return;

        setStudents((prev) =>
            prev.map((s) =>
                s.nisn === student.nisn
                    ? { ...s, status: "Belum Hadir", violations: 0, score: 0, bindoScore: 0, mtkScore: 0, waktu_selesai: "-" }
                    : s
            )
        );

        try {
            const { error } = await supabase
                .from("tka_students")
                .update({
                    status: "Belum Hadir",
                    violations: 0,
                    score: 0,
                    bindo_score: 0,
                    mtk_score: 0,
                    waktu_selesai: null
                })
                .eq("phone", student.nisn);

            if (error) throw error;
            alert(`Peserta ${student.nama} berhasil direset.`);
        } catch (err: any) {
            alert("Gagal mereset peserta: " + (err?.message || "Kesalahan server"));
        }
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanNisn = normalizePhoneOrId(newNisn);
        const cleanNama = newNama.toUpperCase().replace(/\s+/g, " ").trim();
        const cleanKelas = newKelas.toUpperCase().replace(/\s+/g, " ").trim();

        if (!cleanNisn || cleanNisn.length < 9) {
            alert("No. WhatsApp / NISN wajib berupa angka resmi (minimal 9–13 digit)!");
            return;
        }
        if (!cleanNama || !cleanKelas) {
            alert("Lengkapi Nama Siswa dan Asal SMP/MTs!");
            return;
        }

        setIsSubmittingStudent(true);

        try {
            const { error } = await supabase.from("tka_students").upsert(
                {
                    phone: cleanNisn,
                    name: cleanNama,
                    school: cleanKelas,
                    grade: newTingkat,
                    interest: "Umum",
                    status: "Belum Hadir",
                    violations: 0,
                    score: 0,
                    bindo_score: 0,
                    mtk_score: 0
                },
                { onConflict: "phone" }
            );

            if (error) throw error;

            setNewNisn("");
            setNewNama("");
            setNewKelas("");
            await fetchStudentsSilently();
            alert(`Peserta ${cleanNama} berhasil disimpan ke Supabase!`);
        } catch (err: any) {
            alert("Gagal menyimpan data siswa: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSubmittingStudent(false);
        }
    };

    const handleBulkImportStudents = async () => {
        if (!bulkRawText.trim()) return;
        setIsBulkImporting(true);

        try {
            const lines = bulkRawText.split(/\r?\n/).filter((l) => l.trim() !== "");
            const rowsToUpsert: any[] = [];

            lines.forEach((line) => {
                const parts = line.split(/\t|,|;|\|/).map((p) => p.trim());
                if (parts.length >= 2) {
                    const rawNisn = normalizePhoneOrId(parts[0]);
                    const nama = parts[1].toUpperCase().replace(/\s+/g, " ").trim();
                    const sekolah = (parts[2] || "SMP / MTs").toUpperCase().replace(/\s+/g, " ").trim();
                    const tingkat = ["7", "8", "9"].includes(parts[3]) ? parts[3] : "9";

                    if (rawNisn && nama) {
                        rowsToUpsert.push({
                            phone: rawNisn,
                            name: nama,
                            school: sekolah,
                            grade: tingkat,
                            interest: "Umum",
                            status: "Belum Hadir",
                            violations: 0,
                            score: 0,
                            bindo_score: 0,
                            mtk_score: 0
                        });
                    }
                }
            });

            if (rowsToUpsert.length === 0) {
                alert("Format data tidak sesuai.");
                setIsBulkImporting(false);
                return;
            }

            const { error } = await supabase
                .from("tka_students")
                .upsert(rowsToUpsert, { onConflict: "phone" });

            if (error) throw error;

            alert(`Berhasil mendaftarkan ${rowsToUpsert.length} siswa ke Supabase!`);
            setBulkRawText("");
            setShowBulkModal(false);
            await fetchStudentsSilently();
        } catch (err: any) {
            alert("Gagal mengimpor data massal: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsBulkImporting(false);
        }
    };

    const handleOpenEditModal = (student: StudentItem) => {
        setEditingStudent(student);
        setEditNisn(student.nisn);
        setEditNama(student.nama);
        setEditKelas(student.asalSekolah || student.kelas);
        setEditTingkat(["7", "8", "9"].includes(student.kelas) ? student.kelas : "9");
    };

    const handleSaveEditStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudent) return;

        const oldNisn = String(editingStudent.nisn).trim();
        const cleanNisn = normalizePhoneOrId(editNisn);
        const cleanNama = editNama.toUpperCase().replace(/\s+/g, " ").trim();
        const cleanKelas = editKelas.toUpperCase().replace(/\s+/g, " ").trim();

        if (!cleanNisn || !cleanNama || !cleanKelas) return;

        setIsUpdatingStudent(true);

        try {
            const { error } = await supabase
                .from("tka_students")
                .update({
                    phone: cleanNisn,
                    name: cleanNama,
                    school: cleanKelas,
                    grade: editTingkat
                })
                .eq("phone", oldNisn);

            if (error) throw error;

            setEditingStudent(null);
            setSearchQuery("");
            await fetchStudentsSilently();
        } catch (err: any) {
            alert("Gagal memperbarui data siswa: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsUpdatingStudent(false);
        }
    };

    const handleDeleteStudent = async (nisn: string, nama: string) => {
        if (!confirm(`Hapus peserta ${nama} (${nisn}) dari Supabase?`)) return;
        setStudents((prev) => prev.filter((s) => s.nisn !== nisn));

        try {
            const { error } = await supabase.from("tka_students").delete().eq("phone", nisn);
            if (error) throw error;
        } catch (err: any) {
            alert("Gagal menghapus peserta: " + (err?.message || "Kesalahan server"));
        }
    };

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("logged_user");
        }
        router.replace("/admin");
    };

    const availableClasses = useMemo(() => {
        const setClasses = new Set<string>();
        students.forEach((s) => {
            const label = s.asalSekolah || s.kelas;
            if (label && label.trim()) setClasses.add(label.trim());
        });
        return Array.from(setClasses).sort();
    }, [students]);

    const stats = useMemo(() => {
        const total = students.length;
        const working = students.filter((s) => s.status.toLowerCase().includes("mengerjakan")).length;
        const finished = students.filter((s) => s.status.toLowerCase().includes("selesai") || s.score > 0).length;
        const warned = students.filter((s) => s.violations > 0).length;
        const absent = total - (working + finished);
        return { total, working, finished, warned, absent: Math.max(0, absent) };
    }, [students]);

    const filteredStudents = useMemo(() => {
        return students.filter((s) => {
            const q = searchQuery.toLowerCase();
            const matchSearch =
                s.nama.toLowerCase().includes(q) ||
                s.nisn.includes(searchQuery) ||
                s.kelas.toLowerCase().includes(q) ||
                (s.asalSekolah && s.asalSekolah.toLowerCase().includes(q));

            let matchStatus = true;
            if (filterStatus !== "ALL") {
                matchStatus = s.status.toLowerCase().includes(filterStatus.toLowerCase());
            }

            const schoolOrClass = s.asalSekolah || s.kelas;
            const matchKelas = filterKelas === "ALL" || schoolOrClass === filterKelas;
            return matchSearch && matchStatus && matchKelas;
        });
    }, [students, searchQuery, filterStatus, filterKelas]);

    if (!isAuthorized) {
        return <div className="min-h-screen bg-slate-900" />;
    }

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white print:min-h-0 flex flex-col font-sans text-slate-800 overflow-x-hidden">
            {/* CSS CETAK RESMI STANDAR DINAS A4 */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            @media print {
              html, body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                color: #000000 !important;
                font-family: 'Times New Roman', Times, serif !important;
                font-size: 10.5pt !important;
                -webkit-print-color-adjust: exact !important;
              }
              .print-hidden {
                display: none !important;
              }
              .print-sheet {
                background: #ffffff !important;
                padding: 0 !important;
                width: 100% !important;
                page-break-inside: avoid !important;
              }
              .kop-divider-thick {
                border-bottom: 3px solid #000000 !important;
                margin-top: 6px !important;
              }
              .kop-divider-thin {
                border-bottom: 1px solid #000000 !important;
                margin-top: 2px !important;
              }
              table.print-table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              table.print-table th, table.print-table td {
                border: 1px solid #000000 !important;
                padding: 4px 6px !important;
                color: #000000 !important;
              }
              table.print-table th {
                background-color: #f2f2f2 !important;
                font-weight: bold !important;
                text-align: center !important;
              }
            }
          `
                }}
            />

            {/* HEADER PROKTOR */}
            <header className="print-hidden bg-white border-b border-slate-200/90 py-3 px-3.5 sm:px-8 sticky top-0 z-30 shadow-2xs">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full md:w-auto">
                        <Link
                            href="/admin"
                            className="p-1.5 sm:p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shrink-0 cursor-pointer"
                            title="Kembali ke Hub Utama Admin"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src="/logo-timsim.jpg"
                                alt="Logo SMA Muhammadiyah 18 Jakarta"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                }}
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase truncate">
                                PUSAT KOMANDO PROKTOR • TRYOUT TKA SMP
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                Pengawas Aktif: <strong className="text-blue-700">{currentProctor.nama}</strong> ({currentProctor.role.toUpperCase()})
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
                        <button
                            type="button"
                            onClick={toggleSessionLock}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${masterSession.status_akses === "DIBUKA"
                                ? "bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                                }`}
                        >
                            {masterSession.status_akses === "DIBUKA" ? (
                                <>
                                    <LockKeyhole className="w-3.5 h-3.5" />
                                    <span>Kunci Sesi</span>
                                </>
                            ) : (
                                <>
                                    <LockKeyholeOpen className="w-3.5 h-3.5" />
                                    <span>Buka Sesi</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                fetchMasterSession();
                                fetchStudents();
                            }}
                            disabled={isLoading}
                            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
                            <span className="hidden sm:inline">Sinkron Data</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Keluar dari Sistem"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl w-full mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 print:p-0 print:m-0 print:space-y-0 print:w-full print:max-w-none text-left">
                {/* 1. MASTER PANEL TOKEN, DURASI SUBTES & PENJADWALAN */}
                <div className="print-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-4 sm:p-7 text-white shadow-lg space-y-4 sm:space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/10 pb-3 sm:pb-4">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                                <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div>
                                <div className="text-[9.5px] sm:text-[10px] font-mono font-bold tracking-widest text-amber-300 uppercase">
                                    PENGATURAN RUANG UJIAN TERPUSAT (30 BINDO & 30 MTK)
                                </div>
                                <h2 className="text-base sm:text-xl font-black text-white">
                                    Token Resmi & Durasi Subtes TKA SMP
                                </h2>
                                <p className="text-[11px] sm:text-xs text-blue-200">
                                    Status Sesi:{" "}
                                    <strong
                                        className={`px-2 py-0.5 rounded font-mono text-[10px] sm:text-[11px] ${masterSession.status_akses === "DIBUKA"
                                            ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                                            : "bg-rose-500/30 text-rose-300 border border-rose-400/40"
                                            }`}
                                    >
                                        {masterSession.status_akses}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl border border-white/15 self-start sm:self-auto">
                            <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-300 px-1.5 font-mono">TAMBAH WAKTU:</span>
                            <button
                                type="button"
                                onClick={() => handleAddCompensationTime(2)}
                                className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-amber-300 font-bold text-xs cursor-pointer transition-all"
                            >
                                +2m
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddCompensationTime(5)}
                                className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-amber-300 font-bold text-xs cursor-pointer transition-all"
                            >
                                +5m
                            </button>

                            <div className="flex items-center gap-1 pl-1 border-l border-white/20">
                                <input
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(Math.max(1, Number(e.target.value)))}
                                    className="w-10 sm:w-12 px-1 py-1 rounded-lg bg-black/40 border border-white/20 text-center text-xs font-mono font-bold text-amber-300 outline-none"
                                />
                                <span className="text-[10px] font-mono text-slate-300">mnt</span>
                                <button
                                    type="button"
                                    onClick={() => handleAddCompensationTime(customMinutes)}
                                    className="px-2 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition-all"
                                >
                                    <FastForward className="w-3.5 h-3.5" />
                                    <span>Kirim</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateSchedule} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-3.5 text-xs">
                        <div className="sm:col-span-1 lg:col-span-3 space-y-1">
                            <label className="text-[10.5px] sm:text-[11px] font-bold text-slate-300 font-mono">PAKET SOAL TKA SMP:</label>
                            <select
                                value={masterSession.paket_aktif}
                                onChange={(e: any) => setMasterSession({ ...masterSession, paket_aktif: e.target.value })}
                                className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold font-mono text-xs outline-none focus:bg-white/20 cursor-pointer"
                            >
                                <option value="PAKET_1" className="text-slate-900">PAKET 1 (Reguler 60 Soal)</option>
                                <option value="PAKET_2" className="text-slate-900">PAKET 2 (Alternatif)</option>
                                <option value="PAKET_3" className="text-slate-900">PAKET 3 (Susulan)</option>
                            </select>
                        </div>

                        <div className="sm:col-span-1 lg:col-span-3 space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[10.5px] sm:text-[11px] font-bold text-slate-300 font-mono">TOKEN AKTIF:</label>
                                <button
                                    type="button"
                                    onClick={generateRandomToken}
                                    className="text-[10px] text-amber-300 hover:underline font-bold cursor-pointer"
                                >
                                    Acak Token
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    required
                                    value={masterSession.token_resmi}
                                    onChange={(e) => setMasterSession({ ...masterSession, token_resmi: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-white/10 border border-amber-400/50 text-amber-300 font-mono font-black text-xs sm:text-sm text-center uppercase outline-none focus:bg-white/20"
                                />
                                <button
                                    type="button"
                                    onClick={copyToken}
                                    className="p-2 sm:p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer shrink-0"
                                    title="Salin Token"
                                >
                                    {tokenCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="sm:col-span-1 lg:col-span-3 space-y-1">
                            <label className="text-[10.5px] sm:text-[11px] font-bold text-slate-300 font-mono">MULAI UJIAN:</label>
                            <input
                                type="datetime-local"
                                required
                                value={masterSession.waktu_mulai}
                                onChange={(e) => setMasterSession({ ...masterSession, waktu_mulai: e.target.value })}
                                className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-xs outline-none focus:bg-white/20"
                            />
                        </div>

                        <div className="sm:col-span-1 lg:col-span-3 space-y-1">
                            <label className="text-[10.5px] sm:text-[11px] font-bold text-slate-300 font-mono">BATAS SELESAI:</label>
                            <input
                                type="datetime-local"
                                required
                                value={masterSession.waktu_selesai}
                                onChange={(e) => setMasterSession({ ...masterSession, waktu_selesai: e.target.value })}
                                className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-xs outline-none focus:bg-white/20"
                            />
                        </div>

                        {/* Durasi Bahasa Indonesia (Menit & Detik) */}
                        <div className="sm:col-span-1 lg:col-span-6 space-y-1">
                            <label className="text-[10.5px] sm:text-[11px] font-bold text-blue-200 font-mono">
                                DURASI BAHASA INDONESIA (30 SOAL):
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={300}
                                        value={Math.floor((masterSession.durasi_bindo_detik || 0) / 60)}
                                        onChange={(e) => {
                                            const mins = Math.max(0, Number(e.target.value) || 0);
                                            const secs = (masterSession.durasi_bindo_detik || 0) % 60;
                                            setMasterSession({ ...masterSession, durasi_bindo_detik: mins * 60 + secs });
                                        }}
                                        className="w-full bg-transparent text-amber-300 font-mono font-black text-xs sm:text-sm outline-none"
                                    />
                                    <span className="text-[10px] font-mono text-slate-300 shrink-0">Menit</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={(masterSession.durasi_bindo_detik || 0) % 60}
                                        onChange={(e) => {
                                            const mins = Math.floor((masterSession.durasi_bindo_detik || 0) / 60);
                                            const secs = Math.min(59, Math.max(0, Number(e.target.value) || 0));
                                            setMasterSession({ ...masterSession, durasi_bindo_detik: mins * 60 + secs });
                                        }}
                                        className="w-full bg-transparent text-amber-300 font-mono font-black text-xs sm:text-sm outline-none"
                                    />
                                    <span className="text-[10px] font-mono text-slate-300 shrink-0">Detik</span>
                                </div>
                            </div>
                        </div>

                        {/* Durasi Matematika (Menit & Detik) */}
                        <div className="sm:col-span-1 lg:col-span-6 space-y-1">
                            <label className="text-[10.5px] sm:text-[11px] font-bold text-emerald-200 font-mono">
                                DURASI MATEMATIKA (30 SOAL):
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={300}
                                        value={Math.floor((masterSession.durasi_mtk_detik || 0) / 60)}
                                        onChange={(e) => {
                                            const mins = Math.max(0, Number(e.target.value) || 0);
                                            const secs = (masterSession.durasi_mtk_detik || 0) % 60;
                                            setMasterSession({ ...masterSession, durasi_mtk_detik: mins * 60 + secs });
                                        }}
                                        className="w-full bg-transparent text-emerald-300 font-mono font-black text-xs sm:text-sm outline-none"
                                    />
                                    <span className="text-[10px] font-mono text-slate-300 shrink-0">Menit</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={(masterSession.durasi_mtk_detik || 0) % 60}
                                        onChange={(e) => {
                                            const mins = Math.floor((masterSession.durasi_mtk_detik || 0) / 60);
                                            const secs = Math.min(59, Math.max(0, Number(e.target.value) || 0));
                                            setMasterSession({ ...masterSession, durasi_mtk_detik: mins * 60 + secs });
                                        }}
                                        className="w-full bg-transparent text-emerald-300 font-mono font-black text-xs sm:text-sm outline-none"
                                    />
                                    <span className="text-[10px] font-mono text-slate-300 shrink-0">Detik</span>
                                </div>
                            </div>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-12 flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={isSavingSchedule}
                                className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shadow-md"
                            >
                                <Save className="w-4 h-4" />
                                <span>{isSavingSchedule ? "Menyimpan ke Server..." : "Terapkan Jadwal & Durasi Ujian"}</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* 2. STATISTIK PESERTA */}
                <div className="print-hidden grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-bold font-mono">
                            <span>TERDAFTAR</span>
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                        </div>
                        <div className="text-xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 font-mono">{stats.total}</div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-blue-600 text-[11px] sm:text-xs font-bold font-mono">
                            <span>DI BILIK</span>
                            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 animate-pulse" />
                        </div>
                        <div className="text-xl sm:text-3xl font-black text-blue-700 mt-1 sm:mt-2 font-mono">{stats.working}</div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-emerald-600 text-[11px] sm:text-xs font-bold font-mono">
                            <span>SELESAI</span>
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                        </div>
                        <div className="text-xl sm:text-3xl font-black text-emerald-700 mt-1 sm:mt-2 font-mono">{stats.finished}</div>
                    </div>

                    <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xs ${stats.warned > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"}`}>
                        <div className={`flex items-center justify-between text-[11px] sm:text-xs font-bold font-mono ${stats.warned > 0 ? "text-amber-800" : "text-slate-500"}`}>
                            <span>PERINGATAN</span>
                            <AlertTriangle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stats.warned > 0 ? "text-amber-600" : "text-slate-400"}`} />
                        </div>
                        <div className={`text-xl sm:text-3xl font-black mt-1 sm:mt-2 font-mono ${stats.warned > 0 ? "text-amber-800" : "text-slate-900"}`}>
                            {stats.warned}
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
                        <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-bold font-mono">
                            <span>BELUM HADIR</span>
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                        </div>
                        <div className="text-xl sm:text-3xl font-black text-slate-600 mt-1 sm:mt-2 font-mono">{stats.absent}</div>
                    </div>
                </div>

                {/* 3. TAB NAVIGASI RUANG PROKTOR */}
                <div className="print-hidden flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 bg-slate-200/80 p-1 rounded-2xl border border-slate-300">
                    <button
                        onClick={() => setActiveTab("students")}
                        className={`flex-1 min-w-[140px] py-2 sm:py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${activeTab === "students" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Peserta Ujian</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("monitor")}
                        className={`flex-1 min-w-[140px] py-2 sm:py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${activeTab === "monitor" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">Live Monitor Bilik</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("bap")}
                        className={`flex-1 min-w-[140px] py-2 sm:py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${activeTab === "bap" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">Berita Acara (BAP)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("scores")}
                        className={`flex-1 min-w-[140px] py-2 sm:py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${activeTab === "scores" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Award className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate">Buku Nilai (SHTKA)</span>
                    </button>
                </div>

                {/* TAB 1: PENDAFTARAN & DAFTAR SISWA */}
                {activeTab === "students" && (
                    <div className="print-hidden space-y-4 sm:space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5 shadow-sm">
                            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900">Input Peserta Tryout TKA SMP</h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500">
                                        Nama Lengkap dan Asal SMP/MTs otomatis diformat huruf kapital agar seragam dengan pendaftaran mandiri siswa.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkModal(true)}
                                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Impor Massal Excel</span>
                                </button>
                            </div>

                            <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-3.5 text-xs">
                                <div className="sm:col-span-1 lg:col-span-3 space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px] sm:text-xs">NO. WHATSAPP (AKTIF):</label>
                                    <input
                                        type="text"
                                        required
                                        inputMode="numeric"
                                        maxLength={14}
                                        placeholder="081234567890"
                                        value={newNisn}
                                        onChange={(e) => setNewNisn(e.target.value.replace(/\D/g, ""))}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="sm:col-span-1 lg:col-span-4 space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px] sm:text-xs">NAMA LENGKAP SISWA:</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="CONTOH: MUHAMMAD RIZKI PRATAMA"
                                        value={newNama}
                                        onChange={(e) => setNewNama(e.target.value.toUpperCase())}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold focus:border-blue-600 outline-none text-xs uppercase"
                                    />
                                </div>

                                <div className="sm:col-span-1 lg:col-span-3 space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px] sm:text-xs">ASAL SEKOLAH (SMP/MTs):</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="CONTOH: SMPN 161 JAKARTA"
                                        value={newKelas}
                                        onChange={(e) => setNewKelas(e.target.value.toUpperCase())}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold uppercase focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="sm:col-span-1 lg:col-span-2 space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px] sm:text-xs">KELAS:</label>
                                    <select
                                        value={newTingkat}
                                        onChange={(e) => setNewTingkat(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold focus:border-blue-600 outline-none text-xs bg-white cursor-pointer"
                                    >
                                        <option value="9">Kelas 9</option>
                                        <option value="8">Kelas 8</option>
                                        <option value="7">Kelas 7</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2 lg:col-span-12 pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <span className="text-[10.5px] sm:text-[11px] text-slate-400 italic">
                                        *Data otomatis tersimpan langsung ke Supabase database peserta.
                                    </span>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingStudent}
                                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 transition-all text-xs"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        <span>{isSubmittingStudent ? "Menyimpan..." : "Simpan Peserta"}</span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-8 space-y-4 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                                        Daftar Peserta Terdaftar ({students.length} Siswa)
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500">
                                        Siswa berstatus terdaftar memiliki otorisasi masuk ke bilik ujian dengan token sesi.
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Cari No. WA / Nama..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full sm:w-auto pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600"
                                        />
                                    </div>

                                    <select
                                        value={filterKelas}
                                        onChange={(e) => setFilterKelas(e.target.value)}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none bg-white cursor-pointer"
                                    >
                                        <option value="ALL">Semua Asal SMP</option>
                                        {availableClasses.map((cls) => (
                                            <option key={cls} value={cls}>
                                                {cls}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] sm:text-[11px] text-slate-600">
                                        <tr>
                                            <th className="p-3 w-12">No</th>
                                            <th className="p-3">No. WhatsApp</th>
                                            <th className="p-3">Nama Lengkap</th>
                                            <th className="p-3">Asal SMP / Kelas</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3 text-right">Tindakan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {filteredStudents.map((s, idx) => (
                                            <tr key={s.nisn} className="hover:bg-slate-50/70">
                                                <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                                                <td className="p-3 font-mono font-bold text-slate-800">{s.nisn}</td>
                                                <td className="p-3 font-bold text-slate-900">{s.nama}</td>
                                                <td className="p-3 font-mono font-bold text-blue-700">
                                                    {s.asalSekolah ? `${s.asalSekolah} (Kelas ${s.kelas})` : `Kelas ${s.kelas}`}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${s.status.toLowerCase().includes("mengerjakan")
                                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                            : s.status.toLowerCase().includes("selesai") || s.score > 0
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : "bg-slate-100 text-slate-600 border border-slate-200"
                                                            }`}
                                                    >
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right space-x-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditModal(s)}
                                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 text-slate-600 cursor-pointer transition-colors"
                                                        title="Edit Data Peserta"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStudent(s.nisn, s.nama)}
                                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-500 cursor-pointer transition-colors"
                                                        title="Hapus Peserta"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredStudents.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                                                    {students.length === 0
                                                        ? "Belum ada peserta terdaftar."
                                                        : "Tidak ada siswa yang sesuai dengan filter pencarian."}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: LIVE MONITOR BILIK SISWA */}
                {activeTab === "monitor" && (
                    <div className="print-hidden bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-7 space-y-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                                    <span>Pemantauan Bilik Ujian Siswa</span>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[9.5px] sm:text-[10px] font-bold inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                        Auto-Sync 5s
                                    </span>
                                </h3>
                                <p className="text-[11px] sm:text-xs text-slate-500">
                                    Paket aktif: <strong className="text-blue-700 font-bold">{masterSession.paket_aktif}</strong> | Token:{" "}
                                    <strong className="text-amber-600 font-mono font-bold">{masterSession.token_resmi}</strong> | Mode: <strong className="text-emerald-700">Soft-Warning (Tanpa Blokir)</strong>
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Cari No. WA / Nama..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full sm:w-auto pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600"
                                    />
                                </div>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none bg-white cursor-pointer"
                                >
                                    <option value="ALL">Semua Status</option>
                                    <option value="Mengerjakan">Sedang Mengerjakan</option>
                                    <option value="Selesai">Selesai</option>
                                    <option value="Hadir">Belum Hadir</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                                <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] sm:text-[11px] text-slate-600">
                                    <tr>
                                        <th className="p-3">No. WhatsApp</th>
                                        <th className="p-3">Nama Peserta</th>
                                        <th className="p-3">Asal SMP / Kelas</th>
                                        <th className="p-3">Status Pengerjaan</th>
                                        <th className="p-3">Catatan Fokus Layar</th>
                                        <th className="p-3 text-right">Aksi Pengawas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {filteredStudents.map((s) => {
                                        const isFinished = s.status.toLowerCase().includes("selesai") || s.score > 0;
                                        const isWorking = s.status.toLowerCase().includes("mengerjakan");

                                        return (
                                            <tr key={s.nisn} className="hover:bg-slate-50/70">
                                                <td className="p-3 font-mono font-bold text-slate-800">{s.nisn}</td>
                                                <td className="p-3 font-bold text-slate-900">{s.nama}</td>
                                                <td className="p-3 font-mono text-slate-600 font-semibold">
                                                    {s.asalSekolah ? `${s.asalSekolah} (Kelas ${s.kelas})` : `Kelas ${s.kelas}`}
                                                </td>
                                                <td className="p-3">
                                                    {isWorking && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] inline-flex items-center gap-1.5 shadow-2xs">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                                            Aktif Mengerjakan
                                                        </span>
                                                    )}
                                                    {isFinished && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                                            Selesai ({s.waktu_selesai || "-"})
                                                        </span>
                                                    )}
                                                    {!isWorking && !isFinished && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                                                            Belum Hadir
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 font-mono font-bold">
                                                    {s.violations > 0 ? (
                                                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10.5px] inline-flex items-center gap-1">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                            {s.violations}x Peringatan
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-600">0 (Tertib)</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => handleResetStudent(s)}
                                                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95"
                                                        title="Reset status peserta ke awal"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        <span>Reset Ujian</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredStudents.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                                                Belum ada peserta yang sesuai dengan filter pemantauan.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: BERITA ACARA UJIAN (BAP TRYOUT TKA SMP) */}
                {activeTab === "bap" && (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="print-hidden bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                                <div>
                                    <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-700 shrink-0" />
                                        <span>Pengaturan Berita Acara Pelaksanaan (BAP)</span>
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500">
                                        Kop surat, data statistik, dan penandatangan dokumen terisi otomatis sesuai format resmi Tryout TKA SMP.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-4 sm:px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all shrink-0 w-full sm:w-auto"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Cetak Lembar BAP (A4/PDF)</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">NOMOR SURAT BAP:</label>
                                    <input
                                        type="text"
                                        value={bapData.nomorSurat}
                                        onChange={(e) => setBapData({ ...bapData, nomorSurat: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">RUANG / LABORATORIUM:</label>
                                    <input
                                        type="text"
                                        value={bapData.ruangUjian}
                                        onChange={(e) => setBapData({ ...bapData, ruangUjian: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="font-bold text-slate-700 font-mono text-[10.5px]">DATA KEHADIRAN:</label>
                                        <label className="text-[10px] text-blue-700 font-bold flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bapData.isManualHadir}
                                                onChange={(e) =>
                                                    setBapData({
                                                        ...bapData,
                                                        isManualHadir: e.target.checked,
                                                        manualHadir: stats.working + stats.finished,
                                                        manualTidakHadir: stats.absent
                                                    })
                                                }
                                                className="rounded"
                                            />
                                            <span>Manual</span>
                                        </label>
                                    </div>
                                    {bapData.isManualHadir ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number"
                                                placeholder="Hadir"
                                                value={bapData.manualHadir}
                                                onChange={(e) => setBapData({ ...bapData, manualHadir: Number(e.target.value) })}
                                                className="px-2 py-2 rounded-xl border border-slate-200 text-center font-bold font-mono outline-none text-xs"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Absen"
                                                value={bapData.manualTidakHadir}
                                                onChange={(e) => setBapData({ ...bapData, manualTidakHadir: Number(e.target.value) })}
                                                className="px-2 py-2 rounded-xl border border-slate-200 text-center font-bold font-mono outline-none text-xs"
                                            />
                                        </div>
                                    ) : (
                                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-600 flex justify-between items-center">
                                            <span>Otomatis:</span>
                                            <strong className="text-emerald-700">{stats.working + stats.finished} Hadir</strong>
                                            <span className="text-slate-400">/</span>
                                            <strong className="text-rose-700">{stats.absent} Absen</strong>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">NAMA KEPALA SEKOLAH:</label>
                                    <input
                                        type="text"
                                        value={bapData.kepalaSekolahNama}
                                        onChange={(e) => setBapData({ ...bapData, kepalaSekolahNama: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">NBM KEPALA SEKOLAH:</label>
                                    <input
                                        type="text"
                                        value={bapData.kepalaSekolahNbm}
                                        onChange={(e) => setBapData({ ...bapData, kepalaSekolahNbm: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">NAMA PROKTOR / PENGAWAS:</label>
                                    <input
                                        type="text"
                                        value={bapData.pengawasNama}
                                        onChange={(e) => setBapData({ ...bapData, pengawasNama: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-600 outline-none text-xs"
                                    />
                                </div>

                                <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">CATATAN KHUSUS PELAKSANAAN:</label>
                                    <textarea
                                        rows={2}
                                        value={bapData.catatanKhusus}
                                        onChange={(e) => setBapData({ ...bapData, catatanKhusus: e.target.value })}
                                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-blue-600 outline-none resize-y leading-relaxed font-sans text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* LEMBAR CETAK RESMI BAP A4 */}
                        <div className="print-sheet bg-white rounded-3xl border border-slate-200 p-6 sm:p-12 shadow-lg space-y-5 text-slate-950 font-serif leading-relaxed overflow-x-auto">
                            <div className="text-center min-w-[560px] sm:min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                                        <img
                                            src="/logo-timsim.jpg"
                                            alt="Logo SMA Muhammadiyah 18"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = "none";
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 text-center space-y-0.5">
                                        <h3 className="text-[11px] sm:text-xs font-bold tracking-wider uppercase leading-tight font-sans">
                                            MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL
                                        </h3>
                                        <h4 className="text-[10px] sm:text-[11px] font-bold tracking-wide uppercase leading-tight font-sans">
                                            PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN
                                        </h4>
                                        <h1 className="text-lg sm:text-2xl font-black uppercase tracking-tight font-sans text-blue-900 py-0.5">
                                            SMA MUHAMMADIYAH 18 JAKARTA
                                        </h1>
                                        <p className="text-[10px] sm:text-[11px] font-bold tracking-widest font-mono uppercase text-slate-700">
                                            STATUS: TERAKREDITASI "A"
                                        </p>
                                        <p className="text-[9.5px] sm:text-[10px] text-slate-600 font-sans leading-tight">
                                            Jl. Panjang No. 19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp: (021) 7235544
                                        </p>
                                    </div>
                                    <div className="w-16 sm:w-20 shrink-0" />
                                </div>
                                <div className="kop-divider-thick" />
                                <div className="kop-divider-thin" />
                            </div>

                            <div className="text-center space-y-1 pt-1 min-w-[560px] sm:min-w-0">
                                <h2 className="text-sm sm:text-base font-bold underline uppercase tracking-wide">
                                    BERITA ACARA PELAKSANAAN TRYOUT TES KEMAMPUAN AKADEMIK (TKA) JENJANG SMP
                                </h2>
                                <p className="text-xs font-mono font-bold">Nomor: {bapData.nomorSurat}</p>
                            </div>

                            <div className="text-xs leading-relaxed space-y-3.5 text-justify min-w-[560px] sm:min-w-0">
                                <p>
                                    Pada hari ini,{" "}
                                    <strong>
                                        {new Date().toLocaleDateString("id-ID", {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric"
                                        })}
                                    </strong>
                                    , telah diselenggarakan Tryout Terstandarisasi Tes Kemampuan Akademik (TKA) Jenjang SMP (60 Butir Soal: 30 Bahasa Indonesia & 30 Matematika) Tahun Pelajaran 2026/2027 berbasis Computer-Based Test (CBT) di lingkungan{" "}
                                    <strong>SMA Muhammadiyah 18 Jakarta</strong> dengan ketentuan pelaksanaan sebagai berikut:
                                </p>

                                <table className="print-table text-xs">
                                    <tbody>
                                        <tr>
                                            <td className="w-1/4 font-semibold">Paket Soal Ujian</td>
                                            <td className="w-3/4 font-bold font-mono">
                                                {masterSession.paket_aktif} — {masterSession.nama_paket}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Mata Uji</td>
                                            <td>1. Bahasa Indonesia (30 Soal) • 2. Matematika (30 Soal)</td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Ruang / Tempat Ujian</td>
                                            <td>{bapData.ruangUjian}</td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Waktu Pelaksanaan</td>
                                            <td>
                                                {masterSession.waktu_mulai.replace("T", " ")} s.d. {masterSession.waktu_selesai.replace("T", " ")} WIB
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Token Resmi Sesi</td>
                                            <td className="font-mono font-bold">{masterSession.token_resmi}</td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Jumlah Peserta Terdaftar</td>
                                            <td className="font-bold">{stats.total} Siswa</td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Jumlah Peserta Hadir</td>
                                            <td className="font-bold text-emerald-800">
                                                {bapData.isManualHadir ? bapData.manualHadir : stats.working + stats.finished} Siswa
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="font-semibold">Jumlah Tidak Hadir</td>
                                            <td className="font-bold text-rose-800">
                                                {bapData.isManualHadir ? bapData.manualTidakHadir : stats.absent} Siswa
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div>
                                    <p className="font-bold mb-1">Catatan Khusus Selama Pelaksanaan Ujian:</p>
                                    <div className="p-3 border border-black min-h-[45px] text-xs italic">
                                        “{bapData.catatanKhusus}”
                                    </div>
                                </div>

                                <p>
                                    Demikian Berita Acara Pelaksanaan ini dibuat dengan sebenar-benarnya serta penuh rasa tanggung jawab untuk dipergunakan sebagaimana mestinya.
                                </p>
                            </div>

                            <div className="pt-6 grid grid-cols-2 text-xs text-center font-sans min-w-[560px] sm:min-w-0">
                                <div>
                                    <p>Mengetahui,</p>
                                    <p className="font-bold">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                    <div className="h-16 sm:h-20" />
                                    <p className="font-bold underline">{bapData.kepalaSekolahNama}</p>
                                    <p className="font-mono text-[10px]">NBM. {bapData.kepalaSekolahNbm}</p>
                                </div>

                                <div>
                                    <p>Jakarta, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                                    <p className="font-bold">Proktor / Pengawas Ruang Ujian</p>
                                    <div className="h-16 sm:h-20" />
                                    <p className="font-bold underline">{bapData.pengawasNama}</p>
                                    <p className="font-mono text-[10px]">NBM/NIP. {bapData.pengawasNbm}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: BUKU NILAI SHTKA (KEPMENDIKDASMEN NO. 56 TAHUN 2026) */}
                {activeTab === "scores" && (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="print-hidden bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-7 space-y-4 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                                        Buku Nilai Sertifikat Hasil Tryout TKA SMP (SHTKA)
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500">
                                        Skala 0,00 – 100,00 per mata uji (Istimewa ≥95,00 | BINDO: Baik ≥76,67, Memadai ≥50,00 | MTK: Baik ≥56,67, Memadai ≥33,33).
                                    </p>
                                </div>
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md shrink-0 w-full sm:w-auto"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Cetak Rekap Nilai (A4)</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[820px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] sm:text-[11px] text-slate-600">
                                        <tr>
                                            <th className="p-3">Rank</th>
                                            <th className="p-3">No. WA</th>
                                            <th className="p-3">Nama Peserta</th>
                                            <th className="p-3">Asal SMP / Kelas</th>
                                            <th className="p-3 text-center">Nilai BINDO</th>
                                            <th className="p-3 text-center">Capaian BINDO</th>
                                            <th className="p-3 text-center">Nilai MTK</th>
                                            <th className="p-3 text-center">Capaian MTK</th>
                                            <th className="p-3 text-center">Rerata Indeks</th>
                                            <th className="p-3 text-center">Waktu</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {students
                                            .filter((s) => s.status.toLowerCase().includes("selesai") || Number(s.score) > 0)
                                            .sort((a, b) => Number(b.score) - Number(a.score))
                                            .map((s, idx) => {
                                                const bindoCat = getKepmendikdasmen56Badge(s.bindoScore, "BINDO");
                                                const mtkCat = getKepmendikdasmen56Badge(s.mtkScore, "MTK");

                                                return (
                                                    <tr key={s.nisn} className="hover:bg-slate-50">
                                                        <td className="p-3 font-mono font-bold text-blue-700">#{idx + 1}</td>
                                                        <td className="p-3 font-mono font-bold">{s.nisn}</td>
                                                        <td className="p-3 font-bold text-slate-900">{s.nama}</td>
                                                        <td className="p-3 font-mono text-slate-600">
                                                            {s.asalSekolah ? `${s.asalSekolah} (Kls ${s.kelas})` : `Kls ${s.kelas}`}
                                                        </td>
                                                        <td className="p-3 font-mono font-bold text-center text-blue-800">
                                                            {formatScoreID(s.bindoScore)}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${bindoCat.color}`}>
                                                                {bindoCat.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-mono font-bold text-center text-emerald-700">
                                                            {formatScoreID(s.mtkScore)}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mtkCat.color}`}>
                                                                {mtkCat.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-mono font-black text-xs sm:text-sm text-slate-900 text-center">
                                                            {formatScoreID(s.score)}
                                                        </td>
                                                        <td className="p-3 font-mono text-center text-slate-500">
                                                            {s.waktu_selesai || "-"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        {students.filter((s) => s.status.toLowerCase().includes("selesai") || Number(s.score) > 0).length ===
                                            0 && (
                                                <tr>
                                                    <td colSpan={10} className="text-center py-6 text-slate-400 font-medium">
                                                        Belum ada peserta yang menyelesaikan Tryout TKA SMP pada sesi ini.
                                                    </td>
                                                </tr>
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* LEMBAR CETAK REKAP NILAI DOKUMEN RESMI A4 */}
                        <div className="print-sheet hidden print:block bg-white p-8 sm:p-12 space-y-4 text-slate-950 font-serif leading-relaxed">
                            <div className="text-center">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                                        <img
                                            src="/logo-timsim.jpg"
                                            alt="Logo SMA Muhammadiyah 18"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = "none";
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 text-center space-y-0.5 font-sans">
                                        <h3 className="text-[11px] font-bold uppercase leading-tight">
                                            MAJELIS PENDIDIKAN DASAR DAN MENENGAH PDM JAKARTA SELATAN
                                        </h3>
                                        <h1 className="text-lg font-black uppercase text-blue-900 leading-tight">
                                            SMA MUHAMMADIYAH 18 JAKARTA
                                        </h1>
                                        <p className="text-[10px] text-slate-600">
                                            REKAPITULASI SERTIFIKAT HASIL TRYOUT TKA JENJANG SMP (KEPMENDIKDASMEN NO. 56 TAHUN 2026)
                                        </p>
                                    </div>
                                    <div className="w-16 shrink-0" />
                                </div>
                                <div className="kop-divider-thick" />
                                <div className="kop-divider-thin" />
                            </div>

                            <table className="print-table text-xs mt-3">
                                <thead>
                                    <tr>
                                        <th style={{ width: "30px" }}>No</th>
                                        <th style={{ width: "90px" }}>No. WA</th>
                                        <th>Nama Lengkap Peserta</th>
                                        <th style={{ width: "105px" }}>Asal SMP / Kls</th>
                                        <th style={{ width: "55px" }}>BINDO</th>
                                        <th style={{ width: "70px" }}>Capaian</th>
                                        <th style={{ width: "55px" }}>MTK</th>
                                        <th style={{ width: "70px" }}>Capaian</th>
                                        <th style={{ width: "55px" }}>Indeks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students
                                        .filter((s) => s.status.toLowerCase().includes("selesai") || Number(s.score) > 0)
                                        .sort((a, b) => Number(b.score) - Number(a.score))
                                        .map((s, idx) => {
                                            const bindoCat = getKepmendikdasmen56Badge(s.bindoScore);
                                            const mtkCat = getKepmendikdasmen56Badge(s.mtkScore);

                                            return (
                                                <tr key={s.nisn}>
                                                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                                    <td style={{ fontFamily: "monospace", textAlign: "center" }}>{s.nisn}</td>
                                                    <td style={{ fontWeight: "bold" }}>{s.nama}</td>
                                                    <td style={{ textAlign: "center" }}>
                                                        {s.asalSekolah ? `${s.asalSekolah} (${s.kelas})` : s.kelas}
                                                    </td>
                                                    <td style={{ textAlign: "center" }}>{formatScoreID(s.bindoScore)}</td>
                                                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{bindoCat.label}</td>
                                                    <td style={{ textAlign: "center" }}>{formatScoreID(s.mtkScore)}</td>
                                                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{mtkCat.label}</td>
                                                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatScoreID(s.score)}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>

                            <div className="pt-8 grid grid-cols-2 text-xs text-center font-sans">
                                <div>
                                    <p>Mengetahui,</p>
                                    <p className="font-bold">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                    <div className="h-16" />
                                    <p className="font-bold underline">{bapData.kepalaSekolahNama}</p>
                                    <p className="font-mono text-[10px]">NBM. {bapData.kepalaSekolahNbm}</p>
                                </div>
                                <div>
                                    <p>Jakarta, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                                    <p className="font-bold">Proktor / Pengawas Ruang Ujian</p>
                                    <div className="h-16" />
                                    <p className="font-bold underline">{bapData.pengawasNama}</p>
                                    <p className="font-mono text-[10px]">NBM/NIP. {bapData.pengawasNbm}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL BULK EXCEL */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
                    <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-xl w-full space-y-4 shadow-2xl border border-slate-200 text-left">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900">Salin-Tempel Massal dari Excel</h3>
                            <button onClick={() => setShowBulkModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <textarea
                            rows={8}
                            value={bulkRawText}
                            onChange={(e) => setBulkRawText(e.target.value)}
                            placeholder="No.WA [Tab] Nama Lengkap [Tab] Asal SMP [Tab] Kelas (7/8/9)"
                            className="w-full p-3 rounded-2xl border border-slate-200 font-mono text-xs outline-none focus:border-blue-600"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBulkImportStudents}
                                disabled={isBulkImporting}
                                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md disabled:opacity-50"
                            >
                                {isBulkImporting ? "Memproses..." : "Daftarkan Siswa"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDIT DATA */}
            {editingStudent && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
                    <div className="bg-white rounded-3xl p-5 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 text-left">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900">Perbarui Data Peserta</h3>
                            <button onClick={() => setEditingStudent(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEditStudent} className="space-y-3 text-xs">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono text-[10.5px]">NO. WHATSAPP:</label>
                                <input
                                    type="text"
                                    value={editNisn}
                                    onChange={(e) => setEditNisn(e.target.value.replace(/\D/g, ""))}
                                    className="w-full p-2.5 border rounded-xl font-mono font-bold text-xs outline-none focus:border-blue-600"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono text-[10.5px]">NAMA LENGKAP:</label>
                                <input
                                    type="text"
                                    value={editNama}
                                    onChange={(e) => setEditNama(e.target.value.toUpperCase())}
                                    className="w-full p-2.5 border rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-600"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">ASAL SEKOLAH (SMP/MTs):</label>
                                    <input
                                        type="text"
                                        value={editKelas}
                                        onChange={(e) => setEditKelas(e.target.value.toUpperCase())}
                                        className="w-full p-2.5 border rounded-xl font-bold uppercase text-xs outline-none focus:border-blue-600"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 font-mono text-[10.5px]">KELAS:</label>
                                    <select
                                        value={editTingkat}
                                        onChange={(e) => setEditTingkat(e.target.value)}
                                        className="w-full p-2.5 border rounded-xl font-bold text-xs bg-white outline-none focus:border-blue-600"
                                    >
                                        <option value="9">Kelas 9</option>
                                        <option value="8">Kelas 8</option>
                                        <option value="7">Kelas 7</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditingStudent(null)}
                                    className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingStudent}
                                    className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl cursor-pointer shadow-md disabled:opacity-50"
                                >
                                    {isUpdatingStudent ? "Menyimpan..." : "Simpan Perubahan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}