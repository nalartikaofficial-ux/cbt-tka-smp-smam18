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
    EyeOff
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Kategori Capaian Resmi Kepmendikdasmen No. 56 Tahun 2026 (Skala 0,00 - 100,00)
function getSubjectCategory56(score: number) {
    const num = Number(score) || 0;
    if (num >= 95.0) {
        return {
            label: "Istimewa",
            badgeClass: "bg-indigo-50 text-indigo-900 border-indigo-300",
            textClass: "text-indigo-700",
            barClass: "bg-indigo-600",
            note: "Predikat khusus bagi peserta didik dengan penguasaan materi dan penalaran tingkat tinggi yang sangat unggul."
        };
    }
    if (num >= 76.67) {
        return {
            label: "Baik",
            badgeClass: "bg-emerald-50 text-emerald-900 border-emerald-300",
            textClass: "text-emerald-700",
            barClass: "bg-emerald-600",
            note: "Menggambarkan pemahaman materi yang kuat dan konsisten dalam menyelesaikan soal konseptual maupun kontekstual."
        };
    }
    if (num >= 50.0) {
        return {
            label: "Memadai",
            badgeClass: "bg-blue-50 text-blue-900 border-blue-300",
            textClass: "text-blue-700",
            barClass: "bg-blue-600",
            note: "Menandakan kemampuan dasar yang cukup sesuai standar minimum pada mata uji terkait."
        };
    }
    return {
        label: "Kurang",
        badgeClass: "bg-rose-50 text-rose-900 border-rose-300",
        textClass: "text-rose-700",
        barClass: "bg-rose-600",
        note: "Menunjukkan perlunya penguatan kompetensi fundamental dan pendampingan belajar pada mata uji terkait."
    };
}

function formatScoreID(score: number): string {
    return (Number(score) || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

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
        if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        }

        const rawTka = localStorage.getItem("tka_result");
        if (rawTka) {
            try {
                setResult(JSON.parse(rawTka));
            } catch { }
        }
        setHasChecked(true);
    }, []);

    const handleFinishAndHome = () => {
        localStorage.removeItem("tka_student");
        sessionStorage.clear();
        router.push("/");
    };

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

    const student = result.student || {
        name: "PESERTA SIMULASI",
        school: "SMP / MTs",
        grade: "9",
        phone: "-"
    };

    const totalScore = Math.min(100, Math.max(0, Number(result.totalScore ?? result.score ?? 0)));
    const bindoScore = Math.min(100, Math.max(0, Number(result.bindoScore ?? result.indoScore ?? totalScore)));
    const mtkScore = Math.min(100, Math.max(0, Number(result.mtkScore ?? result.mathScore ?? totalScore)));
    const violations = Number(result.violations || 0);

    // Evaluasi terpisah per mata uji sesuai Kepmendikdasmen No. 56 Tahun 2026
    const bindoCat = getSubjectCategory56(bindoScore);
    const mtkCat = getSubjectCategory56(mtkScore);

    // Rekomendasi Voucher Beasiswa PPDB SMA Muhammadiyah 18 Jakarta
    let scholarshipOffer = "Voucher Beasiswa Jalur Prestasi PPDB SMA Muhammadiyah 18 Jakarta";
    if (bindoScore >= 95 || mtkScore >= 95 || totalScore >= 95) {
        scholarshipOffer = "Voucher Beasiswa Istimewa Bebas Biaya SPP / Uang Pangkal s.d. 100%";
    } else if (totalScore >= 76.67) {
        scholarshipOffer = "Voucher Beasiswa Jalur Prestasi Akademik (Potongan Uang Pangkal s.d. 50%)";
    } else if (totalScore >= 50.0) {
        scholarshipOffer = "Voucher Potongan Khusus Biaya Masuk Gelombang Awal PPDB";
    } else {
        scholarshipOffer = "Voucher Subsidi Registrasi & Program Klinik Akademik PPDB";
    }

    const cleanPhone = String(student.phone || "").replace(/\D/g, "");
    const voucherCode = `M18-SHTKA-${cleanPhone.slice(-4) || "2026"}-${Math.round(totalScore)}`;

    const filteredReviewItems = itemDiagnostics.filter(
        (item: any) => reviewFilter === "ALL" || item.subtes_code === reviewFilter
    );

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans selection:bg-blue-600 selection:text-white pb-16 print:bg-white print:p-0 print:pb-0">
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

            {/* NAVBAR ATAS */}
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
                                }}
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                                SERTIFIKAT HASIL TRYOUT TKA SMP (SHTKA)
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                Kepmendikdasmen No. 56 Tahun 2026 • Skala 0,00–100,00
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
                        <span className="hidden sm:inline">Cetak SHTKA / Simpan PDF</span>
                        <span className="sm:hidden">Cetak PDF</span>
                    </button>
                </div>
            </header>

            {/* DOKUMEN SHTKA FISIK */}
            <main className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-6 sm:pt-8 space-y-6 print:pt-0 print:max-w-none">
                <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-10 shadow-sm space-y-6 sm:space-y-7 print-card">
                    {/* 1. KOP SURAT RESMI */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b-2 border-slate-900 text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                                <img
                                    src="/logo-timsim.jpg"
                                    alt="Logo SMA Muhammadiyah 18 Jakarta"
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                    }}
                                />
                            </div>

                            <div>
                                <span className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-widest block">
                                    SERTIFIKAT HASIL TRYOUT TES KEMAMPUAN AKADEMIK (TKA) SMP/MTs
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
                            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 font-bold border border-blue-200 inline-block mb-1">
                                SKALA 0,00 – 100,00
                            </span>
                            <div className="text-slate-500 text-[10px] font-bold">Kepmendikdasmen No. 56/2026</div>
                        </div>
                    </div>

                    {/* 2. IDENTITAS PESERTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 text-xs">
                        <div className="space-y-1.5">
                            <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">IDENTITAS PESERTA:</div>
                            <div className="font-black text-slate-900 text-sm tracking-tight">{student.name}</div>
                            <div className="text-slate-600 font-medium">
                                Asal Sekolah: <strong className="text-slate-800">{student.school}</strong> (Kelas {student.grade})
                            </div>
                        </div>
                        <div className="space-y-1.5 sm:text-right">
                            <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">KONTAK & INTEGRITAS:</div>
                            <div className="text-slate-700 font-mono font-bold text-xs">No. WhatsApp: {student.phone}</div>
                            <div className="text-slate-500 text-[11px]">
                                Integritas Bilik:{" "}
                                <strong className={violations === 0 ? "text-emerald-700" : "text-amber-700"}>
                                    {violations === 0 ? "Tertib (0 Pelanggaran)" : `${violations}x Perpindahan Layar`}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* 3. CAPAIAN TERPISAH PER MATA UJI (STANDAR PEMERINTAH) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Mata Uji 1: Bahasa Indonesia */}
                        <div className="bg-white border-2 border-blue-200/80 p-5 sm:p-6 rounded-3xl space-y-3 shadow-2xs flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-[11px] font-mono font-black text-blue-800 uppercase">
                                        <BookOpen className="w-4 h-4 text-blue-600" /> MATA UJI 1: BAHASA INDONESIA
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full border font-mono text-[10.5px] font-black ${bindoCat.badgeClass}`}>
                                        {bindoCat.label}
                                    </span>
                                </div>

                                <div className="flex items-baseline gap-2 pt-1">
                                    <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900">
                                        {formatScoreID(bindoScore)}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">/ 100,00</span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed">{bindoCat.note}</p>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${bindoCat.barClass}`} style={{ width: `${Math.min(100, bindoScore)}%` }} />
                                </div>
                            </div>
                        </div>

                        {/* Mata Uji 2: Matematika */}
                        <div className="bg-white border-2 border-emerald-200/80 p-5 sm:p-6 rounded-3xl space-y-3 shadow-2xs flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-[11px] font-mono font-black text-emerald-800 uppercase">
                                        <Calculator className="w-4 h-4 text-emerald-600" /> MATA UJI 2: MATEMATIKA
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full border font-mono text-[10.5px] font-black ${mtkCat.badgeClass}`}>
                                        {mtkCat.label}
                                    </span>
                                </div>

                                <div className="flex items-baseline gap-2 pt-1">
                                    <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900">
                                        {formatScoreID(mtkScore)}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">/ 100,00</span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed">{mtkCat.note}</p>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${mtkCat.barClass}`} style={{ width: `${Math.min(100, mtkScore)}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. TABEL RINGKASAN SHTKA & REFERENSI KATEGORI KEPMENDIKDASMEN NO. 56/2026 */}
                    <div className="space-y-3">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                                <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10.5px] text-slate-700">
                                    <tr>
                                        <th className="p-3 w-10 text-center">No</th>
                                        <th className="p-3">Mata Uji TKA SMP/MTs</th>
                                        <th className="p-3 text-center w-32">Nilai (0,00–100,00)</th>
                                        <th className="p-3 text-center w-36">Kategori Capaian</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    <tr>
                                        <td className="p-3 text-center font-mono">1</td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-900">Bahasa Indonesia (BINDO)</div>
                                            <div className="text-[11px] text-slate-500">
                                                Literasi Membaca: Pemahaman Tekstual, Inferensial & Evaluasi Wacana
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-mono font-black text-base text-blue-800">
                                            {formatScoreID(bindoScore)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full border font-mono text-[11px] font-bold ${bindoCat.badgeClass}`}>
                                                {bindoCat.label}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 text-center font-mono">2</td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-900">Matematika (MTK)</div>
                                            <div className="text-[11px] text-slate-500">
                                                Numerasi SMP: Bilangan, Aljabar, Geometri Pengukuran & Data Peluang
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-mono font-black text-base text-emerald-700">
                                            {formatScoreID(mtkScore)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full border font-mono text-[11px] font-bold ${mtkCat.badgeClass}`}>
                                                {mtkCat.label}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Keterangan Skala Resmi Kepmendikdasmen No. 56 Tahun 2026 */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-[11px] text-slate-600">
                            <div className="font-mono font-bold text-[10px] text-slate-700 uppercase flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                                <span>Acuan Kategori Capaian TKA SMP (Kepmendikdasmen No. 56 Tahun 2026):</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                                <div className="p-2 rounded-xl bg-white border border-indigo-200">
                                    <strong className="text-indigo-800 block">Istimewa</strong>
                                    <span>≥ 95,00</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-emerald-200">
                                    <strong className="text-emerald-800 block">Baik</strong>
                                    <span>76,67 – 94,99</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-blue-200">
                                    <strong className="text-blue-800 block">Memadai</strong>
                                    <span>50,00 – 76,66</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-rose-200">
                                    <strong className="text-rose-800 block">Kurang</strong>
                                    <span>≤ 50,00</span>
                                </div>
                            </div>
                            <p className="text-[10.5px] text-slate-500 leading-relaxed pt-0.5">
                                *Catatan: Hasil TKA bersifat pemetaan diagnostik per mata uji (tidak memiliki batas kelulusan/passing grade) dan memperhitungkan pembobotan tingkat kesukaran setiap butir soal.
                            </p>
                        </div>
                    </div>

                    {/* 5. VOUCHER BEASISWA PPDB SMA MUHAMMADIYAH 18 JAKARTA */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-dashed border-amber-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider font-mono">
                                <Sparkles className="w-4 h-4 text-amber-600" /> REKOMENDASI JALUR PRESTASI PPDB
                            </div>
                            <div className="text-base font-black text-slate-900">{scholarshipOffer}</div>
                            <p className="text-[11px] text-slate-600">
                                Tunjukkan sertifikat hasil tryout ini kepada Panitia SPMB SMA Muhammadiyah 18 Jakarta sebagai validator capaian akademik masuk SMA.
                            </p>
                        </div>

                        <div className="bg-white border border-amber-200 px-4 py-2.5 rounded-2xl text-center shadow-xs shrink-0">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block font-bold">
                                KODE VOUCHER SPMB
                            </span>
                            <span className="text-sm font-mono font-black text-blue-900 tracking-wider">{voucherCode}</span>
                        </div>
                    </div>

                    {/* 6. PENGESAHAN PEJABAT RESMI SEKOLAH */}
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

                {/* PANEL REVIEW PEMBAHASAN & KUNCI JAWABAN */}
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

                                            {item.image_url && (
                                                <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-center">
                                                    <img src={item.image_url} alt="Ilustrasi Soal" className="max-h-44 object-contain rounded-lg" />
                                                </div>
                                            )}

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

                {/* ACTION BUTTON STRIP BAWAH */}
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
                            )}%20telah%20selesai%20mengikuti%20Tryout%20TKA%20SMP%20(Kepmendikdasmen%2056/2026)%20dengan%20hasil%20Bahasa%20Indonesia:%20${encodeURIComponent(
                                formatScoreID(bindoScore)
                            )}%20(${encodeURIComponent(bindoCat.label)})%20dan%20Matematika:%20${encodeURIComponent(
                                formatScoreID(mtkScore)
                            )}%20(${encodeURIComponent(mtkCat.label)}).%20Kode%20Voucher:%20${voucherCode}.`}
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