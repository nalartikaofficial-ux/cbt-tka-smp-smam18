"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { tkaQuestions } from "@/data/questions";
import {
    Clock,
    ChevronLeft,
    ChevronRight,
    Bookmark,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Maximize2,
    FastForward,
    Home,
    Award,
    BookOpen,
    Calculator
} from "lucide-react";

// Webhook Google Sheets Hasil Ujian
const GOOGLE_SCRIPT_API_URL =
    "https://script.google.com/macros/s/AKfycbwqhjrwgEsTgA9_Aop9RFBu3Mrht9w4N2SPayyB3z6AtzuP7gmiSpZEioBKwmd7PHaFfw/exec";

// 2 SUBTES RESMI TKA SMP
const TKA_SMP_SUBTESTS = [
    { code: "LIT_INDO", name: "Literasi Bahasa Indonesia", durationMin: 7.5, count: 10 },
    { code: "PM", name: "Penalaran Matematika", durationMin: 7.5, count: 10 }
];

export default function OfficialExamChamberPage() {
    const router = useRouter();

    const [studentSession, setStudentSession] = useState<any>(null);
    const [currentSubtestIndex, setCurrentSubtestIndex] = useState(0);
    const [currentQIndexInSubtest, setCurrentQIndexInSubtest] = useState(0);
    const [subtestTimeLeft, setSubtestTimeLeft] = useState<number>(7.5 * 60);

    const [answers, setAnswers] = useState<Record<string | number, string>>({});
    const [doubtfuls, setDoubtfuls] = useState<Record<string | number, boolean>>({});

    const [isInExam, setIsInExam] = useState(false);
    const [isExamCompleted, setIsExamCompleted] = useState(false);
    const [showSubtestConfirmModal, setShowSubtestConfirmModal] = useState(false);
    const [violationCount, setViolationCount] = useState(0);
    const [showViolationModal, setShowViolationModal] = useState(false);

    // Ambil Data Siswa dari LocalStorage (yang diinput di /login)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const localData = localStorage.getItem("tka_student");
        if (localData) {
            try {
                setStudentSession(JSON.parse(localData));
            } catch { }
        } else {
            setStudentSession({
                name: "Muhammad Rizki Pratama",
                school: "SMPN 161 Jakarta",
                grade: "9",
                phone: "081234567890",
                interest: "Sains & Teknologi (STEM)"
            });
        }
    }, []);

    const activeSubtest = TKA_SMP_SUBTESTS[currentSubtestIndex];

    // Filter soal sesuai subtes yang aktif (Bahasa Indonesia atau Matematika)
    const currentSubtestQuestions = useMemo(() => {
        const list = tkaQuestions || [];
        const filtered = list.filter((q: any) => {
            if (activeSubtest.code === "LIT_INDO") {
                return q.subject === "Bahasa Indonesia" || q.subtest === "LIT_INDO";
            }
            return q.subject === "Matematika" || q.subtest === "PM";
        });
        return filtered.length > 0 ? filtered : list;
    }, [activeSubtest]);

    const currentQ = currentSubtestQuestions[currentQIndexInSubtest] || currentSubtestQuestions[0];

    // Masuk Bilik Ujian & Kunci Layar Penuh (Fullscreen)
    const enterExamChamber = () => {
        setIsInExam(true);
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
        } catch { }
    };

    // Sensor Anti-Cheat Kiosk (Pindah Tab / Keluar Fullscreen)
    const recordViolation = useCallback(() => {
        if (!isInExam || isExamCompleted) return;
        setViolationCount((prev) => prev + 1);
        setShowViolationModal(true);
    }, [isInExam, isExamCompleted]);

    useEffect(() => {
        if (!isInExam || isExamCompleted) return;

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) recordViolation();
        };
        const handleWindowBlur = () => {
            recordViolation();
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [isInExam, isExamCompleted, recordViolation]);

    // Timer Hitung Mundur per Subtes
    useEffect(() => {
        if (!isInExam || isExamCompleted) return;

        const timer = setInterval(() => {
            setSubtestTimeLeft((prev) => {
                if (prev <= 1) {
                    handleNextSubtestManual();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isInExam, isExamCompleted, currentSubtestIndex]);

    const handleSelectOption = (optId: string) => {
        if (!currentQ) return;
        const qKey = currentQ.id || `${activeSubtest.code}_${currentQIndexInSubtest}`;
        setAnswers((prev) => ({ ...prev, [qKey]: optId }));
    };

    const handleToggleDoubtful = () => {
        if (!currentQ) return;
        const qKey = currentQ.id || `${activeSubtest.code}_${currentQIndexInSubtest}`;
        setDoubtfuls((prev) => ({ ...prev, [qKey]: !prev[qKey] }));
    };

    const handleNextSubtestManual = () => {
        if (currentSubtestIndex < TKA_SMP_SUBTESTS.length - 1) {
            setShowSubtestConfirmModal(false);
            const nextIdx = currentSubtestIndex + 1;
            setCurrentSubtestIndex(nextIdx);
            setCurrentQIndexInSubtest(0);
            setSubtestTimeLeft(Math.round(TKA_SMP_SUBTESTS[nextIdx].durationMin * 60));
        } else {
            executeFinalSubmission();
        }
    };

    // Kalkulasi Skor Standar Skala 0 - 100
    const scoreResults = useMemo(() => {
        let indoCorrect = 0, indoTotal = 0;
        let mathCorrect = 0, mathTotal = 0;

        const allQ = tkaQuestions || [];
        allQ.forEach((q: any, idx: number) => {
            const qKey = q.id || `${q.subject === "Bahasa Indonesia" ? "LIT_INDO" : "PM"}_${idx}`;
            const userAns = answers[qKey];
            const isIndo = q.subject === "Bahasa Indonesia" || q.subtest === "LIT_INDO";

            if (isIndo) {
                indoTotal++;
                if (userAns && userAns === q.correctAnswer) indoCorrect++;
            } else {
                mathTotal++;
                if (userAns && userAns === q.correctAnswer) mathCorrect++;
            }
        });

        const skorIndo = Math.round((indoCorrect / (indoTotal || 1)) * 100);
        const skorMath = Math.round((mathCorrect / (mathTotal || 1)) * 100);
        const totalScore = Math.round((skorIndo + skorMath) / 2);

        return { skorIndo, skorMath, totalScore };
    }, [answers]);

    const executeFinalSubmission = async () => {
        setShowSubtestConfirmModal(false);

        const finalReport = {
            student: studentSession,
            totalScore: scoreResults.totalScore,
            indoScore: scoreResults.skorIndo,
            mathScore: scoreResults.skorMath,
            violations: violationCount,
            submittedAt: new Date().toISOString()
        };

        localStorage.setItem("tka_result", JSON.stringify(finalReport));

        // Kirim Nilai Akhir ke Google Sheets
        const cleanPhone = String(studentSession?.phone || "").replace(/\D/g, "");
        if (cleanPhone) {
            try {
                await fetch(GOOGLE_SCRIPT_API_URL, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "submit_exam_score",
                        phone: cleanPhone,
                        name: studentSession?.name || studentSession?.candidateName,
                        school: studentSession?.school,
                        score: scoreResults.totalScore,
                        indoScore: scoreResults.skorIndo,
                        mathScore: scoreResults.skorMath,
                        violations: violationCount
                    })
                });
            } catch (e) {
                console.error(e);
            }
        }

        setIsExamCompleted(true);
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // TAHAP 1: GERBANG KARANTINA
    if (!isInExam && !isExamCompleted) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-9 space-y-5 text-center relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-[#1e3a8a]" />

                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1 mx-auto shadow-xs overflow-hidden">
                        <img
                            src="/logo-timsim.jpg"
                            alt="Logo SMA Muhammadiyah 18 Jakarta"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as any).src = "/images/logo-smam18.png";
                            }}
                        />
                    </div>

                    <div className="space-y-1">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 font-mono text-[10px] font-bold text-blue-900 tracking-wider">
                            SMA MUHAMMADIYAH 18 JAKARTA
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Karantina Bilik Ujian TKA SMP</h1>
                        <p className="text-xs text-slate-500">
                            Peserta: <strong className="text-slate-800">{studentSession?.name || studentSession?.candidateName}</strong> ({studentSession?.school})
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                        <div className="font-bold text-slate-700 font-mono uppercase text-[11px] flex justify-between">
                            <span>Mata Uji Asesmen (2 Subtes):</span>
                            <span className="text-blue-700 font-black">Skala 0–100</span>
                        </div>
                        <ul className="text-slate-600 leading-relaxed text-[11px] list-disc list-inside space-y-1">
                            <li><strong>Subtes 1:</strong> Literasi Bahasa Indonesia (Wacana Informasi &amp; Fiksi)</li>
                            <li><strong>Subtes 2:</strong> Penalaran Matematika (Aljabar, Geometri, Data &amp; Logika)</li>
                        </ul>
                    </div>

                    <button
                        onClick={enterExamChamber}
                        className="w-full py-3.5 px-6 rounded-2xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Maximize2 className="w-4 h-4" />
                        <span>Kunci Layar Penuh &amp; Mulai Ujian</span>
                    </button>
                </div>
            </div>
        );
    }

    // TAHAP 4: SELESAI UJIAN
    if (isExamCompleted) {
        return (
            <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800 flex items-center justify-center">
                <div className="max-w-2xl w-full bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-6 shadow-xl">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-bold">
                            TRY OUT TKA SMP SELESAI
                        </span>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                            Selamat, {studentSession?.name || studentSession?.candidateName}!
                        </h2>
                        <p className="text-xs text-slate-500">
                            Hasil evaluasi diagnostik dan hak voucher beasiswa PPDB Anda telah diterbitkan.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-blue-900 text-white space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-blue-200 font-bold">
                            SKOR GABUNGAN STANDAR PUSMENDIK (0–100)
                        </span>
                        <div className="text-5xl font-black font-mono tracking-tight text-amber-300">
                            {scoreResults.totalScore}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-blue-800/80 text-xs font-mono">
                            <div>B. Indonesia: <strong>{scoreResults.skorIndo}</strong></div>
                            <div>Matematika: <strong>{scoreResults.skorMath}</strong></div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => router.push("/result")}
                            className="flex-1 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                        >
                            <Award className="w-4 h-4" /> Buka Lembar Rapor Lengkap &amp; Voucher PPDB
                        </button>
                        <button
                            onClick={() => router.push("/")}
                            className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                        >
                            <Home className="w-4 h-4" /> Beranda
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // TAHAP 2 & 3: BILIK SOAL
    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-800 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white">
            {/* HEADER ATAS */}
            <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                            src="/logo-timsim.jpg"
                            alt="Logo Sekolah"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as any).src = "/images/logo-smam18.png";
                            }}
                        />
                    </div>
                    <div>
                        <div className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[200px] sm:max-w-md">
                            {studentSession?.name || studentSession?.candidateName} &bull; <span className="text-slate-600 font-medium">{studentSession?.school}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                            <span>TKA SMP KELAS {studentSession?.grade || "9"}</span>
                            <span>&bull;</span>
                            <span className="text-blue-700 font-bold">{activeSubtest.name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm bg-blue-50 border-blue-200 text-blue-900 shadow-2xs">
                        <Clock className="w-4 h-4 text-blue-700" />
                        <span>{formatTime(subtestTimeLeft)}</span>
                    </div>

                    <button
                        onClick={() => setShowSubtestConfirmModal(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                        <span>{currentSubtestIndex === TKA_SMP_SUBTESTS.length - 1 ? "Selesai Ujian" : "Lanjut ke Subtes 2"}</span>
                        <FastForward className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* BILIK KONTEN */}
            <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">

                {/* KIRI: SOAL */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <span className="text-[10.5px] font-mono font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            SOAL NO. {currentQIndexInSubtest + 1} &bull; {activeSubtest.code}
                        </span>

                        <button
                            type="button"
                            onClick={handleToggleDoubtful}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${doubtfuls[currentQ?.id || `${activeSubtest.code}_${currentQIndexInSubtest}`]
                                ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            <Bookmark className="w-3.5 h-3.5" /> Ragu-ragu
                        </button>
                    </div>

                    {currentQ?.stimulus && (
                        <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs sm:text-[13px] text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                            <div className="flex items-center gap-1.5 text-blue-800 font-mono font-bold text-[10px] uppercase mb-2">
                                <FileText className="w-3.5 h-3.5" /> STIMULUS WACANA INFORMASI / TEKS
                            </div>
                            {currentQ.stimulus}
                        </div>
                    )}

                    <div className="text-sm sm:text-[15px] font-bold text-slate-900 leading-relaxed">
                        {currentQ?.question}
                    </div>

                    <div className="space-y-3 pt-1">
                        {currentQ?.options?.map((opt: any, oIdx: number) => {
                            const optId = typeof opt === "string" ? ["A", "B", "C", "D", "E"][oIdx] : opt.id;
                            const optText = typeof opt === "string" ? opt : opt.text;
                            const qKey = currentQ.id || `${activeSubtest.code}_${currentQIndexInSubtest}`;
                            const isSelected = answers[qKey] === optId;

                            return (
                                <button
                                    key={optId}
                                    type="button"
                                    onClick={() => handleSelectOption(optId)}
                                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm border transition flex items-start gap-3.5 cursor-pointer ${isSelected
                                        ? "bg-blue-50/90 border-blue-600 text-blue-950 font-semibold ring-1 ring-blue-600 shadow-xs"
                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                >
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${isSelected ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
                                        }`}>
                                        {optId}
                                    </span>
                                    <span className="pt-0.5 leading-relaxed">{optText}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                        <button
                            type="button"
                            disabled={currentQIndexInSubtest === 0}
                            onClick={() => setCurrentQIndexInSubtest((i) => Math.max(0, i - 1))}
                            className="px-5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-200 transition cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" /> Sebelumnya
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (currentQIndexInSubtest < currentSubtestQuestions.length - 1) {
                                    setCurrentQIndexInSubtest((i) => i + 1);
                                } else {
                                    setShowSubtestConfirmModal(true);
                                }
                            }}
                            className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-700/20 transition cursor-pointer"
                        >
                            {currentQIndexInSubtest < currentSubtestQuestions.length - 1 ? (
                                <>Berikutnya <ChevronRight className="w-4 h-4" /></>
                            ) : (
                                <>Selesai Subtes <CheckCircle2 className="w-4 h-4" /></>
                            )}
                        </button>
                    </div>
                </div>

                {/* KANAN: PALET NOMOR */}
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs sticky top-24">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-400 font-mono uppercase tracking-wider">PALET SOAL {activeSubtest.code}</span>
                        <span className="text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 font-mono">
                            {currentSubtestQuestions.filter((_, idx) => answers[currentQ?.id || `${activeSubtest.code}_${idx}`]).length}/{currentSubtestQuestions.length} Terisi
                        </span>
                    </div>

                    <div className="grid grid-cols-5 gap-2.5">
                        {currentSubtestQuestions.map((q, idx) => {
                            const qKey = q.id || `${activeSubtest.code}_${idx}`;
                            const isCurrent = currentQIndexInSubtest === idx;
                            const isAnswered = Boolean(answers[qKey]);
                            const isDoubt = Boolean(doubtfuls[qKey]);

                            let btnClass = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50";
                            if (isAnswered) btnClass = "bg-blue-700 text-white font-black border-blue-700 shadow-2xs";
                            if (isDoubt) btnClass = "bg-amber-400 text-slate-900 font-black border-amber-400";

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCurrentQIndexInSubtest(idx)}
                                    className={`h-11 rounded-xl border text-xs font-mono font-bold flex items-center justify-center transition cursor-pointer ${btnClass} ${isCurrent ? "ring-2 ring-slate-900 ring-offset-2" : ""
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-4 border-t border-slate-100 text-[11px] space-y-2 text-slate-500">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-blue-700"></span> <span>Terjawab</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-amber-400"></span> <span>Ragu-ragu</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-white border border-slate-300"></span> <span>Belum Dijawab</span>
                        </div>
                    </div>
                </div>

            </main>

            {/* MODAL KONFIRMASI SUBTES */}
            {showSubtestConfirmModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl border border-slate-100">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto">
                            <FastForward className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-base text-slate-900">
                            {currentSubtestIndex === TKA_SMP_SUBTESTS.length - 1
                                ? "Kumpulkan Seluruh Lembar Ujian?"
                                : "Lanjut ke Subtes 2 (Penalaran Matematika)?"}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Setelah dikonfirmasi, Anda akan beralih ke subtes berikutnya dan jawaban subtes ini tidak dapat diubah lagi.
                        </p>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowSubtestConfirmModal(false)}
                                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                                Cek Kembali
                            </button>
                            <button
                                onClick={handleNextSubtestManual}
                                className="w-1/2 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer shadow-xs"
                            >
                                Ya, Lanjutkan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PERINGATAN KIOSK */}
            {showViolationModal && (
                <div className="fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 text-center shadow-2xl border border-rose-200">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h3 className="font-black text-lg text-slate-900">Peringatan Integritas Bilik Ujian!</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Sistem mendeteksi Anda keluar dari layar penuh atau berpindah jendela tab. Catatan pelanggaran: <strong className="text-rose-600">{violationCount}x</strong>.
                        </p>
                        <button
                            onClick={() => {
                                setShowViolationModal(false);
                                enterExamChamber();
                            }}
                            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                        >
                            Kembali ke Layar Penuh Ujian
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}