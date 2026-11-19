"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
    Users,
    Trophy,
    ShieldCheck,
    Search,
    Printer,
    ChevronLeft,
    GraduationCap,
    Home,
    CheckCircle2,
    RefreshCw,
    SlidersHorizontal,
    X,
    BookOpen,
    Calculator,
    Phone,
    BarChart3
} from "lucide-react";

// Webhook Google Sheets Khusus Data Leads & Hasil Tryout TKA SMP
const GOOGLE_SCRIPT_API_URL =
    "https://script.google.com/macros/s/AKfycbwqhjrwgEsTgA9_Aop9RFBu3Mrht9w4N2SPayyB3z6AtzuP7gmiSpZEioBKwmd7PHaFfw/exec";

const KKM_STANDARD = 75;

export interface TkaStudentResult {
    phone: string;
    nisn?: string;
    name: string;
    nama?: string;
    school: string;
    grade?: string;
    interest?: string;
    status?: string;
    violations: number;
    score: number;
    bindoScore: number;
    mtkScore: number;
    waktu_selesai?: string;
}

// Helper Kategori Kompetensi & Predikat (100% Identik dengan Exam, Result & Proctor)
function getCompetencyDetail(score: number) {
    if (score < 55) {
        return {
            level: "PERLU INTERVENSI KHUSUS",
            short: "INTERVENSI",
            badge: "bg-rose-50 text-rose-800 border-rose-200",
            barColor: "bg-rose-500",
            voucher: "Program Klinik Belajar & Subsidi Registrasi Awal PPDB",
            note: "Diperlukan pendampingan terstruktur dalam mengidentifikasi informasi eksplisit bacaan serta penguatan konsep dasar numerasi sebelum memasuki jenjang SMA."
        };
    }
    if (score <= 70) {
        return {
            level: "DASAR",
            short: "DASAR",
            badge: "bg-amber-50 text-amber-800 border-amber-200",
            barColor: "bg-amber-500",
            voucher: "Potongan Khusus Biaya Masuk & Formulir PPDB Gelombang Khusus",
            note: "Siswa telah mencapai batas kompetensi minimum literasi membaca dan numerasi dasar, namun memerlukan penguatan strategi penalaran masalah kontekstual."
        };
    }
    if (score <= 85) {
        return {
            level: "CAKAP",
            short: "CAKAP",
            badge: "bg-blue-50 text-blue-800 border-blue-200",
            barColor: "bg-blue-600",
            voucher: "Voucher Beasiswa Jalur Prestasi Akademik PPDB (Potongan s.d. 50%)",
            note: "Siswa terampil mengaplikasikan konsep literasi membaca dan matematika secara mandiri dan siap mengikuti pembelajaran lanjutan kurikulum SMA secara optimal."
        };
    }
    return {
        level: "MAHIR",
        short: "MAHIR",
        badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
        barColor: "bg-emerald-600",
        voucher: "Voucher Beasiswa Bebas Biaya SPP / Uang Pangkal s.d. 100%",
        note: "Siswa mampu bernalar kritis memecahkan persoalan kontekstual kompleks, mengevaluasi wacana secara reflektif, serta siap masuk kelas unggulan SMA."
    };
}

export default function AdminAnalyticsTkaSmpPage() {
    const [students, setStudents] = useState<TkaStudentResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSchool, setSelectedSchool] = useState("ALL");

    // State Form Pejabat Penandatangan Rapor
    const [officials, setOfficials] = useState({
        kepalaSekolahNama: "Drs. H. Ahmad Dahlan, M.Pd.",
        kepalaSekolahNbm: "882.118.001",
        koordinatorNama: "Fadhillah Umar, S.Pd.",
        koordinatorNbm: "118.2026.091",
        koordinatorJabatan: "Koordinator Kurikulum & Asesmen PPDB"
    });

    // Modal Cetak Rapor Individual 1 Murid Terpilih
    const [selectedStudentForReport, setSelectedStudentForReport] = useState<TkaStudentResult | null>(null);

    // Ambil data nilai & leads real-time dari Google Sheets
    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${GOOGLE_SCRIPT_API_URL}?action=get_students&_t=${Date.now()}`, {
                cache: "no-store"
            });
            const text = await res.text();
            if (!text.trim().startsWith("<")) {
                const json = JSON.parse(text);
                if (json.status === "success" && Array.isArray(json.data)) {
                    const normalized: TkaStudentResult[] = json.data.map((item: any) => {
                        const rawScore = Number(item.score ?? item.totalScore ?? 0);
                        const cleanScore =
                            rawScore > 100
                                ? Math.min(100, Math.max(0, Math.round(((rawScore - 200) / 600) * 100)))
                                : Math.round(rawScore);

                        const bindoVal = Math.round(Number(item.bindoScore ?? item.indoScore ?? cleanScore));
                        const mtkVal = Math.round(Number(item.mtkScore ?? item.mathScore ?? cleanScore));

                        return {
                            phone: String(item.phone || item.nisn || "-"),
                            name: String(item.name || item.nama || "Peserta Simulasi"),
                            school: String(item.school || item.asal_sekolah || "SMP / MTs"),
                            grade: String(item.grade || "9"),
                            interest: String(item.interest || item.peminatan || "Sains & Teknologi (STEM)"),
                            status: String(item.status || (cleanScore > 0 ? "Selesai" : "Terdaftar")),
                            violations: Number(item.violations || 0),
                            score: cleanScore,
                            bindoScore: bindoVal,
                            mtkScore: mtkVal,
                            waktu_selesai: item.waktu_selesai || ""
                        };
                    });
                    setStudents(normalized);
                }
            }
        } catch (err) {
            console.error("Gagal memuat data peserta TKA SMP:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const raw = sessionStorage.getItem("logged_user");
        if (raw) {
            try {
                const user = JSON.parse(raw);
                if (user.role !== "admin") {
                    alert("Akses ditolak! Halaman ini khusus Administrator.");
                    window.location.href = "/admin";
                    return;
                }
            } catch {
                window.location.href = "/admin";
                return;
            }
        } else {
            window.location.href = "/admin";
            return;
        }

        fetchStudents();
    }, []);

    // Urutkan peserta berdasarkan skor tertinggi
    const rankedStudents = useMemo(() => {
        return [...students].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    }, [students]);

    // Daftar Asal Sekolah (SMP/MTs) unik
    const availableSchools = useMemo(() => {
        const setSch = new Set<string>();
        students.forEach((s) => {
            if (s.school && s.school.trim()) setSch.add(s.school.trim());
        });
        return Array.from(setSch).sort();
    }, [students]);

    // Filter tabel pencarian dan sekolah asal
    const filteredStudents = useMemo(() => {
        return rankedStudents.filter((s) => {
            const matchSchool = selectedSchool === "ALL" || s.school === selectedSchool;
            const q = searchQuery.toLowerCase();
            const matchSearch =
                s.name.toLowerCase().includes(q) ||
                s.school.toLowerCase().includes(q) ||
                s.phone.includes(searchQuery) ||
                (s.interest && s.interest.toLowerCase().includes(q));
            return matchSchool && matchSearch;
        });
    }, [rankedStudents, selectedSchool, searchQuery]);

    // Statistik Real Agregat Peserta Tryout TKA SMP
    const overallStats = useMemo(() => {
        const finished = students.filter((s) => s.status === "Selesai" || s.score > 0);
        const totalSelesai = finished.length;
        const totalProspek = students.length;

        const avgScore =
            totalSelesai > 0
                ? Math.round((finished.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalSelesai) * 10) / 10
                : 0;

        const avgBindo =
            totalSelesai > 0
                ? Math.round((finished.reduce((acc, curr) => acc + (Number(curr.bindoScore) || 0), 0) / totalSelesai) * 10) / 10
                : 0;

        const avgMtk =
            totalSelesai > 0
                ? Math.round((finished.reduce((acc, curr) => acc + (Number(curr.mtkScore) || 0), 0) / totalSelesai) * 10) / 10
                : 0;

        const tuntasKkmCount = finished.filter((s) => Number(s.score) >= KKM_STANDARD).length;
        const persentaseTuntas = totalSelesai > 0 ? Math.round((tuntasKkmCount / totalSelesai) * 100) : 0;

        const totalPelanggaran = finished.reduce((acc, curr) => acc + (Number(curr.violations) || 0), 0);
        const integritasRate = Math.max(0, 100 - totalPelanggaran * 3);

        // Distribusi 4 Predikat Capaian
        const dist = {
            mahir: finished.filter((s) => Number(s.score) >= 86).length,
            cakap: finished.filter((s) => Number(s.score) >= 71 && Number(s.score) <= 85).length,
            dasar: finished.filter((s) => Number(s.score) >= 55 && Number(s.score) <= 70).length,
            intervensi: finished.filter((s) => Number(s.score) < 55).length
        };

        return {
            totalProspek,
            totalSelesai,
            avgScore,
            avgBindo,
            avgMtk,
            tuntasKkmCount,
            persentaseTuntas,
            integritasRate,
            dist
        };
    }, [students]);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 overflow-x-hidden">
            {/* ATURAN CETAK KHUSUS LEMBAR RAPOR INDIVIDU A4 */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
            @page {
              size: A4 portrait;
              margin: 10mm 15mm 10mm 15mm;
            }
            @media print {
              html, body {
                background: #ffffff !important;
                background-color: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                color: #000000 !important;
                font-family: 'Times New Roman', Times, serif !important;
                font-size: 11pt !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-hidden {
                display: none !important;
              }
              .print-sheet {
                background: #ffffff !important;
                background-color: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .kop-divider-thick {
                border-bottom: 2.5px solid #000000 !important;
                margin-top: 8px !important;
              }
              .kop-divider-thin {
                border-bottom: 1px solid #000000 !important;
                margin-top: 2px !important;
              }
            }
          `
                }}
            />

            {/* HEADER ATAS RESPONSIF HP & TABLET */}
            <header className="print-hidden bg-white border-b border-slate-200/90 py-3 sm:py-3.5 px-3 sm:px-6 lg:px-8 sticky top-0 z-30 shadow-2xs">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Link
                            href="/admin"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 transition-colors shrink-0 cursor-pointer"
                            title="Kembali ke Bilik Admin"
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
                        <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight uppercase truncate">
                                ANALITIK & DATA PROSPEK TRYOUT TKA SMP
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                SMA Muhammadiyah 18 Jakarta • Rekapitulasi PPDB 2026/2027 (BINDO & MTK)
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                            onClick={fetchStudents}
                            disabled={isLoading}
                            className="px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
                            <span>Sinkronkan Data</span>
                        </button>

                        <Link
                            href="/"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                            title="Ke Halaman Utama"
                        >
                            <Home className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* KONTEN UTAMA */}
            <div className="max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 text-left">
                {/* PANEL PENGATURAN PEJABAT PENANDATANGAN */}
                <div className="print-hidden bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <SlidersHorizontal className="w-4 h-4 text-blue-700 shrink-0" />
                        <div>
                            <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                                Pengaturan Pejabat Penandatangan Rapor Tryout TKA SMP
                            </h3>
                            <p className="text-[10.5px] sm:text-[11px] text-slate-500">
                                Sesuaikan nama kepala sekolah, koordinator, dan jabatan agar tercetak otomatis pada rapor diagnostik & voucher PPDB siswa.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-1">
                            <label className="font-bold font-mono text-slate-700 text-[10.5px] sm:text-xs">NAMA KEPALA SEKOLAH:</label>
                            <input
                                type="text"
                                value={officials.kepalaSekolahNama}
                                onChange={(e) => setOfficials({ ...officials, kepalaSekolahNama: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-700 outline-none text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold font-mono text-slate-700 text-[10.5px] sm:text-xs">NIP / NBM KEPALA SEKOLAH:</label>
                            <input
                                type="text"
                                value={officials.kepalaSekolahNbm}
                                onChange={(e) => setOfficials({ ...officials, kepalaSekolahNbm: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:border-blue-700 outline-none text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold font-mono text-slate-700 text-[10.5px] sm:text-xs">NAMA KOORDINATOR ASESMEN:</label>
                            <input
                                type="text"
                                value={officials.koordinatorNama}
                                onChange={(e) => setOfficials({ ...officials, koordinatorNama: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-700 outline-none text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold font-mono text-slate-700 text-[10.5px] sm:text-xs">NIP / NBM KOORDINATOR:</label>
                            <input
                                type="text"
                                value={officials.koordinatorNbm}
                                onChange={(e) => setOfficials({ ...officials, koordinatorNbm: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:border-blue-700 outline-none text-xs"
                            />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                            <label className="font-bold font-mono text-slate-700 text-[10.5px] sm:text-xs">TITEL JABATAN KOORDINATOR:</label>
                            <input
                                type="text"
                                value={officials.koordinatorJabatan}
                                onChange={(e) => setOfficials({ ...officials, koordinatorJabatan: e.target.value })}
                                placeholder="Contoh: Koordinator Kurikulum & Asesmen PPDB"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:border-blue-700 outline-none text-blue-900 text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* 4 INDIKATOR HASIL AGREGAT (2 Kolom di HP, 4 Kolom di Tablet/Desktop) */}
                <div className="print-hidden grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>RERATA NILAI</span>
                            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-blue-900 mt-1 sm:mt-2 font-mono">
                            {overallStats.avgScore}
                            <span className="text-xs font-normal text-slate-400 ml-1">/100</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            BINDO: {overallStats.avgBindo} • MTK: {overallStats.avgMtk}
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-emerald-700 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span className="truncate pr-1">TUNTAS KKM ({KKM_STANDARD})</span>
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 sm:mt-2 font-mono">
                            {overallStats.tuntasKkmCount}{" "}
                            <span className="text-xs font-normal text-slate-500">/ {overallStats.totalSelesai}</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5 truncate">
                            {overallStats.persentaseTuntas}% Melampaui KKM
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>TOTAL PROSPEK</span>
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 font-mono">
                            {overallStats.totalProspek}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Calon Siswa SMP/MTs
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>INTEGRITAS</span>
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 font-mono">
                            {overallStats.integritasRate}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Kepatuhan Layar Kiosk
                        </div>
                    </div>
                </div>

                {/* PANEL DISTRIBUSI PREDIKAT & RERATA PER MATA PELAJARAN */}
                <div className="print-hidden grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Grafik Bar Distribusi 4 Predikat Capaian */}
                    <div className="lg:col-span-7 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-700" />
                                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                                    Distribusi Predikat Capaian Kompetensi Siswa
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                                Total Selesai: {overallStats.totalSelesai}
                            </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                            {[
                                { label: "MAHIR (86–100)", count: overallStats.dist.mahir, color: "bg-emerald-600" },
                                { label: "CAKAP (71–85)", count: overallStats.dist.cakap, color: "bg-blue-600" },
                                { label: "DASAR (55–70)", count: overallStats.dist.dasar, color: "bg-amber-500" },
                                { label: "PERLU INTERVENSI (< 55)", count: overallStats.dist.intervensi, color: "bg-rose-500" }
                            ].map((item) => {
                                const pct =
                                    overallStats.totalSelesai > 0 ? Math.round((item.count / overallStats.totalSelesai) * 100) : 0;
                                return (
                                    <div key={item.label} className="space-y-1">
                                        <div className="flex justify-between font-mono text-[11px]">
                                            <span className="font-bold text-slate-700">{item.label}</span>
                                            <span className="text-slate-600 font-bold">
                                                {item.count} Siswa ({pct}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Perbandingan Rerata BINDO vs MTK */}
                    <div className="lg:col-span-5 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                        <div className="border-b border-slate-100 pb-2.5">
                            <h3 className="text-xs sm:text-sm font-black text-slate-900">
                                Pemetaan Rerata Mata Pelajaran SMP
                            </h3>
                            <p className="text-[11px] text-slate-500">Perbandingan capaian Literasi Membaca & Numerasi</p>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                                    <span className="flex items-center gap-1.5">
                                        <BookOpen className="w-4 h-4 text-blue-700" /> Bahasa Indonesia (BINDO)
                                    </span>
                                    <span className="font-mono text-base font-black">{overallStats.avgBindo} / 100</span>
                                </div>
                                <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-700 rounded-full"
                                        style={{ width: `${Math.min(100, overallStats.avgBindo)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                                    <span className="flex items-center gap-1.5">
                                        <Calculator className="w-4 h-4 text-emerald-700" /> Matematika (MTK)
                                    </span>
                                    <span className="font-mono text-base font-black">{overallStats.avgMtk} / 100</span>
                                </div>
                                <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-600 rounded-full"
                                        style={{ width: `${Math.min(100, overallStats.avgMtk)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABEL PERINGKAT & LEADS PPDB */}
                <div className="print-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-8 space-y-4 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                                <span>Peringkat & Data Prospek Peserta ({filteredStudents.length} Siswa)</span>
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500">
                                Ketuk tombol Rapor & Cetak untuk menerbitkan bukti hasil diagnostik dan voucher beasiswa PPDB siswa.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Cari Nama / Asal SMP / WA..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-56 pl-8 pr-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-700"
                                />
                            </div>

                            <select
                                value={selectedSchool}
                                onChange={(e) => setSelectedSchool(e.target.value)}
                                className="px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none bg-white cursor-pointer"
                            >
                                <option value="ALL">Semua Asal SMP/MTs</option>
                                {availableSchools.map((sch) => (
                                    <option key={sch} value={sch}>
                                        {sch}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Info Geser Tabel Khusus Layar HP */}
                    <div className="md:hidden text-[10px] font-mono text-slate-400 flex items-center justify-end">
                        <span>← Geser tabel ke samping untuk melihat skor & cetak rapor →</span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 -mx-1 sm:mx-0">
                        <table className="w-full text-left text-xs border-collapse min-w-[820px]">
                            <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] sm:text-[11px] text-slate-600">
                                <tr>
                                    <th className="p-3 w-12">Rank</th>
                                    <th className="p-3">Nama Peserta</th>
                                    <th className="p-3">Asal Sekolah (SMP/MTs)</th>
                                    <th className="p-3">No. WhatsApp</th>
                                    <th className="p-3 text-center">BINDO</th>
                                    <th className="p-3 text-center">MTK</th>
                                    <th className="p-3 text-center">Nilai Akhir</th>
                                    <th className="p-3 text-center">KKM ({KKM_STANDARD})</th>
                                    <th className="p-3 text-center">Predikat</th>
                                    <th className="p-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {filteredStudents.map((s, idx) => {
                                    const numScore = Math.round(Number(s.score) || 0);
                                    const comp = getCompetencyDetail(numScore);
                                    const isTuntas = numScore >= KKM_STANDARD;

                                    return (
                                        <tr key={`${s.phone}_${idx}`} className="hover:bg-slate-50/70">
                                            <td className="p-3 font-mono font-bold text-blue-700">#{idx + 1}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-900">{s.name}</div>
                                                <div className="text-[10px] text-slate-500">Minat: {s.interest}</div>
                                            </td>
                                            <td className="p-3 font-semibold text-slate-700">{s.school}</td>
                                            <td className="p-3 font-mono text-slate-700">
                                                <a
                                                    href={`https://wa.me/${s.phone.replace(/^0/, "62")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-bold"
                                                >
                                                    <Phone className="w-3 h-3" /> {s.phone}
                                                </a>
                                            </td>
                                            <td className="p-3 font-mono text-center text-slate-700">{s.bindoScore}</td>
                                            <td className="p-3 font-mono text-center text-slate-700">{s.mtkScore}</td>
                                            <td className="p-3 font-mono font-black text-sm text-center text-blue-900">
                                                {numScore}
                                            </td>
                                            <td className="p-3 text-center font-bold text-[10.5px]">
                                                <span className={isTuntas ? "text-emerald-700" : "text-rose-700"}>
                                                    {isTuntas ? "Tuntas" : "Belum"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-mono text-[9.5px] font-bold border inline-block whitespace-nowrap ${comp.badge}`}>
                                                    {comp.short}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => setSelectedStudentForReport(s)}
                                                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-800 text-[10.5px] sm:text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                                                >
                                                    <Printer className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                                    <span>Rapor & Cetak</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="text-center py-10 text-slate-400 font-medium px-4">
                                            {students.length === 0
                                                ? "Belum ada data peserta Tryout TKA SMP di server. Klik 'Sinkronkan Data' atau pastikan siswa telah mengisi formulir pendaftaran."
                                                : "Tidak ada peserta yang sesuai dengan filter pencarian ini."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ============================================================== */}
            {/* MODAL RAPOR DIAGNOSTIK INDIVIDUAL 1 MURID (SIAP CETAK A4)     */}
            {/* ============================================================== */}
            {selectedStudentForReport && (() => {
                const stu = selectedStudentForReport;
                const totalScore = Math.round(Number(stu.score) || 0);
                const bindoScore = Math.round(Number(stu.bindoScore ?? totalScore));
                const mtkScore = Math.round(Number(stu.mtkScore ?? totalScore));
                const comp = getCompetencyDetail(totalScore);
                const isTuntasTotal = totalScore >= KKM_STANDARD;
                const cleanPhone = String(stu.phone || "").replace(/\D/g, "");
                const voucherCode = `M18-TKA-${cleanPhone.slice(-4) || "2026"}-${totalScore}`;

                return (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl sm:rounded-3xl w-[96vw] sm:max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 my-auto text-left">
                            {/* Action Bar Modal */}
                            <div className="print-hidden p-3.5 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-50 rounded-t-2xl sm:rounded-t-3xl shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
                                        <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                            Lembar Rapor Diagnostik: {stu.name}
                                        </h3>
                                        <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono truncate">
                                            {stu.school} • WA: {stu.phone}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Cetak Rapor (A4)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStudentForReport(null)}
                                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-600 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* AREA DOKUMEN CETAK RESMI A4 */}
                            <div className="p-4 sm:p-8 lg:p-9 overflow-y-auto flex-1 text-slate-900 space-y-4 sm:space-y-5 print-sheet">
                                {/* KOP SURAT STANDAR RESMI SIMETRIS */}
                                <div className="pb-1 overflow-x-auto">
                                    <div className="flex items-center justify-between gap-3 min-w-[520px] sm:min-w-0">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center overflow-hidden">
                                            <img
                                                src="/logo-timsim.jpg"
                                                alt="Logo SMA Muhammadiyah 18 Jakarta"
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLElement).style.display = "none";
                                                }}
                                            />
                                        </div>

                                        <div className="flex-1 text-center px-1 sm:px-2 space-y-0.5">
                                            <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-800 uppercase leading-none font-sans">
                                                MAJELIS PENDIDIKAN DASAR DAN MENENGAH
                                            </h3>
                                            <h4 className="text-[9.5px] sm:text-[10.5px] font-bold tracking-wide text-slate-700 uppercase leading-tight font-sans">
                                                PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN
                                            </h4>
                                            <h1 className="text-lg sm:text-2xl font-black text-slate-950 tracking-tight uppercase leading-tight pt-0.5 font-sans">
                                                SMA MUHAMMADIYAH 18 JAKARTA
                                            </h1>
                                            <p className="text-[11px] sm:text-xs font-black text-[#1e3a8a] tracking-widest font-mono uppercase leading-none">
                                                TERAKREDITASI "A"
                                            </p>
                                            <p className="text-[9px] sm:text-[10px] text-slate-600 leading-tight pt-0.5 font-sans">
                                                Jl. Panjang No.19, RT.8/RW.9, Cipulir, Kebayoran Lama, Jakarta Selatan, DKI Jakarta 12230
                                            </p>
                                            <p className="text-[8.5px] sm:text-[9.5px] font-mono text-slate-600 leading-normal pt-0.5 pb-1">
                                                Website: https://smamuh18jakarta.sch.id • E-mail: smamuh18@gmail.com
                                            </p>
                                        </div>

                                        <div className="w-16 sm:w-20 shrink-0" />
                                    </div>

                                    <div className="w-full kop-divider-thick mt-1.5" />
                                    <div className="w-full kop-divider-thin mt-[2px]" />
                                </div>

                                {/* JUDUL DOKUMEN RAPOR */}
                                <div className="text-center space-y-0.5 pt-0.5">
                                    <h2 className="text-sm sm:text-base font-black tracking-tight underline uppercase">
                                        LEMBAR HASIL TRYOUT TES KEMAMPUAN AKADEMIK (TKA) JENJANG SMP
                                    </h2>
                                    <p className="text-[10.5px] sm:text-xs font-mono text-slate-700 font-semibold">
                                        Penerimaan Peserta Didik Baru (PPDB) Tahun Ajaran 2026/2027 • Skala Nilai 0–100 (KKM {KKM_STANDARD})
                                    </p>
                                </div>

                                {/* BIODATA SISWA */}
                                <div className="border border-slate-900 p-2.5 sm:p-3 bg-slate-50/50 overflow-x-auto">
                                    <table className="w-full text-[11px] sm:text-xs min-w-[480px] sm:min-w-0">
                                        <tbody>
                                            <tr>
                                                <td className="py-1 w-[22%] text-slate-600">Nama Peserta</td>
                                                <td className="py-1 w-[33%] font-bold text-slate-900">: {stu.name}</td>
                                                <td className="py-1 w-[20%] text-slate-600">Peminatan SMA</td>
                                                <td className="py-1 w-[25%] font-bold text-blue-900 truncate">: {stu.interest}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 text-slate-600">Asal Sekolah</td>
                                                <td className="py-1 font-bold">
                                                    : {stu.school} (Kelas {stu.grade})
                                                </td>
                                                <td className="py-1 text-slate-600">No. WhatsApp</td>
                                                <td className="py-1 font-mono font-bold">: {stu.phone}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 text-slate-600">Kode Voucher PPDB</td>
                                                <td className="py-1 font-mono font-black text-blue-800">: {voucherCode}</td>
                                                <td className="py-1 text-slate-600">Kepatuhan Kiosk</td>
                                                <td className="py-1 font-bold text-emerald-800">
                                                    :{" "}
                                                    {Number(stu.violations) === 0
                                                        ? "Tertib (0 Pelanggaran)"
                                                        : `${stu.violations}x Pelanggaran`}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* RINGKASAN SKOR TOTAL */}
                                <div className="p-3.5 sm:p-4 rounded-xl border border-slate-900 text-center bg-slate-50 space-y-1">
                                    <div className="text-[10px] sm:text-[11px] font-mono tracking-widest text-slate-600 uppercase font-bold">
                                        NILAI AKHIR TRYOUT TKA SMP (SKALA 0 – 100)
                                    </div>
                                    <div className="text-3xl sm:text-4xl font-black text-slate-900">
                                        {totalScore} <span className="text-sm font-normal text-slate-500">/ 100</span>
                                    </div>
                                    <div className="text-[10px] sm:text-[10.5px] text-slate-700 font-mono">
                                        Status KKM ({KKM_STANDARD}):{" "}
                                        <strong className="uppercase">{isTuntasTotal ? "TUNTAS" : "BELUM TUNTAS"}</strong> • Predikat:{" "}
                                        <strong className="uppercase underline">{comp.level}</strong>
                                    </div>
                                </div>

                                {/* TABEL RINCIAN 2 MATA PELAJARAN UTAMA TKA SMP */}
                                <div className="space-y-1.5 overflow-x-auto">
                                    <div className="font-bold font-mono text-[10.5px] sm:text-[11px] uppercase tracking-wide">
                                        RINCIAN CAPAIAN & PEMETAAN MATERI TKA SMP:
                                    </div>
                                    <table className="w-full text-xs border border-slate-900 text-left border-collapse min-w-[500px]">
                                        <thead className="bg-slate-100 border-b border-slate-900 font-mono text-[9.5px] sm:text-[10px]">
                                            <tr>
                                                <th className="p-2 border-r border-slate-900 w-10 text-center">NO</th>
                                                <th className="p-2 border-r border-slate-900">MATA PELAJARAN & PEMETAAN MATERI</th>
                                                <th className="p-2 border-r border-slate-900 text-center w-20">KKM</th>
                                                <th className="p-2 border-r border-slate-900 text-center w-24">NILAI</th>
                                                <th className="p-2 text-center w-32">KETUNTASAN</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-300 font-medium text-[11px] sm:text-xs">
                                            <tr>
                                                <td className="p-2.5 text-center font-mono border-r border-slate-300">1</td>
                                                <td className="p-2.5 border-r border-slate-300">
                                                    <div className="font-bold">Bahasa Indonesia (BINDO)</div>
                                                    <div className="text-[10px] text-slate-600">
                                                        Pemetaan Materi: Literasi Membaca (Pemahaman Tekstual, Inferensial & Evaluasi Wacana SMP)
                                                    </div>
                                                </td>
                                                <td className="p-2.5 text-center font-mono border-r border-slate-300">{KKM_STANDARD}</td>
                                                <td className="p-2.5 text-center font-mono font-bold text-blue-900 border-r border-slate-300">
                                                    {bindoScore}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-[10px]">
                                                    {bindoScore >= KKM_STANDARD ? "Tuntas KKM" : "Belum Tuntas"}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="p-2.5 text-center font-mono border-r border-slate-300">2</td>
                                                <td className="p-2.5 border-r border-slate-300">
                                                    <div className="font-bold">Matematika (MTK)</div>
                                                    <div className="text-[10px] text-slate-600">
                                                        Pemetaan Materi: Numerasi SMP (Bilangan, Aljabar, Geometri Pengukuran & Data Peluang)
                                                    </div>
                                                </td>
                                                <td className="p-2.5 text-center font-mono border-r border-slate-300">{KKM_STANDARD}</td>
                                                <td className="p-2.5 text-center font-mono font-bold text-emerald-800 border-r border-slate-300">
                                                    {mtkScore}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-[10px]">
                                                    {mtkScore >= KKM_STANDARD ? "Tuntas KKM" : "Belum Tuntas"}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* REKOMENDASI AKADEMIK & HAK VOUCHER BEASISWA */}
                                <div className="space-y-1">
                                    <div className="font-bold font-mono text-[10.5px] sm:text-[11px] uppercase tracking-wide">
                                        DIAGNOSIS KOMPETENSI & REKOMENDASI BEASISWA PPDB:
                                    </div>
                                    <div className="p-2.5 sm:p-3 border border-slate-900 bg-white text-xs leading-relaxed space-y-1.5">
                                        <p className="italic text-slate-800">“{comp.note}”</p>
                                        <div className="pt-1 border-t border-slate-300 font-bold text-blue-950">
                                            Hak Insentif PPDB: {comp.voucher} (Kode: <span className="font-mono">{voucherCode}</span>)
                                        </div>
                                    </div>
                                </div>

                                {/* TANDA TANGAN PEJABAT */}
                                <div className="pt-4 sm:pt-6 grid grid-cols-2 text-xs text-center border-t border-slate-300">
                                    <div>
                                        <p>Mengetahui,</p>
                                        <p className="font-semibold mt-0.5">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                        <div className="h-14 sm:h-16" />
                                        <p className="font-bold underline text-slate-900">{officials.kepalaSekolahNama}</p>
                                        <p className="text-[9.5px] sm:text-[10px] text-slate-600 font-mono">
                                            NIP/NBM. {officials.kepalaSekolahNbm}
                                        </p>
                                    </div>

                                    <div>
                                        <p>Jakarta, {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
                                        <p className="font-semibold mt-0.5">{officials.koordinatorJabatan}</p>
                                        <div className="h-14 sm:h-16" />
                                        <p className="font-bold underline text-slate-900">{officials.koordinatorNama}</p>
                                        <p className="text-[9.5px] sm:text-[10px] text-slate-600 font-mono">
                                            NIP/NBM. {officials.koordinatorNbm}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}