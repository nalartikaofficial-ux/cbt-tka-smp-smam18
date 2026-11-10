"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Award,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Home,
    Printer,
    MessageCircle,
    Sparkles,
    ChevronLeft,
    FileText,
    ShieldCheck,
    BookOpen,
    Calculator
} from "lucide-react";

export default function ExamResultPage() {
    const router = useRouter();
    const [result, setResult] = useState<any>(null);
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        // Lepas mode fullscreen secara aman saat masuk ke lembar hasil
        if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        }

        // Dukung key baru (tka_result) dan fallback key lama (cbt_exam_result)
        const rawTka = localStorage.getItem("tka_result");
        const rawLegacy = localStorage.getItem("cbt_exam_result");

        if (rawTka) {
            try {
                setResult(JSON.parse(rawTka));
            } catch { }
        } else if (rawLegacy) {
            try {
                const parsed = JSON.parse(rawLegacy);
                // Konversi otomatis format lama ke skala 0-100 standar SMP
                const rawScore = parsed.score || 0;
                const normalizedScore = rawScore > 100
                    ? Math.min(100, Math.max(0, Math.round(((rawScore - 200) / 600) * 100)))
                    : rawScore;

                setResult({
                    student: {
                        name: parsed?.student?.candidateName || parsed?.student?.name || "Peserta Ujian",
                        school: parsed?.student?.school || "SMP / MTs",
                        grade: parsed?.student?.grade || "9",
                        phone: parsed?.student?.phone || parsed?.student?.nisn || "-",
                        interest: parsed?.student?.interest || "Eksplorasi SMA"
                    },
                    totalScore: normalizedScore,
                    indoScore: normalizedScore,
                    mathScore: normalizedScore,
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

    // Tampilan jika data belum ditemukan di browser
    if (hasChecked && !result) {
        return (
            <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Belum Ada Riwayat Ujian</h2>
                    <p className="text-xs text-slate-500 leading-relaxed font-normal">
                        Data hasil pengerjaan simulasi TKA SMP tidak ditemukan pada sesi peramban ini. Silakan mulai pengerjaan dari bilik asesmen resmi.
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

    // 1. Ekstraksi Data Peserta & Skor
    const student = result.student || {
        name: "Peserta Simulasi",
        school: "SMP / MTs",
        grade: "9",
        phone: "-",
        interest: "Umum"
    };

    const totalScore = Number(result.totalScore ?? result.score ?? 0);
    const indoScore = Number(result.indoScore ?? totalScore);
    const mathScore = Number(result.mathScore ?? totalScore);
    const violations = Number(result.violations || 0);

    // 2. Taksonomi 4 Kategori Tingkat Kompetensi Resmi Pemerintah (Pusmendik / BSKAP)
    let competency = {
        level: "MAHIR",
        desc: "Siswa mampu bernalar kritis untuk memecahkan persoalan kontekstual yang rumit, mengevaluasi wacana secara mendalam, serta memiliki kesiapan istimewa memasuki program unggulan SMA.",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
        barColor: "bg-emerald-600",
        scholarship: "Beasiswa Bebas Biaya SPP / Uang Gedung s.d. 100%"
    };

    if (totalScore < 54) {
        competency = {
            level: "PERLU INTERVENSI KHUSUS",
            desc: "Siswa masih membutuhkan bimbingan intensif dalam mengidentifikasi informasi eksplisit bacaan dan pemahaman konsep dasar aritmetika-aljabar.",
            badgeClass: "bg-rose-50 text-rose-800 border-rose-300",
            barColor: "bg-rose-600",
            scholarship: "Program Bimbingan Belajar Klinik Akademik PPDB"
        };
    } else if (totalScore < 70) {
        competency = {
            level: "DASAR",
            desc: "Siswa telah mencapai batas kompetensi minimum literasi dan numerasi dasar, namun memerlukan penguatan strategi penalaran kontekstual bertingkat.",
            badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
            barColor: "bg-amber-500",
            scholarship: "Potongan Khusus Formulir Pendaftaran PPDB"
        };
    } else if (totalScore < 85) {
        competency = {
            level: "CAKAP",
            desc: "Siswa terampil mengaplikasikan konsep literasi dan matematika secara mandiri dan siap mengikuti pembelajaran lanjutan kurikulum SMA secara optimal.",
            badgeClass: "bg-blue-50 text-blue-800 border-blue-300",
            barColor: "bg-blue-600",
            scholarship: "Voucher Beasiswa Jalur Prestasi Akademik PPDB"
        };
    }

    const voucherCode = `M18-TKA-${(student.phone || "00").replace(/[^0-9]/g, "").slice(-4) || "2026"}-${totalScore}`;

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans selection:bg-blue-600 selection:text-white pb-16 print:bg-white print:p-0 print:pb-0">

            {/* ============================================================== */}
            {/* NAVBAR ATAS (TERSEMBUNYI SAAT CETAK / PRINT)                    */}
            {/* ============================================================== */}
            <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs print:hidden">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleFinishAndHome}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition border border-slate-200 cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
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
                            <div className="text-sm font-black text-slate-900 tracking-tight">RAPOR DIAGNOSTIK TKA SMP</div>
                            <div className="text-[11px] text-slate-500 font-medium">Standar Asesmen Nasional Pusmendik &bull; SMA Muhammadiyah 18 Jakarta</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                        <Printer className="w-3.5 h-3.5" /> Cetak Rapor / Simpan PDF
                    </button>
                </div>
            </header>

            {/* ============================================================== */}
            {/* DOKUMEN RAPOR FISIK (PRINT & SCREEN OPTIMIZED)                  */}
            {/* ============================================================== */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6 print:pt-0 print:max-w-none">

                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-7 print:border-none print:shadow-none print:p-0">

                    {/* 1. KOP SURAT ASESMEN RESMI SEKOLAH */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b-2 border-slate-900 text-center sm:text-left">
                        <div className="flex items-center gap-4">
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
                                    LEMBAR HASIL DIAGNOSTIK KEMAMPUAN AKADEMIK (TKA SMP)
                                </span>
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                    SMA MUHAMMADIYAH 18 JAKARTA
                                </h1>
                                <p className="text-xs text-slate-500 font-medium">
                                    Jl. Panjang No. 19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230
                                </p>
                            </div>
                        </div>

                        <div className="text-right font-mono text-xs">
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 inline-block mb-1">
                                STANDAR SKALA 0–100
                            </span>
                            <div className="text-slate-400 text-[10px]">Tahun Ajaran 2026/2027</div>
                        </div>
                    </div>

                    {/* 2. IDENTITAS SISWA PESERTA UJIAN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200 text-xs">
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

                    {/* 3. REKAPITULASI CAPAIAN NILAI (SKALA 0-100) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* Skor Gabungan / Rerata Nasional */}
                        <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 text-white p-6 rounded-3xl shadow-sm space-y-2 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                            <div className="relative z-10">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-300 font-bold flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-amber-400" /> SKOR GABUNGAN AKADEMIK
                                </span>
                                <div className="text-5xl font-black font-mono tracking-tight text-white mt-2">
                                    {totalScore}
                                    <span className="text-xs font-normal text-blue-300 ml-1 font-sans">/ 100</span>
                                </div>
                            </div>
                            <div className="relative z-10 text-[11px] text-blue-200/80 pt-2 border-t border-blue-800/60 font-mono flex items-center justify-between">
                                <span>Rerata Kompetensi</span>
                                <span className="text-amber-300 font-bold">{competency.level}</span>
                            </div>
                        </div>

                        {/* Literasi Bahasa Indonesia */}
                        <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-2xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase">
                                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-blue-600" /> B. INDONESIA</span>
                                    <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">LITERASI</span>
                                </div>
                                <div className="text-4xl font-black font-mono tracking-tight text-slate-900 mt-2">
                                    {indoScore}
                                    <span className="text-xs font-normal text-slate-400 ml-1 font-sans">/ 100</span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                                    Wacana Informasi &amp; Fiksi (Pemahaman Tekstual, Inferensial &amp; Evaluasi)
                                </p>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, indoScore)}%` }} />
                            </div>
                        </div>

                        {/* Penalaran Matematika */}
                        <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-2xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase">
                                    <span className="flex items-center gap-1"><Calculator className="w-3.5 h-3.5 text-emerald-600" /> MATEMATIKA</span>
                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">NUMERASI</span>
                                </div>
                                <div className="text-4xl font-black font-mono tracking-tight text-emerald-600 mt-2">
                                    {mathScore}
                                    <span className="text-xs font-normal text-slate-400 ml-1 font-sans">/ 100</span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                                    Bilangan, Aljabar, Geometri Pengukuran, serta Data &amp; Peluang
                                </p>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, mathScore)}%` }} />
                            </div>
                        </div>

                    </div>

                    {/* 4. DIAGNOSIS 4 TINGKAT KOMPETENSI RESMI PEMERINTAH */}
                    <div className={`p-5 rounded-2xl border ${competency.badgeClass} space-y-2`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">TINGKAT KOMPETENSI AKADEMIK :</span>
                                <strong className="text-sm font-black tracking-tight">{competency.level}</strong>
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-white/80 px-2.5 py-0.5 rounded-full border border-slate-200">
                                Pusmendik Standardized
                            </span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-90 font-normal">
                            {competency.desc} Catatan integritas bilik ujian terkunci aman (pelanggaran jendela/tab: {violations}x).
                        </p>
                    </div>

                    {/* 5. VOUCHER BEASISWA PPDB SMA MUHAMMADIYAH 18 JAKARTA */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-dashed border-amber-300 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
                        <div className="space-y-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider font-mono">
                                <Sparkles className="w-4 h-4 text-amber-600" /> REKOMENDASI BEASISWA PPDB GELOMBANG KHUSUS
                            </div>
                            <div className="text-base font-black text-slate-900">
                                {competency.scholarship}
                            </div>
                            <p className="text-[11px] text-slate-600">
                                Tunjukkan bukti fisik/digital lembar diagnostik ini kepada Panitia SPMB SMA Muhammadiyah 18 Jakarta untuk verifikasi beasiswa.
                            </p>
                        </div>

                        <div className="bg-white border border-amber-200 px-4 py-2.5 rounded-2xl text-center shadow-xs shrink-0">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block font-bold">KODE REGISTRASI</span>
                            <span className="text-sm font-mono font-black text-blue-900 tracking-wider">{voucherCode}</span>
                        </div>
                    </div>

                    {/* 6. KOLOM PENGESAHAN DOKUMEN PEJABAT RESMI SEKOLAH */}
                    <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-center font-medium">
                        <div className="space-y-14">
                            <div>Mengetahui, <br /><strong className="text-slate-900">Kepala SMA Muhammadiyah 18 Jakarta</strong></div>
                            <div>
                                <div className="font-bold underline text-slate-900">Drs. H. Ahmad Dahlan, M.Pd.</div>
                                <div className="text-[10px] text-slate-400 font-mono">NIP / NBM. 882.118.001</div>
                            </div>
                        </div>

                        <div className="space-y-14">
                            <div>Jakarta Selatan, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} <br /><strong className="text-slate-900">Koordinator Asesmen &amp; Kurikulum</strong></div>
                            <div>
                                <div className="font-bold underline text-slate-900">Fadhillah Umar, S.Pd.</div>
                                <div className="text-[10px] text-slate-400 font-mono">NIP / NBM. 118.2026.091</div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* ============================================================== */}
                {/* ACTION BUTTON STRIP BAWAH (TERSEMBUNYI SAAT PRINT)             */}
                {/* ============================================================== */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
                    <button
                        type="button"
                        onClick={handleFinishAndHome}
                        className="text-xs font-bold text-slate-600 hover:text-blue-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <Home className="w-4 h-4" /> Selesai &amp; Kembali ke Halaman Utama
                    </button>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <a
                            href={`https://wa.me/6281234567890?text=Halo%20Admin%20SMA%20Muhammadiyah%2018%20Jakarta,%20saya%20${encodeURIComponent(student.name)}%20dari%20${encodeURIComponent(student.school)}%20telah%20selesai%20mengikuti%20Simulasi%20TKA%20SMP%20dengan%20Skor%20${totalScore}%20(${competency.level}).%20Saya%20ingin%20konsultasi%20jalur%20beasiswa%20dan%20pendaftaran%20PPDB.`}
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