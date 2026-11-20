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
    RefreshCw,
    SlidersHorizontal,
    X,
    BookOpen,
    Calculator,
    Phone,
    BarChart3,
    Layers,
    Target,
    Download
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface TkaStudentResult {
    phone: string;
    name: string;
    school: string;
    grade: string;
    status: string;
    violations: number;
    score: number;
    bindoScore: number;
    mtkScore: number;
    waktu_selesai?: string;
}

// 7 Elemen Kompetensi Resmi Perkaban Nomor 047/H/AN/2025
const OFFICIAL_COMPETENCIES = [
    { code: "Pemahaman Tekstual", subject: "BINDO", desc: "Informasi tersurat, identifikasi istilah/objek & kerangka teks" },
    { code: "Pemahaman Inferensial", subject: "BINDO", desc: "Ide pokok, kesimpulan tersirat, hubungan antarperistiwa & bahasa kias" },
    { code: "Evaluasi dan Apresiasi", subject: "BINDO", desc: "Menilai relevansi/keakuratan isi & respons unsur teks fiksi" },
    { code: "Bilangan", subject: "MTK", desc: "Bilangan real, pangkat/akar, notasi ilmiah, rasio/skala & perbandingan" },
    { code: "Aljabar", subject: "MTK", desc: "PLSV/PtLSV/SPLDV, bentuk aljabar, relasi fungsi & barisan/deret" },
    { code: "Geometri & Pengukuran", subject: "MTK", desc: "Sudut, Pythagoras, kesebangunan, bangun ruang, transformasi & luas/volume" },
    { code: "Data & Peluang", subject: "MTK", desc: "Penyajian data, pemusatan/penyebaran data & peluang kejadian tunggal" }
];

// Kategori Capaian Resmi Kepmendikdasmen No. 56 Tahun 2026 (Skala 0,00 - 100,00)
function getKepmendikdasmen56Detail(score: number) {
    const num = Number(score) || 0;
    if (num >= 95.0) {
        return {
            level: "Istimewa",
            badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
            barColor: "bg-indigo-600",
            voucher: "Voucher Beasiswa Istimewa Bebas Biaya SPP / Uang Pangkal s.d. 100%",
            note: "Predikat khusus bagi peserta didik dengan penguasaan materi dan penalaran tingkat tinggi yang sangat unggul."
        };
    }
    if (num >= 76.67) {
        return {
            level: "Baik",
            badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
            barColor: "bg-emerald-600",
            voucher: "Voucher Beasiswa Jalur Prestasi Akademik PPDB (Potongan s.d. 50%)",
            note: "Menggambarkan pemahaman materi yang kuat dan konsisten dalam mengaplikasikan konsep pada berbagai konteks."
        };
    }
    if (num >= 50.0) {
        return {
            level: "Memadai",
            badge: "bg-blue-50 text-blue-800 border-blue-200",
            barColor: "bg-blue-600",
            voucher: "Potongan Khusus Biaya Masuk Gelombang Awal PPDB",
            note: "Menandakan kemampuan dasar yang cukup sesuai standar minimum pada mata uji terkait."
        };
    }
    return {
        level: "Kurang",
        badge: "bg-rose-50 text-rose-800 border-rose-200",
        barColor: "bg-rose-500",
        voucher: "Program Klinik Belajar & Subsidi Registrasi Awal PPDB",
        note: "Menunjukkan perlunya penguatan kompetensi fundamental dan pendampingan belajar pada mata uji terkait."
    };
}

function formatScoreID(score: number): string {
    return (Number(score) || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function mapQuestionToOfficialElement(subtesCode: string, rawMateri?: string): string {
    const m = String(rawMateri || "").toLowerCase();
    if (subtesCode === "BINDO") {
        if (m.includes("inferen") || m.includes("tersirat") || m.includes("ide pokok")) return "Pemahaman Inferensial";
        if (m.includes("evaluasi") || m.includes("apresiasi") || m.includes("refleksi")) return "Evaluasi dan Apresiasi";
        return "Pemahaman Tekstual";
    } else {
        if (m.includes("aljabar") || m.includes("persamaan") || m.includes("fungsi") || m.includes("barisan")) return "Aljabar";
        if (m.includes("geometri") || m.includes("ukur") || m.includes("sudut") || m.includes("pythagoras") || m.includes("bangun"))
            return "Geometri & Pengukuran";
        if (m.includes("data") || m.includes("peluang") || m.includes("statis")) return "Data & Peluang";
        return "Bilangan";
    }
}

export default function AdminAnalyticsTkaSmpPage() {
    const [students, setStudents] = useState<TkaStudentResult[]>([]);
    const [questionsBank, setQuestionsBank] = useState<any[]>([]);
    const [rawResultsList, setRawResultsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"prospek" | "materi" | "butir">("prospek");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSchool, setSelectedSchool] = useState("ALL");

    const [officials, setOfficials] = useState({
        kepalaSekolahNama: "Drs. H. Ahmad Dahlan, M.Pd.",
        kepalaSekolahNbm: "882.118.001",
        koordinatorNama: "Fadhillah Umar, S.Pd.",
        koordinatorNbm: "118.2026.091",
        koordinatorJabatan: "Koordinator Kurikulum & Asesmen PPDB"
    });

    const [selectedStudentForReport, setSelectedStudentForReport] = useState<TkaStudentResult | null>(null);

    const fetchAllAnalyticsData = async () => {
        setIsLoading(true);
        try {
            const [stuRes, qRes, resRes] = await Promise.all([
                supabase.from("tka_students").select("*").order("score", { ascending: false }),
                supabase
                    .from("tka_questions")
                    .select("*")
                    .order("subtes_code", { ascending: true })
                    .order("no_soal", { ascending: true }),
                supabase.from("tka_results").select("*").order("created_at", { ascending: false })
            ]);

            if (stuRes.error) {
                alert("Gagal memuat data dari Supabase: " + stuRes.error.message);
                return;
            }

            if (Array.isArray(stuRes.data)) {
                const normalized: TkaStudentResult[] = stuRes.data.map((item: any) => {
                    const cleanScore = Number(item.score ?? 0);
                    const bindoVal = Number(item.bindo_score ?? cleanScore);
                    const mtkVal = Number(item.mtk_score ?? cleanScore);

                    return {
                        phone: String(item.phone || "-"),
                        name: String(item.name || "PESERTA SIMULASI").toUpperCase(),
                        school: String(item.school || "SMP / MTs").toUpperCase(),
                        grade: String(item.grade || "9"),
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

            if (!qRes.error && Array.isArray(qRes.data)) {
                setQuestionsBank(qRes.data);
            }
            if (!resRes.error && Array.isArray(resRes.data)) {
                setRawResultsList(resRes.data);
            }
        } catch (err) {
            console.error("Gagal memuat analitik TKA SMP dari Supabase:", err);
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

        fetchAllAnalyticsData();
    }, []);

    const rankedStudents = useMemo(() => {
        return [...students].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    }, [students]);

    const availableSchools = useMemo(() => {
        const setSch = new Set<string>();
        students.forEach((s) => {
            if (s.school && s.school.trim()) setSch.add(s.school.trim());
        });
        return Array.from(setSch).sort();
    }, [students]);

    const filteredStudents = useMemo(() => {
        return rankedStudents.filter((s) => {
            const matchSchool = selectedSchool === "ALL" || s.school === selectedSchool;
            const q = searchQuery.toLowerCase();
            const matchSearch =
                s.name.toLowerCase().includes(q) ||
                s.school.toLowerCase().includes(q) ||
                s.phone.includes(searchQuery);
            return matchSchool && matchSearch;
        });
    }, [rankedStudents, selectedSchool, searchQuery]);

    // Statistik Agregat Berdasarkan Kepmendikdasmen No. 56 Tahun 2026
    const overallStats = useMemo(() => {
        const scopeStudents =
            selectedSchool === "ALL" ? students : students.filter((s) => s.school === selectedSchool);
        const finished = scopeStudents.filter((s) => s.status === "Selesai" || s.score > 0);
        const totalSelesai = finished.length;
        const totalProspek = scopeStudents.length;

        const avgScore =
            totalSelesai > 0
                ? Number((finished.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / totalSelesai).toFixed(2))
                : 0;

        const avgBindo =
            totalSelesai > 0
                ? Number((finished.reduce((acc, curr) => acc + (Number(curr.bindoScore) || 0), 0) / totalSelesai).toFixed(2))
                : 0;

        const avgMtk =
            totalSelesai > 0
                ? Number((finished.reduce((acc, curr) => acc + (Number(curr.mtkScore) || 0), 0) / totalSelesai).toFixed(2))
                : 0;

        const totalPelanggaran = finished.reduce((acc, curr) => acc + (Number(curr.violations) || 0), 0);
        const integritasRate = Math.max(0, 100 - totalPelanggaran * 3);

        // Distribusi 4 Kategori Resmi Kepmendikdasmen No. 56/2026 per Mata Uji
        const countCategories = (scores: number[]) => ({
            istimewa: scores.filter((v) => v >= 95.0).length,
            baik: scores.filter((v) => v >= 76.67 && v < 95.0).length,
            memadai: scores.filter((v) => v >= 50.0 && v < 76.67).length,
            kurang: scores.filter((v) => v < 50.0).length
        });

        const bindoDist = countCategories(finished.map((s) => Number(s.bindoScore) || 0));
        const mtkDist = countCategories(finished.map((s) => Number(s.mtkScore) || 0));

        return {
            totalProspek,
            totalSelesai,
            avgScore,
            avgBindo,
            avgMtk,
            integritasRate,
            bindoDist,
            mtkDist
        };
    }, [students, selectedSchool]);

    // Analisis Butir Soal & 7 Elemen Kompetensi (Perkaban No. 047/H/AN/2025)
    const { itemAnalysisList, elementAnalysisList } = useMemo(() => {
        const scopedResults =
            selectedSchool === "ALL"
                ? rawResultsList
                : rawResultsList.filter((r) => String(r.school || "").toUpperCase() === selectedSchool);

        const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

        const items = questionsBank.map((q: any, idx: number) => {
            const code = String(q.subtes_code || "").toUpperCase().includes("MTK") ? "MTK" : "BINDO";
            const qId = String(q.id);
            const element = mapQuestionToOfficialElement(code, q.materi);
            const rawKey = String(q.kunci || "A").toUpperCase().trim();
            const targetIdx = keyMap[rawKey] ?? 0;

            let totalAttempt = 0;
            let correctCount = 0;
            const optionCounts = [0, 0, 0, 0, 0];

            scopedResults.forEach((res) => {
                const ansObj = res.answers || {};
                const userAns = ansObj[qId];
                if (userAns !== undefined && userAns !== null) {
                    totalAttempt++;
                    if (typeof userAns === "number") {
                        if (userAns >= 0 && userAns <= 4) optionCounts[userAns]++;
                        if (userAns === targetIdx) correctCount++;
                    } else if (Array.isArray(userAns)) {
                        userAns.forEach((optI: number) => {
                            if (optI >= 0 && optI <= 4) optionCounts[optI]++;
                        });
                        const correctKeys = rawKey.split(",").map((k) => keyMap[k.trim()] ?? -1);
                        const isExact =
                            userAns.length === correctKeys.length && correctKeys.every((ck) => userAns.includes(ck));
                        if (isExact) correctCount++;
                    }
                }
            });

            const pIndex = totalAttempt > 0 ? Number(((correctCount / totalAttempt) * 100).toFixed(2)) : 0;
            let difficultyLabel = "Sedang";
            let difficultyBadge = "bg-blue-50 text-blue-800 border-blue-200";
            if (totalAttempt === 0) {
                difficultyLabel = "Belum Diuji";
                difficultyBadge = "bg-slate-100 text-slate-500 border-slate-200";
            } else if (pIndex > 70) {
                difficultyLabel = "Mudah";
                difficultyBadge = "bg-emerald-50 text-emerald-800 border-emerald-200";
            } else if (pIndex < 30) {
                difficultyLabel = "Sukar";
                difficultyBadge = "bg-rose-50 text-rose-800 border-rose-200";
            }

            return {
                id: qId,
                no_soal: q.no_soal || idx + 1,
                subtes_code: code,
                element,
                pertanyaan: String(q.pertanyaan || ""),
                kunci: rawKey,
                totalAttempt,
                correctCount,
                pIndex,
                difficultyLabel,
                difficultyBadge,
                optionCounts
            };
        });

        const elements = OFFICIAL_COMPETENCIES.map((comp) => {
            const matchedItems = items.filter((it) => it.element === comp.code && it.totalAttempt > 0);
            const totalAnswers = matchedItems.reduce((sum, it) => sum + it.totalAttempt, 0);
            const totalCorrects = matchedItems.reduce((sum, it) => sum + it.correctCount, 0);
            const masteryPct = totalAnswers > 0 ? Number(((totalCorrects / totalAnswers) * 100).toFixed(2)) : 0;
            const cat = getKepmendikdasmen56Detail(masteryPct);

            return {
                ...comp,
                questionCount: items.filter((it) => it.element === comp.code).length,
                testedQuestionCount: matchedItems.length,
                masteryPct,
                category: totalAnswers > 0 ? cat.level : "Belum Ada Data",
                badge: totalAnswers > 0 ? cat.badge : "bg-slate-100 text-slate-500 border-slate-200",
                barColor: totalAnswers > 0 ? cat.barColor : "bg-slate-300"
            };
        });

        return { itemAnalysisList: items, elementAnalysisList: elements };
    }, [questionsBank, rawResultsList, selectedSchool]);

    const handleExportCsvLeads = () => {
        if (filteredStudents.length === 0) return;
        const headers =
            "Rank,Nama Peserta,Asal Sekolah SMP/MTs,Kelas,No. WhatsApp,Nilai BINDO,Kategori BINDO,Nilai MTK,Kategori MTK,Rerata Indeks,Status\n";
        const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

        const rows = filteredStudents
            .map((s, idx) => {
                const bCat = getKepmendikdasmen56Detail(s.bindoScore).level;
                const mCat = getKepmendikdasmen56Detail(s.mtkScore).level;
                return [
                    idx + 1,
                    esc(s.name),
                    esc(s.school),
                    esc(`Kelas ${s.grade}`),
                    esc(s.phone),
                    esc(formatScoreID(s.bindoScore)),
                    esc(bCat),
                    esc(formatScoreID(s.mtkScore)),
                    esc(mCat),
                    esc(formatScoreID(s.score)),
                    esc(s.status)
                ].join(",");
            })
            .join("\n");

        const blob = new Blob(["\ufeff", headers + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Analisis_SHTKA_SMP_M18_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 overflow-x-hidden">
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
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                color: #000000 !important;
                font-family: 'Times New Roman', Times, serif !important;
                font-size: 11pt !important;
                -webkit-print-color-adjust: exact !important;
              }
              .print-hidden {
                display: none !important;
              }
              .print-sheet {
                background: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
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

            {/* HEADER */}
            <header className="print-hidden bg-white border-b border-slate-200/90 py-3 sm:py-3.5 px-3 sm:px-6 lg:px-8 sticky top-0 z-30 shadow-2xs">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Link
                            href="/admin"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shrink-0 cursor-pointer"
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
                                DASHBOARD ANALITIK & SHTKA TRYOUT TKA SMP
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                Kepmendikdasmen No. 56/2026 & Perkaban No. 047/H/AN/2025 • SMA Muhammadiyah 18 Jakarta
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                            onClick={fetchAllAnalyticsData}
                            disabled={isLoading}
                            className="px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
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

            <div className="max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 text-left">
                {/* FILTER SEKOLAH ASAL SMP GLOBAL UNTUK SELURUH ANALISIS */}
                <div className="print-hidden bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-black text-slate-900">Filter Cakupan Analisis Sekolah Asal (SMP/MTs Mitra)</div>
                        <div className="text-[11px] text-slate-500">
                            Pilih sekolah asal untuk membedah rapor kolektif, penguasaan 7 elemen materi, dan analisis butir khusus sekolah tersebut.
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={selectedSchool}
                            onChange={(e) => setSelectedSchool(e.target.value)}
                            className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-950 text-xs font-bold outline-none cursor-pointer"
                        >
                            <option value="ALL">Semua Sekolah Asal ({students.length} Peserta)</option>
                            {availableSchools.map((sch) => (
                                <option key={sch} value={sch}>
                                    {sch}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 4 INDIKATOR AGREGAT */}
                <div className="print-hidden grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-blue-700 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>RERATA B. INDONESIA</span>
                            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-blue-900 mt-1 sm:mt-2 font-mono">
                            {formatScoreID(overallStats.avgBindo)}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Kategori: <strong>{getKepmendikdasmen56Detail(overallStats.avgBindo).level}</strong>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-emerald-700 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>RERATA MATEMATIKA</span>
                            <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1 sm:mt-2 font-mono">
                            {formatScoreID(overallStats.avgMtk)}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Kategori: <strong>{getKepmendikdasmen56Detail(overallStats.avgMtk).level}</strong>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>PESERTA SELESAI</span>
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 font-mono">
                            {overallStats.totalSelesai}{" "}
                            <span className="text-xs font-normal text-slate-400">/ {overallStats.totalProspek}</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Calon Siswa SMP/MTs
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>INTEGRITAS KIOSK</span>
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 font-mono">
                            {overallStats.integritasRate}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Kepatuhan Layar Penuh
                        </div>
                    </div>
                </div>

                {/* BAR NAVIGASI 3 TAB ANALISIS LENGKAP */}
                <div className="print-hidden grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300">
                    <button
                        type="button"
                        onClick={() => setActiveTab("prospek")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "prospek" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>1. Rekap SHTKA & Prospek PPDB</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("materi")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "materi" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span>2. Analisis 7 Elemen Materi</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("butir")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "butir" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Target className="w-4 h-4 text-emerald-600" />
                        <span>3. Analisis Butir Soal ({itemAnalysisList.length})</span>
                    </button>
                </div>

                {/* ============================================================== */}
                {/* TAB 1: REKAP SHTKA PER MATA UJI & DATA PROSPEK PPDB            */}
                {/* ============================================================== */}
                {activeTab === "prospek" && (
                    <div className="print-hidden space-y-5">
                        {/* Distribusi 4 Kategori Kepmendikdasmen No. 56/2026 per Mata Uji */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Distribusi Bahasa Indonesia */}
                            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-blue-700" />
                                        <h3 className="text-xs sm:text-sm font-black text-slate-900">
                                            Sebaran Capaian Bahasa Indonesia (BINDO)
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">Kepmendikdasmen 56/2026</span>
                                </div>

                                <div className="space-y-2.5 text-xs">
                                    {[
                                        { label: "Istimewa (>= 95,00)", count: overallStats.bindoDist.istimewa, color: "bg-indigo-600" },
                                        { label: "Baik (76,67 – 94,99)", count: overallStats.bindoDist.baik, color: "bg-emerald-600" },
                                        { label: "Memadai (50,00 – 76,66)", count: overallStats.bindoDist.memadai, color: "bg-blue-600" },
                                        { label: "Kurang (< 50,00)", count: overallStats.bindoDist.kurang, color: "bg-rose-500" }
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
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Distribusi Matematika */}
                            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <Calculator className="w-4 h-4 text-emerald-700" />
                                        <h3 className="text-xs sm:text-sm font-black text-slate-900">
                                            Sebaran Capaian Matematika (MTK)
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">Kepmendikdasmen 56/2026</span>
                                </div>

                                <div className="space-y-2.5 text-xs">
                                    {[
                                        { label: "Istimewa (>= 95,00)", count: overallStats.mtkDist.istimewa, color: "bg-indigo-600" },
                                        { label: "Baik (76,67 – 94,99)", count: overallStats.mtkDist.baik, color: "bg-emerald-600" },
                                        { label: "Memadai (50,00 – 76,66)", count: overallStats.mtkDist.memadai, color: "bg-blue-600" },
                                        { label: "Kurang (< 50,00)", count: overallStats.mtkDist.kurang, color: "bg-rose-500" }
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
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Tabel Peringkat & Leads PPDB */}
                        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-8 space-y-4 shadow-2xs">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                                        Daftar Sertifikat Hasil & Prospek Peserta ({filteredStudents.length} Siswa)
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Penilaian terpisah per mata uji (Skala 0,00–100,00 tanpa KKM).
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Cari Nama / SMP / WA..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-48 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-700"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleExportCsvLeads}
                                        className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Export Excel / CSV</span>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[860px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] text-slate-600">
                                        <tr>
                                            <th className="p-3 w-12">Rank</th>
                                            <th className="p-3">Nama Peserta</th>
                                            <th className="p-3">Asal SMP/MTs</th>
                                            <th className="p-3">No. WhatsApp</th>
                                            <th className="p-3 text-center">BINDO</th>
                                            <th className="p-3 text-center">Kategori BINDO</th>
                                            <th className="p-3 text-center">MTK</th>
                                            <th className="p-3 text-center">Kategori MTK</th>
                                            <th className="p-3 text-right">Sertifikat A4</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {filteredStudents.map((s, idx) => {
                                            const bindoCat = getKepmendikdasmen56Detail(s.bindoScore);
                                            const mtkCat = getKepmendikdasmen56Detail(s.mtkScore);

                                            return (
                                                <tr key={`${s.phone}_${idx}`} className="hover:bg-slate-50/70">
                                                    <td className="p-3 font-mono font-bold text-blue-700">#{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900">{s.name}</div>
                                                        <div className="text-[10px] text-slate-500">Kelas {s.grade}</div>
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
                                                    <td className="p-3 font-mono font-bold text-center text-blue-900">
                                                        {formatScoreID(s.bindoScore)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9.5px] font-bold border ${bindoCat.badge}`}>
                                                            {bindoCat.level}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-center text-emerald-800">
                                                        {formatScoreID(s.mtkScore)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9.5px] font-bold border ${mtkCat.badge}`}>
                                                            {mtkCat.level}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => setSelectedStudentForReport(s)}
                                                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Printer className="w-3.5 h-3.5 text-blue-700" />
                                                            <span>Cetak SHTKA</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pengaturan Pejabat Penandatangan */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                                <SlidersHorizontal className="w-4 h-4 text-blue-700 shrink-0" />
                                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                                    Pengaturan Pejabat Penandatangan SHTKA
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                                <div className="space-y-1">
                                    <label className="font-bold font-mono text-slate-700 text-[10.5px]">NAMA KEPALA SEKOLAH:</label>
                                    <input
                                        type="text"
                                        value={officials.kepalaSekolahNama}
                                        onChange={(e) => setOfficials({ ...officials, kepalaSekolahNama: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-bold font-mono text-slate-700 text-[10.5px]">NIP / NBM KEPALA SEKOLAH:</label>
                                    <input
                                        type="text"
                                        value={officials.kepalaSekolahNbm}
                                        onChange={(e) => setOfficials({ ...officials, kepalaSekolahNbm: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono outline-none text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-bold font-mono text-slate-700 text-[10.5px]">NAMA KOORDINATOR:</label>
                                    <input
                                        type="text"
                                        value={officials.koordinatorNama}
                                        onChange={(e) => setOfficials({ ...officials, koordinatorNama: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 2: ANALISIS 7 ELEMEN MATERI (PERKABAN NO. 047/H/AN/2025)   */}
                {/* ============================================================== */}
                {activeTab === "materi" && (
                    <div className="print-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-2xs space-y-5">
                        <div className="border-b border-slate-100 pb-3.5">
                            <h3 className="text-sm sm:text-base font-black text-slate-900">
                                Pemetaan Penguasaan 7 Elemen Materi TKA SMP (Perkaban No. 047/H/AN/2025)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Diagnostik tingkat ketepatan jawaban siswa pada setiap elemen kompetensi Bahasa Indonesia (3 kompetensi) dan Matematika (4 elemen).
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {elementAnalysisList.map((el) => (
                                <div
                                    key={el.code}
                                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5 flex flex-col justify-between"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${el.subject === "MTK"
                                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                    : "bg-blue-50 text-blue-800 border-blue-200"
                                                    }`}
                                            >
                                                {el.subject === "MTK" ? "MATEMATIKA" : "BAHASA INDONESIA"} • {el.questionCount} Soal
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${el.badge}`}>
                                                {el.category}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 pt-1">{el.code}</h4>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{el.desc}</p>
                                    </div>

                                    <div className="space-y-1.5 pt-2">
                                        <div className="flex justify-between font-mono text-xs font-bold">
                                            <span className="text-slate-500">Indeks Penguasaan:</span>
                                            <span className="text-slate-900">{formatScoreID(el.masteryPct)}%</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${el.barColor}`} style={{ width: `${Math.min(100, el.masteryPct)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 3: ANALISIS BUTIR SOAL (ITEM ANALYSIS & DISTRACTOR)        */}
                {/* ============================================================== */}
                {activeTab === "butir" && (
                    <div className="print-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-2xs space-y-4">
                        <div className="border-b border-slate-100 pb-3.5">
                            <h3 className="text-sm sm:text-base font-black text-slate-900">
                                Analisis Kualitas Butir Soal (Tingkat Kesukaran Empiris & Sebaran Opsi)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Mengevaluasi persentase siswa menjawab benar (Indeks P) serta distribusi pemilihan opsi A–E untuk mendeteksi efektivitas pengecoh.
                            </p>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse min-w-[820px]">
                                <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] text-slate-600">
                                    <tr>
                                        <th className="p-3 w-12 text-center">No</th>
                                        <th className="p-3 w-20">Mapel</th>
                                        <th className="p-3 w-44">Elemen Materi</th>
                                        <th className="p-3">Cuplikan Pertanyaan</th>
                                        <th className="p-3 text-center w-16">Kunci</th>
                                        <th className="p-3 text-center w-24">Benar (%)</th>
                                        <th className="p-3 text-center w-28">Kesukaran</th>
                                        <th className="p-3 text-center w-44">Sebaran Opsi (A–E)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {itemAnalysisList.map((it) => (
                                        <tr key={it.id} className="hover:bg-slate-50/70">
                                            <td className="p-3 text-center font-mono font-bold text-blue-700">#{it.no_soal}</td>
                                            <td className="p-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${it.subtes_code === "MTK"
                                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                        : "bg-blue-50 text-blue-800 border-blue-200"
                                                        }`}
                                                >
                                                    {it.subtes_code}
                                                </span>
                                            </td>
                                            <td className="p-3 font-semibold text-slate-700">{it.element}</td>
                                            <td className="p-3 text-slate-800 max-w-xs truncate">{it.pertanyaan}</td>
                                            <td className="p-3 text-center font-mono font-black text-emerald-700">{it.kunci}</td>
                                            <td className="p-3 text-center font-mono font-bold">
                                                {it.totalAttempt > 0 ? `${formatScoreID(it.pIndex)}%` : "-"}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${it.difficultyBadge}`}>
                                                    {it.difficultyLabel}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-mono text-[10.5px] text-slate-600">
                                                {it.totalAttempt > 0
                                                    ? `A:${it.optionCounts[0]} B:${it.optionCounts[1]} C:${it.optionCounts[2]} D:${it.optionCounts[3]}`
                                                    : "Belum ada respon"}
                                            </td>
                                        </tr>
                                    ))}
                                    {itemAnalysisList.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="text-center py-8 text-slate-400">
                                                Belum ada soal di bank soal Supabase.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CETAK SHTKA INDIVIDUAL A4 */}
            {selectedStudentForReport && (() => {
                const stu = selectedStudentForReport;
                const bindoScore = Number(stu.bindoScore ?? stu.score ?? 0);
                const mtkScore = Number(stu.mtkScore ?? stu.score ?? 0);
                const bindoCat = getKepmendikdasmen56Detail(bindoScore);
                const mtkCat = getKepmendikdasmen56Detail(mtkScore);
                const bestCat = bindoScore >= mtkScore ? bindoCat : mtkCat;
                const cleanPhone = String(stu.phone || "").replace(/\D/g, "");
                const voucherCode = `M18-SHTKA-${cleanPhone.slice(-4) || "2026"}-${Math.round(stu.score)}`;

                return (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl sm:rounded-3xl w-[96vw] sm:max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 my-auto text-left">
                            <div className="print-hidden p-3.5 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-2.5 bg-slate-50 rounded-t-2xl sm:rounded-t-3xl shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                                        <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                            Sertifikat Hasil Tryout TKA SMP: {stu.name}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">
                                            {stu.school} • WA: {stu.phone}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="px-4 py-2 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Cetak SHTKA (A4)</span>
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

                            <div className="p-4 sm:p-9 overflow-y-auto flex-1 text-slate-900 space-y-5 print-sheet">
                                <div className="pb-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                                            <img src="/logo-timsim.jpg" alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1 text-center space-y-0.5">
                                            <h3 className="text-[11px] font-bold uppercase font-sans">
                                                MAJELIS PENDIDIKAN DASAR DAN MENENGAH PDM JAKARTA SELATAN
                                            </h3>
                                            <h1 className="text-lg sm:text-2xl font-black uppercase font-sans">
                                                SMA MUHAMMADIYAH 18 JAKARTA
                                            </h1>
                                            <p className="text-[10px] text-slate-600 font-sans">
                                                Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230
                                            </p>
                                        </div>
                                        <div className="w-16 shrink-0" />
                                    </div>
                                    <div className="w-full kop-divider-thick mt-1.5" />
                                    <div className="w-full kop-divider-thin mt-[2px]" />
                                </div>

                                <div className="text-center space-y-0.5">
                                    <h2 className="text-sm sm:text-base font-black underline uppercase">
                                        SERTIFIKAT HASIL TRYOUT TES KEMAMPUAN AKADEMIK (SHTKA) SMP/MTs
                                    </h2>
                                    <p className="text-xs font-mono text-slate-700">
                                        Standar Kepmendikdasmen No. 56 Tahun 2026 • Skala 0,00 – 100,00
                                    </p>
                                </div>

                                <div className="border border-slate-900 p-3 bg-slate-50/50 text-xs">
                                    <table className="w-full">
                                        <tbody>
                                            <tr>
                                                <td className="py-1 w-[22%] text-slate-600">Nama Peserta</td>
                                                <td className="py-1 w-[38%] font-bold">: {stu.name}</td>
                                                <td className="py-1 w-[18%] text-slate-600">No. WhatsApp</td>
                                                <td className="py-1 font-mono font-bold">: {stu.phone}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 text-slate-600">Asal Sekolah</td>
                                                <td className="py-1 font-bold">: {stu.school} (Kelas {stu.grade})</td>
                                                <td className="py-1 text-slate-600">Kode Voucher</td>
                                                <td className="py-1 font-mono font-black text-blue-900">: {voucherCode}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <table className="w-full text-xs border border-slate-900 text-left border-collapse">
                                    <thead className="bg-slate-100 border-b border-slate-900 font-mono text-[10px]">
                                        <tr>
                                            <th className="p-2 border-r border-slate-900 w-10 text-center">NO</th>
                                            <th className="p-2 border-r border-slate-900">MATA UJI TKA SMP/MTs</th>
                                            <th className="p-2 border-r border-slate-900 text-center w-32">NILAI (0,00–100,00)</th>
                                            <th className="p-2 text-center w-36">KATEGORI CAPAIAN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300 font-medium">
                                        <tr>
                                            <td className="p-2.5 text-center font-mono border-r border-slate-300">1</td>
                                            <td className="p-2.5 border-r border-slate-300">
                                                <div className="font-bold">Bahasa Indonesia (BINDO)</div>
                                                <div className="text-[10px] text-slate-600">
                                                    Literasi Membaca: Pemahaman Tekstual, Inferensial & Evaluasi/Apresiasi
                                                </div>
                                            </td>
                                            <td className="p-2.5 text-center font-mono font-bold text-blue-900 border-r border-slate-300">
                                                {formatScoreID(bindoScore)}
                                            </td>
                                            <td className="p-2.5 text-center font-bold">{bindoCat.level}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 text-center font-mono border-r border-slate-300">2</td>
                                            <td className="p-2.5 border-r border-slate-300">
                                                <div className="font-bold">Matematika (MTK)</div>
                                                <div className="text-[10px] text-slate-600">
                                                    Numerasi SMP: Bilangan, Aljabar, Geometri & Pengukuran, Data & Peluang
                                                </div>
                                            </td>
                                            <td className="p-2.5 text-center font-mono font-bold text-emerald-800 border-r border-slate-300">
                                                {formatScoreID(mtkScore)}
                                            </td>
                                            <td className="p-2.5 text-center font-bold">{mtkCat.level}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="p-3 border border-slate-900 bg-white text-xs space-y-1">
                                    <div className="font-bold font-mono text-[10.5px] uppercase">
                                        REKOMENDASI JALUR PRESTASI PPDB SMA MUHAMMADIYAH 18 JAKARTA:
                                    </div>
                                    <div className="font-bold text-blue-950">
                                        {bestCat.voucher} (Kode: <span className="font-mono">{voucherCode}</span>)
                                    </div>
                                    <p className="text-[10px] text-slate-600">
                                        *Acuan Kepmendikdasmen No. 56/2026: Istimewa (≥95,00), Baik (76,67–94,99), Memadai (50,00–76,66), Kurang (≤50,00).
                                    </p>
                                </div>

                                <div className="pt-5 grid grid-cols-2 text-xs text-center border-t border-slate-300">
                                    <div>
                                        <p>Mengetahui,</p>
                                        <p className="font-semibold">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                        <div className="h-14" />
                                        <p className="font-bold underline">{officials.kepalaSekolahNama}</p>
                                        <p className="text-[10px] font-mono">NBM. {officials.kepalaSekolahNbm}</p>
                                    </div>
                                    <div>
                                        <p>Jakarta, {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
                                        <p className="font-semibold">{officials.koordinatorJabatan}</p>
                                        <div className="h-14" />
                                        <p className="font-bold underline">{officials.koordinatorNama}</p>
                                        <p className="text-[10px] font-mono">NBM/NIP. {officials.koordinatorNbm}</p>
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