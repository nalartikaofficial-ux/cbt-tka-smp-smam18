"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Award,
    CheckCircle2,
    AlertTriangle,
    Home,
    Printer,
    MessageCircle,
    Sparkles,
    ChevronLeft,
    ShieldCheck,
    BookOpen,
    Calculator,
    FileText,
    XCircle,
    Eye,
    EyeOff,
    CheckSquare
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

const KKM_STANDARD = 75;

// Helper Render Formula LaTeX / KaTeX (Anti-Crash & Responsif)
function RenderLatex({ content }: { content?: any }) {
    const safeText = String(content ?? "").trim();
    if (!safeText) return null;

    const parts = safeText.split(/(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g);

    return (
        <span>
            {parts.map((part, idx) => {
                if (part.startsWith("$$") && part.endsWith("$$")) {
                    const math = part.slice(2, -2);
                    try {
                        const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
                        return (
                            <span
                                key={idx}
                                className="block my-2 overflow-x-auto py-1 max-w-full text-center"
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        );
                    } catch {
                        return <span key={idx}>{part}</span>;
                    }
                } else if (part.startsWith("$") && part.endsWith("$")) {
                    const math = part.slice(1, -1);
                    try {
                        const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                        return (
                            <span
                                key={idx}
                                className="inline-block px-0.5 align-middle max-w-full overflow-x-auto"
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        );
                    } catch {
                        return <span key={idx}>{part}</span>;
                    }
                }
                return <span key={idx}>{part}</span>;
            })}
        </span>
    );
}

export default function ExamResultPage() {
    const router = useRouter();
    const [result, setResult] = useState<any>(null);
    const [hasChecked, setHasChecked] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [reviewFilter, setReviewFilter] = useState<"ALL" | "BINDO" | "MTK">("ALL");

    useEffect(() => {
        // Lepas mode fullscreen secara aman saat masuk ke lembar hasil
        if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        }

        const rawTka = localStorage.getItem("tka_result");
        const rawLegacy = localStorage.getItem("cbt_exam_result");

        if (rawTka) {
            try {
                setResult(JSON.parse(rawTka));
            } catch { }
        } else if (rawLegacy) {
            try {
                const parsed = JSON.parse(rawLegacy);
                const rawScore = Number(parsed.score ?? parsed.totalScore ?? 0);
                const normalizedScore =
                    rawScore > 100
                        ? Math.min(100, Math.max(0, Math.round(((rawScore - 200) / 600) * 100)))
                        : rawScore;

                setResult({
                    student: {
                        name: parsed?.student?.candidateName || parsed?.student?.name || "Peserta Ujian",
                        school: parsed?.student?.school || "SMP / MTs",
                        grade: parsed?.student?.grade || "9",
                        phone: parsed?.student?.phone || parsed?.student?.nisn || "-",
                        interest: parsed?.student?.interest || "Sains & Teknologi (STEM)"
                    },
                    totalScore: normalizedScore,
                    bindoScore: Number(parsed.bindoScore ?? parsed.indoScore ?? normalizedScore),
                    mtkScore: Number(parsed.mtkScore ?? parsed.mathScore ?? normalizedScore),
                    kkm: KKM_STANDARD,
                    violations: parsed.violations || 0,
                    submittedAt: new Date().toISOString()
                });
            } catch { }
        }

        setHasChecked(true);
    }, []);

    const handleFinishAndHome = () => {
        localStorage.removeItem("tka_student");
        localStorage.removeItem("cbt_student_session");
        sessionStorage.clear();
        router.push("/");
    };

    // Analisis Per Butir Soal & Pemetaan Materi (untuk Review Pembahasan & Tabel Diagnostik)
    const itemDiagnostics = useMemo(() => {
        if (!result || !Array.isArray(result.questionsSnapshot)) return [];
        const ansMap = result.answers || {};

        return result.questionsSnapshot.map((q: any, idx: number) => {
            const code = q.subtes_code === "MTK" || q.subtes_code === "PM" ? "MTK" : "BINDO";
            const qKey = q.id ? String(q.id) : `${code}_${idx}`;
            const userAns = ansMap[qKey];
            let status: "BENAR" | "SEBAGIAN" | "SALAH" | "KOSONG" = "KOSONG";
            let userAnsLabel = "Tidak Dijawab";
            let keyLabel = "";

            if (!q.type || q.type === "PG_SEDERHANA") {
                const abc = ["A", "B", "C", "D", "E"];
                const targetIdx = typeof q.singleAnswer === "number" ? q.singleAnswer : 0;
                keyLabel = abc[targetIdx] || "A";

                if (userAns !== undefined && userAns !== null) {
                    userAnsLabel = abc[Number(userAns)] || "-";
                    status = Number(userAns) === targetIdx ? "BENAR" : "SALAH";
                }
            } else if (q.type === "PGK_MCMA") {
                const abc = ["A", "B", "C", "D", "E"];
                const correctArr: number[] = Array.isArray(q.multiAnswers) ? q.multiAnswers : [];
                keyLabel = correctArr.map((i) => abc[i]).join(", ") || "-";

                if (Array.isArray(userAns) && userAns.length > 0) {
                    userAnsLabel = [...userAns].sort().map((i) => abc[i]).join(", ");
                    const matchCount = userAns.filter((val) => correctArr.includes(val)).length;
                    const wrongCount = userAns.filter((val) => !correctArr.includes(val)).length;
                    if (matchCount === correctArr.length && wrongCount === 0) status = "BENAR";
                    else if (matchCount > wrongCount) status = "SEBAGIAN";
                    else status = "SALAH";
                }
            } else if (q.type === "PGK_KATEGORI" && Array.isArray(q.statements)) {
                keyLabel = q.statements.map((s: any, sIdx: number) => `${sIdx + 1}:${s.correctCategory}`).join(" | ");
                if (userAns && typeof userAns === "object" && Object.keys(userAns).length > 0) {
                    let correctCount = 0;
                    userAnsLabel = q.statements
                        .map((s: any, sIdx: number) => {
                            const chosen = userAns[s.id] || "-";
                            if (chosen === s.correctCategory) correctCount++;
                            return `${sIdx + 1}:${chosen}`;
                        })
                        .join(" | ");

                    if (correctCount === q.statements.length) status = "BENAR";
                    else if (correctCount > 0) status = "SEBAGIAN";
                    else status = "SALAH";
                }
            }

            return {
                ...q,
                subtes_code: code,
                qKey,
                status,
                userAnsLabel,
                keyLabel
            };
        });
    }, [result]);

    // Tampilan jika data belum ditemukan di browser
    if (hasChecked && !result) {
        return (
            <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Belum Ada Riwayat Tryout</h2>
                    <p className="text-xs text-slate-500 leading-relaxed font-normal">
                        Data hasil pengerjaan Tryout TKA SMP tidak ditemukan pada sesi peramban ini. Silakan mulai pengerjaan dari bilik asesmen resmi.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-700/20 transition-all cursor-pointer"
                    >
                        <Home className="w-4 h-4" />
                        <span>Kembali ke Beranda Utama</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (!result) return null;

    // 1. Ekstraksi Data Peserta & Skor (100% Identik dengan Exam Chamber)
    const student = result.student || {
        name: "Peserta Simulasi",
        school: "SMP / MTs",
        grade: "9",
        phone: "-",
        interest: "Sains & Teknologi (STEM)"
    };

    const totalScore = Math.min(100, Math.max(0, Number(result.totalScore ?? result.score ?? 0)));
    const bindoScore = Math.min(100, Math.max(0, Number(result.bindoScore ?? result.indoScore ?? totalScore)));
    const mtkScore = Math.min(100, Math.max(0, Number(result.mtkScore ?? result.mathScore ?? totalScore)));
    const kkm = Number(result.kkm || KKM_STANDARD);
    const violations = Number(result.violations || 0);

    const isTuntasTotal = totalScore >= kkm;
    const isTuntasBindo = bindoScore >= kkm;
    const isTuntasMtk = mtkScore >= kkm;

    // 2. Taksonomi 4 Kategori Tingkat Kompetensi & Predikat Capaian
    let competency = {
        level: "MAHIR",
        desc: "Siswa mampu bernalar kritis memecahkan persoalan kontekstual yang kompleks, mengevaluasi wacana secara reflektif, serta memiliki kesiapan istimewa memasuki program akademik unggulan SMA.",
        badgeClass: "bg-emerald-50 text-emerald-900 border-emerald-300",
        scholarship: "Voucher Beasiswa Bebas Biaya SPP / Uang Pangkal s.d. 100%"
    };

    if (totalScore < 55) {
        competency = {
            level: "PERLU INTERVENSI KHUSUS",
            desc: "Siswa masih membutuhkan pendampingan terstruktur dalam mengidentifikasi informasi eksplisit bacaan serta penguatan konsep operasi dasar matematika SMP.",
            badgeClass: "bg-rose-50 text-rose-900 border-rose-300",
            scholarship: "Program Klinik Belajar & Subsidi Registrasi Awal PPDB"
        };
    } else if (totalScore <= 70) {
        competency = {
            level: "DASAR",
            desc: "Siswa telah mencapai batas kompetensi minimum literasi membaca dan numerasi dasar, namun memerlukan penguatan strategi penalaran masalah kontekstual.",
            badgeClass: "bg-amber-50 text-amber-900 border-amber-300",
            scholarship: "Potongan Khusus Biaya Masuk & Formulir PPDB Gelombang Khusus"
        };
    } else if (totalScore <= 85) {
        competency = {
            level: "CAKAP",
            desc: "Siswa terampil mengaplikasikan konsep literasi membaca dan matematika secara mandiri dan siap mengikuti pembelajaran lanjutan kurikulum SMA secara optimal.",
            badgeClass: "bg-blue-50 text-blue-900 border-blue-300",
            scholarship: "Voucher Beasiswa Jalur Prestasi Akademik PPDB (Potongan s.d. 50%)"
        };
    }

    const cleanPhone = String(student.phone || "").replace(/\D/g, "");
    const voucherCode = `M18-TKA-${cleanPhone.slice(-4) || "2026"}-${totalScore}`;

    const filteredReviewItems = itemDiagnostics.filter(
        (item: any) => reviewFilter === "ALL" || item.subtes_code === reviewFilter
    );

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans selection:bg-blue-600 selection:text-white pb-16 print:bg-white print:p-0 print:pb-0">
            {/* CSS KHUSUS PENCETAKAN PDF A4 RESMI */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
        @media print {
          body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
          .print-hidden { display: none !important; }
          .print-card { box-shadow: none !important; border: none !important; max-width: 100% !important; border-radius: 0 !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 12mm 15mm; }
        }
      `
                }}
            />

            {/* NAVBAR ATAS (TERSEMBUNYI SAAT PRINT) */}
            <header className="bg-white border-b border-slate-200 px-3.5 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs print-hidden gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={handleFinishAndHome}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition border border-slate-200 cursor-pointer shrink-0"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src="/logo-timsim.jpg"
                                alt="Logo SMA Muhammadiyah 18 Jakarta"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                    const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = "flex";
                                }}
                            />
                            <div className="hidden w-full h-full rounded-xl bg-slate-900 border border-amber-400 items-center justify-center font-black text-amber-300 text-xs">
                                M18
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                                RAPOR DIAGNOSTIK TRYOUT TKA SMP
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                SMA Muhammadiyah 18 Jakarta • Skala 0–100 (KKM {kkm})
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 sm:px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cetak Rapor / Simpan PDF</span>
                        <span className="sm:hidden">Cetak PDF</span>
                    </button>
                </div>
            </header>

            {/* DOKUMEN RAPOR FISIK (PRINT & SCREEN OPTIMIZED) */}
            <main className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-6 sm:pt-8 space-y-6 print:pt-0 print:max-w-none">
                <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-10 shadow-sm space-y-6 sm:space-y-7 print-card">
                    {/* 1. KOP SURAT RESMI TRYOUT TKA SMP */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b-2 border-slate-900 text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                                <img
                                    src="/logo-timsim.jpg"
                                    alt="Logo SMA Muhammadiyah 18 Jakarta"
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = "flex";
                                    }}
                                />
                                <div className="hidden w-full h-full rounded-xl bg-slate-900 border border-amber-400 items-center justify-center font-black text-amber-300 text-xs">
                                    M18
                                </div>
                            </div>

                            <div>
                                <span className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-widest block">
                                    LAPORAN HASIL TRYOUT TES KEMAMPUAN AKADEMIK (TKA) JENJANG SMP
                                </span>
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                    SMA MUHAMMADIYAH 18 JAKARTA
                                </h1>
                                <p className="text-xs text-slate-500 font-medium">
                                    Jl. Panjang No. 19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230
                                </p>
                            </div>
                        </div>

                        <div className="text-center sm:text-right font-mono text-xs shrink-0">
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 inline-block mb-1">
                                SKALA 0–100 • KKM {kkm}
                            </span>
                            <div className="text-slate-400 text-[10px]">Tahun Ajaran 2026/2027</div>
                        </div>
                    </div>

                    {/* 2. IDENTITAS SISWA PESERTA TRYOUT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 text-xs">
                        <div className="space-y-1.5">
                            <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">IDENTITAS PESERTA:</div>
                            <div className="font-black text-slate-900 text-sm tracking-tight">{student.name}</div>
                            <div className="text-slate-600 font-medium">
                                Asal Sekolah: <strong className="text-slate-800">{student.school}</strong> (Kelas {student.grade})
                            </div>
                        </div>
                        <div className="space-y-1.5 sm:text-right">
                            <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">PEMINATAN / KONTAK:</div>
                            <div className="font-bold text-blue-800 text-xs">{student.interest}</div>
                            <div className="text-slate-500 font-mono text-[11px]">No. WhatsApp: {student.phone}</div>
                        </div>
                    </div>

                    {/* 3. REKAPITULASI CAPAIAN NILAI & INDIKATOR KETUNTASAN KKM (SKALA 0-100) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Nilai Akhir Gabungan */}
                        <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 text-white p-5 sm:p-6 rounded-3xl shadow-sm space-y-2 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                            <div className="relative z-10">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-300 font-bold flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-amber-400" /> NILAI AKHIR TKA SMP
                                </span>
                                <div className="text-5xl font-black font-mono tracking-tight text-white mt-2">
                                    {totalScore}
                                    <span className="text-xs font-normal text-blue-300 ml-1 font-sans">/ 100</span>
                                </div>
                            </div>
                            <div className="relative z-10 text-[11px] pt-2 border-t border-blue-800/60 font-mono flex items-center justify-between">
                                <span className="text-blue-200/80">Status KKM ({kkm}):</span>
                                <span className={`font-bold ${isTuntasTotal ? "text-emerald-300" : "text-amber-300"}`}>
                                    {isTuntasTotal ? "TUNTAS" : "BELUM TUNTAS"}
                                </span>
                            </div>
                        </div>

                        {/* Mata Pelajaran 1: Bahasa Indonesia (BINDO) */}
                        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl space-y-3 shadow-2xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase">
                                    <span className="flex items-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5 text-blue-600" /> B. INDONESIA
                                    </span>
                                    <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">BINDO</span>
                                </div>
                                <div className="text-4xl font-black font-mono tracking-tight text-slate-900 mt-2">
                                    {bindoScore}
                                    <span className="text-xs font-normal text-slate-400 ml-1 font-sans">/ 100</span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                                    Pemetaan Literasi Membaca (Wacana Informasi & Teks Sastra SMP)
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-mono font-bold">
                                    <span className="text-slate-400">KKM {kkm}</span>
                                    <span className={isTuntasBindo ? "text-emerald-700" : "text-rose-700"}>
                                        {isTuntasBindo ? "Tuntas" : "Perlu Penguatan"}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, bindoScore)}%` }} />
                                </div>
                            </div>
                        </div>

                        {/* Mata Pelajaran 2: Matematika (MTK) */}
                        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl space-y-3 shadow-2xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase">
                                    <span className="flex items-center gap-1">
                                        <Calculator className="w-3.5 h-3.5 text-emerald-600" /> MATEMATIKA
                                    </span>
                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">MTK</span>
                                </div>
                                <div className="text-4xl font-black font-mono tracking-tight text-emerald-600 mt-2">
                                    {mtkScore}
                                    <span className="text-xs font-normal text-slate-400 ml-1 font-sans">/ 100</span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                                    Pemetaan Numerasi, Aljabar, Geometri & Data Peluang SMP
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-mono font-bold">
                                    <span className="text-slate-400">KKM {kkm}</span>
                                    <span className={isTuntasMtk ? "text-emerald-700" : "text-rose-700"}>
                                        {isTuntasMtk ? "Tuntas" : "Perlu Penguatan"}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, mtkScore)}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. TABEL PEMETAAN MATERI & KETUNTASAN KKM */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                            <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10.5px] text-slate-700">
                                <tr>
                                    <th className="p-3 w-10 text-center">No</th>
                                    <th className="p-3">Mata Pelajaran & Pemetaan Materi SMP</th>
                                    <th className="p-3 text-center w-20">KKM</th>
                                    <th className="p-3 text-center w-24">Nilai</th>
                                    <th className="p-3 text-center w-32">Ketuntasan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                <tr>
                                    <td className="p-3 text-center font-mono">1</td>
                                    <td className="p-3">
                                        <div className="font-bold text-slate-900">Bahasa Indonesia (BINDO)</div>
                                        <div className="text-[11px] text-slate-500">
                                            Pemetaan Materi: Literasi Membaca (Pemahaman Tekstual, Inferensial & Evaluasi Wacana)
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-mono">{kkm}</td>
                                    <td className="p-3 text-center font-mono font-black text-blue-800">{bindoScore}</td>
                                    <td className="p-3 text-center font-bold">
                                        <span className={isTuntasBindo ? "text-emerald-700" : "text-rose-700"}>
                                            {isTuntasBindo ? "Tuntas KKM" : "Belum Tuntas"}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 text-center font-mono">2</td>
                                    <td className="p-3">
                                        <div className="font-bold text-slate-900">Matematika (MTK)</div>
                                        <div className="text-[11px] text-slate-500">
                                            Pemetaan Materi: Numerasi SMP (Bilangan, Aljabar, Geometri Pengukuran & Data Peluang)
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-mono">{kkm}</td>
                                    <td className="p-3 text-center font-mono font-black text-emerald-700">{mtkScore}</td>
                                    <td className="p-3 text-center font-bold">
                                        <span className={isTuntasMtk ? "text-emerald-700" : "text-rose-700"}>
                                            {isTuntasMtk ? "Tuntas KKM" : "Belum Tuntas"}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 5. PREDIKAT CAPAIAN KOMPETENSI AKADEMIK */}
                    <div className={`p-4 sm:p-5 rounded-2xl border ${competency.badgeClass} space-y-2`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                                    PREDIKAT CAPAIAN KOMPETENSI :
                                </span>
                                <strong className="text-sm font-black tracking-tight">{competency.level}</strong>
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-white/80 px-2.5 py-0.5 rounded-full border border-slate-200">
                                Tryout TKA SMP 2026
                            </span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-90 font-normal">
                            {competency.desc} Catatan integritas bilik ujian:{" "}
                            {violations === 0 ? "Tertib tanpa pelanggaran." : `${violations}x perpindahan jendela/tab.`}
                        </p>
                    </div>

                    {/* 6. VOUCHER BEASISWA PPDB SMA MUHAMMADIYAH 18 JAKARTA */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-dashed border-amber-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider font-mono">
                                <Sparkles className="w-4 h-4 text-amber-600" /> REKOMENDASI BEASISWA PPDB GELOMBANG KHUSUS
                            </div>
                            <div className="text-base font-black text-slate-900">{competency.scholarship}</div>
                            <p className="text-[11px] text-slate-600">
                                Tunjukkan bukti fisik/digital lembar diagnostik ini kepada Panitia SPMB SMA Muhammadiyah 18 Jakarta untuk verifikasi klaim beasiswa.
                            </p>
                        </div>

                        <div className="bg-white border border-amber-200 px-4 py-2.5 rounded-2xl text-center shadow-xs shrink-0">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block font-bold">
                                KODE VOUCHER SPMB
                            </span>
                            <span className="text-sm font-mono font-black text-blue-900 tracking-wider">{voucherCode}</span>
                        </div>
                    </div>

                    {/* 7. KOLOM PENGESAHAN DOKUMEN PEJABAT RESMI SEKOLAH */}
                    <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 sm:gap-8 text-xs text-center font-medium">
                        <div className="space-y-14">
                            <div>
                                Mengetahui, <br />
                                <strong className="text-slate-900">Kepala SMA Muhammadiyah 18 Jakarta</strong>
                            </div>
                            <div>
                                <div className="font-bold underline text-slate-900">Drs. H. Ahmad Dahlan, M.Pd.</div>
                                <div className="text-[10px] text-slate-400 font-mono">NIP / NBM. 882.118.001</div>
                            </div>
                        </div>

                        <div className="space-y-14">
                            <div>
                                Jakarta Selatan,{" "}
                                {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} <br />
                                <strong className="text-slate-900">Koordinator Asesmen & Kurikulum</strong>
                            </div>
                            <div>
                                <div className="font-bold underline text-slate-900">Fadhillah Umar, S.Pd.</div>
                                <div className="text-[10px] text-slate-400 font-mono">NIP / NBM. 118.2026.091</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===================================================================== */}
                {/* PANEL REVIEW PEMBAHASAN & KUNCI JAWABAN (TERSEMBUNYI SAAT PRINT PDF)   */}
                {/* ===================================================================== */}
                {itemDiagnostics.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xs space-y-5 print-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-700" />
                                    <span>Review Kunci Jawaban & Pembahasan Soal</span>
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Evaluasi mandiri hasil jawaban Anda per butir soal Bahasa Indonesia (BINDO) & Matematika (MTK).
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowReview((prev) => !prev)}
                                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                            >
                                {showReview ? (
                                    <>
                                        <EyeOff className="w-3.5 h-3.5" /> Sembunyikan Pembahasan
                                    </>
                                ) : (
                                    <>
                                        <Eye className="w-3.5 h-3.5" /> Lihat Pembahasan ({itemDiagnostics.length} Soal)
                                    </>
                                )}
                            </button>
                        </div>

                        {showReview && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {(["ALL", "BINDO", "MTK"] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setReviewFilter(tab)}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${reviewFilter === tab
                                                    ? "bg-blue-700 text-white border-blue-700"
                                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                                }`}
                                        >
                                            {tab === "ALL"
                                                ? `Semua Soal (${itemDiagnostics.length})`
                                                : tab === "BINDO"
                                                    ? "Bahasa Indonesia (BINDO)"
                                                    : "Matematika (MTK)"}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-3">
                                    {filteredReviewItems.map((item: any, idx: number) => (
                                        <div
                                            key={item.qKey || idx}
                                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-blue-100 text-blue-900 text-[10px]">
                                                        NO. {idx + 1} • {item.subtes_code}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-slate-500">{item.materi}</span>
                                                </div>

                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold inline-flex items-center gap-1 ${item.status === "BENAR"
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : item.status === "SEBAGIAN"
                                                                ? "bg-amber-100 text-amber-800"
                                                                : "bg-rose-100 text-rose-800"
                                                        }`}
                                                >
                                                    {item.status === "BENAR" ? (
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    ) : (
                                                        <XCircle className="w-3 h-3" />
                                                    )}
                                                    {item.status}
                                                </span>
                                            </div>

                                            <div className="font-bold text-slate-900 leading-relaxed">
                                                <RenderLatex content={item.question} />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                                                <div className="p-2 rounded-xl bg-white border border-slate-200">
                                                    Jawaban Anda: <strong className="text-slate-900">{item.userAnsLabel}</strong>
                                                </div>
                                                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950">
                                                    Kunci Jawaban: <strong>{item.keyLabel}</strong>
                                                </div>
                                            </div>

                                            {item.pembahasan && (
                                                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 leading-relaxed">
                                                    <strong className="font-mono text-[10px] uppercase block mb-0.5 text-amber-800">
                                                        Pembahasan:
                                                    </strong>
                                                    <RenderLatex content={item.pembahasan} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ACTION BUTTON STRIP BAWAH (TERSEMBUNYI SAAT PRINT) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print-hidden">
                    <button
                        type="button"
                        onClick={handleFinishAndHome}
                        className="text-xs font-bold text-slate-600 hover:text-blue-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <Home className="w-4 h-4" /> Selesai & Kembali ke Halaman Utama
                    </button>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <a
                            href={`https://wa.me/6281234567890?text=Halo%20Panitia%20PPDB%20SMA%20Muhammadiyah%2018%20Jakarta,%20saya%20${encodeURIComponent(
                                student.name
                            )}%20dari%20${encodeURIComponent(
                                student.school
                            )}%20telah%20selesai%20mengikuti%20Tryout%20TKA%20SMP%20dengan%20Nilai%20Akhir%20${totalScore}%20(${competency.level
                                }).%20Kode%20Voucher:%20${voucherCode}.%20Saya%20ingin%20konsultasi%20jalur%20beasiswa%20dan%20pendaftaran.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                            <MessageCircle className="w-4 h-4" /> Konsultasi PPDB via WA
                        </a>

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <Printer className="w-4 h-4" /> Simpan PDF / Cetak
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}