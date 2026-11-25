"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { tkaQuestions as defaultQuestions } from "@/data/questions";
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
    CheckSquare,
    Check,
    ArrowRight,
    ShieldCheck,
    MessageCircle,
    Download,
    ExternalLink,
    Sparkles,
    ZoomIn,
    X
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { supabase } from "@/lib/supabase";

const SCHOOL_WHATSAPP_NUMBER = "6281779951229";

// 2 MATA PELAJARAN UTAMA TKA SMP
const TKA_SMP_SUBJECTS = [
    {
        code: "BINDO",
        name: "Bahasa Indonesia",
        domain: "Literasi Membaca (Wacana Informasi & Sastra)",
        durationMin: 75
    },
    {
        code: "MTK",
        name: "Matematika",
        domain: "Numerasi, Aljabar, Geometri & Data Peluang SMP",
        durationMin: 75
    }
];

// Kategori Capaian Resmi Kepmendikdasmen No. 56 Tahun 2026 (Skala 0,00 - 100,00)
export function getKepmendikdasmen56Category(score: number, subject: "BINDO" | "MTK" = "BINDO") {
    const num = Number(score) || 0;
    const isMtk = subject === "MTK";
    const baikCutOff = isMtk ? 56.67 : 76.67;
    const memadaiCutOff = isMtk ? 33.33 : 50.0;

    if (num >= 95.0) {
        return {
            label: "Istimewa",
            badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300",
            description:
                "Predikat khusus bagi peserta didik dengan penguasaan materi dan penalaran tingkat tinggi yang sangat unggul."
        };
    }
    if (num >= baikCutOff) {
        return {
            label: "Baik",
            badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
            description:
                "Menggambarkan pemahaman materi yang kuat dan konsisten dalam mengaplikasikan konsep pada berbagai konteks."
        };
    }
    if (num >= memadaiCutOff) {
        return {
            label: "Memadai",
            badgeColor: "bg-blue-100 text-blue-900 border-blue-300",
            description:
                "Menandakan kemampuan dasar yang cukup sesuai standar minimum pada mata uji terkait."
        };
    }
    return {
        label: "Kurang",
        badgeColor: "bg-rose-100 text-rose-900 border-rose-300",
        description:
            "Menunjukkan perlunya penguatan kompetensi fundamental dan pendampingan belajar pada mata uji terkait."
    };
}

export function formatScoreID(score: number): string {
    return (Number(score) || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function generatePrivateReportToken(phone: string, name: string): string {
    const cleanP = String(phone || "").replace(/\D/g, "");
    const cleanN = String(name || "").toUpperCase().trim();
    const raw = `${cleanP}|${cleanN}|SMAM18_TKA_2026`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    const hexPart = Math.abs(hash).toString(16).toUpperCase().padStart(6, "0");
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `SHTKA-${hexPart}-${randPart}`;
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

function normalizeSubtestCode(raw: string): "BINDO" | "MTK" {
    const upper = String(raw || "").toUpperCase().trim();
    if (
        upper === "MTK" ||
        upper === "PM" ||
        upper.includes("MATEMATIKA") ||
        upper.includes("NUMERASI") ||
        upper.includes("MATH")
    ) {
        return "MTK";
    }
    return "BINDO";
}

function normalizeQuestionItem(q: any, index: number) {
    const code = normalizeSubtestCode(q.subtes_code || q.subtest || q.subject);
    const subject = code === "MTK" ? "Matematika" : "Bahasa Indonesia";
    const materi = q.materi || q.competency || (code === "MTK" ? "Bilangan" : "Pemahaman Tekstual");
    const rawKey = String(q.kunci || q.singleAnswer || "A").toUpperCase().trim();
    const rawType = String(q.type || "").toUpperCase().trim();

    let qType = "PG_SEDERHANA";
    if (rawType === "PGK_KATEGORI" || rawKey.includes("|")) {
        qType = "PGK_KATEGORI";
    } else if (rawType === "PGK_MCMA" || rawKey.includes(",")) {
        qType = "PGK_MCMA";
    }

    let optionsList: string[] = [];
    if (Array.isArray(q.options) && q.options.length > 0) {
        optionsList = q.options.map((opt: any) => (typeof opt === "string" ? opt : String(opt?.text ?? "")));
    } else {
        optionsList = [q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e]
            .filter((val) => val !== undefined && val !== null && String(val).trim().length > 0)
            .map((val) => String(val));
    }

    const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    let singleAnswerIdx = 0;
    let multiAnswersList: number[] = Array.isArray(q.multiAnswers) ? q.multiAnswers : [];
    let statementsList: any[] = Array.isArray(q.statements) ? q.statements : [];

    if (qType === "PGK_KATEGORI") {
        if (statementsList.length === 0) {
            const catKeys = String(q.kunci || "").split("|").map((k) => k.trim());
            statementsList = optionsList.map((stmtText, sIdx) => ({
                id: `st_${index}_${sIdx}`,
                statement: stmtText,
                correctCategory: catKeys[sIdx] || "Benar"
            }));
        }
    } else if (qType === "PGK_MCMA") {
        if (multiAnswersList.length === 0) {
            multiAnswersList = rawKey
                .split(",")
                .map((k) => keyMap[k.trim()])
                .filter((n) => n !== undefined);
        }
    } else {
        if (typeof q.singleAnswer === "number") {
            singleAnswerIdx = q.singleAnswer;
        } else {
            singleAnswerIdx = keyMap[rawKey] ?? 0;
        }
    }

    return {
        id: q.id !== undefined && q.id !== null ? String(q.id) : `${code}_${index + 1}`,
        no_soal: Number(q.no_soal) || index + 1,
        subtes_code: code,
        subject,
        materi,
        type: qType,
        kunci: rawKey,
        stimulus: q.stimulus || "",
        image_url: q.image_url || "",
        image_position: q.image_position || "above",
        question: q.pertanyaan || q.question || "",
        options: optionsList,
        singleAnswer: singleAnswerIdx,
        multiAnswers: multiAnswersList,
        statements: statementsList,
        difficulty: Number(q.difficulty) > 0 ? Number(q.difficulty) : 1,
        pembahasan: q.pembahasan || q.explanation || ""
    };
}

// Kalkulasi Skor Skala 0,00 - 100,00 (2 Angka di Belakang Koma) Sesuai Kepmendikdasmen No. 56 Tahun 2026
export function calculateTkaSmpScore(questionsList: any[], currentAnswers: Record<string, any>) {
    let bindoScoreSum = 0,
        bindoWeightSum = 0,
        bindoCount = 0;
    let mtkScoreSum = 0,
        mtkWeightSum = 0,
        mtkCount = 0;

    questionsList.forEach((q: any, idx: number) => {
        const qKey = q.id ? String(q.id) : `${q.subtes_code}_${idx}`;
        const userAns = currentAnswers[qKey] ?? currentAnswers[`${q.subtes_code}_${q.no_soal}`];
        const weight = Number(q.difficulty) > 0 ? Number(q.difficulty) : 1;
        let itemFraction = 0;

        if (userAns !== undefined && userAns !== null) {
            if (q.type === "PG_SEDERHANA" || !q.type) {
                if (typeof userAns === "number" && userAns === q.singleAnswer) {
                    itemFraction = 1;
                } else if (typeof userAns === "string" && userAns.toUpperCase().trim() === String(q.kunci || "").toUpperCase().trim()) {
                    itemFraction = 1;
                }
            } else if (q.type === "PGK_MCMA") {
                const correctArr: number[] = q.multiAnswers || [];
                const userArr: number[] = Array.isArray(userAns) ? userAns : [];
                const matchCount = userArr.filter((val) => correctArr.includes(val)).length;
                const wrongCount = userArr.filter((val) => !correctArr.includes(val)).length;
                itemFraction = Math.max(0, (matchCount - wrongCount) / (correctArr.length || 1));
            } else if (q.type === "PGK_KATEGORI" && Array.isArray(q.statements)) {
                let correctCount = 0;
                q.statements.forEach((st: any, sIdx: number) => {
                    const chosen =
                        userAns?.[st.id] ??
                        userAns?.[`st_${idx}_${sIdx}`] ??
                        (typeof userAns === "object" ? Object.values(userAns)[sIdx] : undefined);
                    if (
                        String(chosen || "").toUpperCase().trim() ===
                        String(st.correctCategory || "").toUpperCase().trim()
                    ) {
                        correctCount++;
                    }
                });
                itemFraction = correctCount / (q.statements.length || 1);
            }
        }

        if (q.subtes_code === "BINDO") {
            bindoCount++;
            bindoWeightSum += weight;
            bindoScoreSum += itemFraction * weight;
        } else {
            mtkCount++;
            mtkWeightSum += weight;
            mtkScoreSum += itemFraction * weight;
        }
    });

    const bindoScore =
        bindoCount > 0 ? Number(((bindoScoreSum / (bindoWeightSum || 1)) * 100).toFixed(2)) : 0;
    const mtkScore =
        mtkCount > 0 ? Number(((mtkScoreSum / (mtkWeightSum || 1)) * 100).toFixed(2)) : 0;

    let totalScore = 0;
    if (bindoCount > 0 && mtkCount > 0) {
        totalScore = Number(((bindoScore + mtkScore) / 2).toFixed(2));
    } else if (bindoCount > 0) {
        totalScore = bindoScore;
    } else if (mtkCount > 0) {
        totalScore = mtkScore;
    }

    const bindoCat = getKepmendikdasmen56Category(bindoScore, "BINDO");
    const mtkCat = getKepmendikdasmen56Category(mtkScore, "MTK");
    const overallCat = getKepmendikdasmen56Category(totalScore, "BINDO");

    return {
        bindoScore,
        mtkScore,
        totalScore,
        bindoPredicate: bindoCat.label,
        mtkPredicate: mtkCat.label,
        predicate: `BINDO: ${bindoCat.label} | MTK: ${mtkCat.label}`,
        overallCategory: overallCat.label
    };
}

export default function OfficialExamChamberPage() {
    const router = useRouter();

    const [studentSession, setStudentSession] = useState<any>(null);
    const [allQuestionsList, setAllQuestionsList] = useState<any[]>(() =>
        (defaultQuestions || []).map((q, idx) => normalizeQuestionItem(q, idx))
    );
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

    const [currentSubtestIndex, setCurrentSubtestIndex] = useState(0);
    const [currentQIndexInSubtest, setCurrentQIndexInSubtest] = useState(0);
    const [subtestDurationsSec, setSubtestDurationsSec] = useState<Record<string, number>>({
        BINDO: 4500,
        MTK: 4500
    });
    const [subtestTimeLeft, setSubtestTimeLeft] = useState<number>(4500);

    const [answers, setAnswers] = useState<Record<string, any>>({});
    const answersRef = useRef<Record<string, any>>({});

    const [doubtfuls, setDoubtfuls] = useState<Record<string, boolean>>({});
    const [violationCount, setViolationCount] = useState(0);
    const [lastWarningReason, setLastWarningReason] = useState<string>(
        "Keluar dari mode layar penuh atau berpindah tab/aplikasi lain."
    );
    const violationsRef = useRef<number>(0);
    const lastViolationTimeRef = useRef<number>(0);
    const isSubmittingRef = useRef<boolean>(false);

    const [isInExam, setIsInExam] = useState(false);
    const [isIntermission, setIsIntermission] = useState(false);
    const [isExamCompleted, setIsExamCompleted] = useState(false);
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);
    const [showSubtestConfirmModal, setShowSubtestConfirmModal] = useState(false);
    const [showViolationModal, setShowViolationModal] = useState(false);
    const [finalSavedReport, setFinalSavedReport] = useState<any>(null);

    // State gerbang WhatsApp + Konfirmasi 4 Digit Nomor HP Aktif -> Unduh Rapor PDF
    const [waClickedAt, setWaClickedAt] = useState<number | null>(null);
    const [confirmPhoneLast4, setConfirmPhoneLast4] = useState<string>("");
    const [hasVerifiedWaSwitch, setHasVerifiedWaSwitch] = useState(false);
    const [previewFlyer, setPreviewFlyer] = useState<{ src: string; title: string } | null>(null);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        violationsRef.current = violationCount;
    }, [violationCount]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const localData = localStorage.getItem("tka_student");
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (!parsed.phone || !parsed.name) {
                    router.replace("/login");
                    return;
                }
                setStudentSession(parsed);
            } catch {
                router.replace("/login");
                return;
            }
        } else {
            router.replace("/login");
            return;
        }

        const preloadImages = (list: any[]) => {
            list.forEach((item) => {
                if (item.image_url && String(item.image_url).trim().startsWith("http")) {
                    const img = new window.Image();
                    img.src = String(item.image_url).trim();
                }
            });
        };

        let hasCached = false;
        const rawBank = localStorage.getItem("tka_bank_soal_cbt") || localStorage.getItem("tka_bank_soal");
        if (rawBank) {
            try {
                const parsedBank = JSON.parse(rawBank);
                if (Array.isArray(parsedBank) && parsedBank.length > 0) {
                    const normalized = parsedBank.map((q, idx) => normalizeQuestionItem(q, idx));
                    setAllQuestionsList(normalized);
                    preloadImages(normalized);
                    setIsLoadingQuestions(false);
                    hasCached = true;
                }
            } catch { }
        }

        const loadQuestionsFromCloud = async () => {
            if (!hasCached) setIsLoadingQuestions(true);
            try {
                const { data, error } = await supabase
                    .from("tka_questions")
                    .select("*")
                    .order("subtes_code", { ascending: true })
                    .order("no_soal", { ascending: true });

                if (!error && Array.isArray(data) && data.length > 0) {
                    const normalized = data.map((q, idx) => normalizeQuestionItem(q, idx));
                    setAllQuestionsList(normalized);
                    preloadImages(normalized);
                    localStorage.setItem("tka_bank_soal_cbt", JSON.stringify(data));
                }
            } catch (err) {
                console.error("Gagal memuat soal dari Supabase:", err);
            } finally {
                setIsLoadingQuestions(false);
            }
        };

        const loadSessionDurations = async () => {
            try {
                const { data } = await supabase
                    .from("tka_sessions")
                    .select("durasi_bindo_detik, durasi_mtk_detik")
                    .eq("id", 1)
                    .single();

                if (data) {
                    const bindoSec = Number(data.durasi_bindo_detik) > 0 ? Number(data.durasi_bindo_detik) : 4500;
                    const mtkSec = Number(data.durasi_mtk_detik) > 0 ? Number(data.durasi_mtk_detik) : 4500;
                    setSubtestDurationsSec({ BINDO: bindoSec, MTK: mtkSec });
                    setSubtestTimeLeft(bindoSec);
                }
            } catch { }
        };

        loadQuestionsFromCloud();
        loadSessionDurations();
    }, [router]);

    const activeSubtest = TKA_SMP_SUBJECTS[currentSubtestIndex];

    const currentSubtestQuestions = useMemo(() => {
        const filtered = allQuestionsList.filter((q) => q.subtes_code === activeSubtest.code);
        return filtered.length > 0 ? filtered : allQuestionsList;
    }, [allQuestionsList, activeSubtest]);

    const currentQ = currentSubtestQuestions[currentQIndexInSubtest] || currentSubtestQuestions[0];
    const currentQKey = currentQ?.id ? String(currentQ.id) : `${activeSubtest.code}_${currentQIndexInSubtest}`;

    const enterExamChamber = async () => {
        if (isSubmittingRef.current || isExamCompleted) return;
        setIsInExam(true);
        try {
            if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
        } catch { }

        const cleanPhone = String(studentSession?.phone || "").replace(/\D/g, "");
        if (cleanPhone) {
            await supabase.from("tka_students").upsert(
                {
                    phone: cleanPhone,
                    name: studentSession?.name,
                    school: studentSession?.school || "SMP / MTs",
                    grade: studentSession?.grade || "9",
                    interest: studentSession?.interest || "Umum",
                    status: "Sedang Mengerjakan"
                },
                { onConflict: "phone" }
            );
        }
    };

    const recordViolation = useCallback(
        (reasonText?: string) => {
            if (!isInExam || isExamCompleted || isIntermission || isSubmittingRef.current) return;

            const now = Date.now();
            if (now - lastViolationTimeRef.current < 1500) return;
            lastViolationTimeRef.current = now;

            if (reasonText) {
                setLastWarningReason(reasonText);
            }

            setViolationCount((prev) => {
                const next = prev + 1;
                violationsRef.current = next;
                const cleanPhone = String(studentSession?.phone || "").replace(/\D/g, "");
                if (cleanPhone) {
                    supabase
                        .from("tka_students")
                        .update({
                            violations: next,
                            status: "Sedang Mengerjakan"
                        })
                        .eq("phone", cleanPhone);
                }
                return next;
            });
            setShowViolationModal(true);
        },
        [isInExam, isExamCompleted, isIntermission, studentSession]
    );

    useEffect(() => {
        if (!isInExam || isExamCompleted || isIntermission || isSubmittingRef.current) return;

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && !isSubmittingRef.current) {
                recordViolation("Anda keluar dari mode layar penuh (Fullscreen).");
            }
        };
        const handleVisibilityChange = () => {
            if (document.hidden && !isSubmittingRef.current) {
                recordViolation("Anda berpindah ke tab atau aplikasi lain.");
            }
        };
        const handleWindowBlur = () => {
            if (!isSubmittingRef.current) {
                recordViolation("Fokus jendela ujian berpindah ke aplikasi/notifikasi lain.");
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            const isPrintScreen = e.key === "PrintScreen";
            const isSnipping = (e.ctrlKey || e.metaKey) && e.shiftKey && ["s", "3", "4", "5"].includes(e.key.toLowerCase());
            if (isPrintScreen || isSnipping) {
                e.preventDefault();
                recordViolation("Terdeteksi percobaan tangkapan layar (Screenshot).");
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isInExam, isExamCompleted, isIntermission, recordViolation]);

    const executeFinalSubmission = useCallback(async () => {
        // Kunci flag submit TERLEBIH DAHULU agar tidak pernah memicu popup kuning kilat saat keluar fullscreen
        isSubmittingRef.current = true;
        setShowViolationModal(false);
        setShowSubtestConfirmModal(false);
        setIsIntermission(false);
        setIsSubmittingScore(true);

        try {
            if (typeof document !== "undefined" && document.fullscreenElement) {
                await document.exitFullscreen().catch(() => { });
            }
        } catch { }

        const snapshotAnswers = { ...answersRef.current };
        const snapshotViolations = violationsRef.current;
        const computed = calculateTkaSmpScore(allQuestionsList, snapshotAnswers);
        const finishTime = new Date().toLocaleTimeString("id-ID");

        let cleanPhone = String(studentSession?.phone || "").replace(/\D/g, "").trim();
        if (cleanPhone.startsWith("62")) cleanPhone = "0" + cleanPhone.slice(2);

        const reportToken = generatePrivateReportToken(cleanPhone, studentSession?.name || "");

        const finalReport = {
            student: studentSession,
            cleanPhone,
            reportToken,
            totalScore: computed.totalScore,
            bindoScore: computed.bindoScore,
            mtkScore: computed.mtkScore,
            indoScore: computed.bindoScore,
            mathScore: computed.mtkScore,
            bindoPredicate: computed.bindoPredicate,
            mtkPredicate: computed.mtkPredicate,
            predicate: computed.predicate,
            overallCategory: computed.overallCategory,
            violations: snapshotViolations,
            answers: snapshotAnswers,
            questionsSnapshot: allQuestionsList,
            submittedAt: new Date().toISOString()
        };

        setFinalSavedReport(finalReport);
        localStorage.setItem("tka_result", JSON.stringify(finalReport));
        try {
            localStorage.removeItem("tka_draft_answers");
        } catch { }

        if (cleanPhone) {
            try {
                // 1. Simpan skor desimal 2 angka di belakang koma & token rapor ke tka_students
                const { error: stuErr } = await supabase.from("tka_students").upsert(
                    {
                        phone: cleanPhone,
                        name: studentSession?.name,
                        school: studentSession?.school || "SMP / MTs",
                        grade: studentSession?.grade || "9",
                        interest: studentSession?.interest || "Umum",
                        status: "Selesai",
                        violations: snapshotViolations,
                        score: Number(computed.totalScore.toFixed(2)),
                        bindo_score: Number(computed.bindoScore.toFixed(2)),
                        mtk_score: Number(computed.mtkScore.toFixed(2)),
                        waktu_selesai: finishTime,
                        report_token: reportToken
                    },
                    { onConflict: "phone" }
                );

                if (stuErr) {
                    const { error: stuErr2 } = await supabase.from("tka_students").upsert(
                        {
                            phone: cleanPhone,
                            name: studentSession?.name,
                            school: studentSession?.school || "SMP / MTs",
                            grade: studentSession?.grade || "9",
                            interest: studentSession?.interest || "Umum",
                            status: "Selesai",
                            violations: snapshotViolations,
                            score: Number(computed.totalScore.toFixed(2)),
                            bindo_score: Number(computed.bindoScore.toFixed(2)),
                            mtk_score: Number(computed.mtkScore.toFixed(2)),
                            waktu_selesai: finishTime
                        },
                        { onConflict: "phone" }
                    );

                    if (stuErr2) {
                        await supabase
                            .from("tka_students")
                            .update({
                                status: "Selesai",
                                violations: snapshotViolations,
                                score: Math.round(computed.totalScore),
                                bindo_score: Math.round(computed.bindoScore),
                                mtk_score: Math.round(computed.mtkScore),
                                waktu_selesai: finishTime
                            })
                            .eq("phone", cleanPhone);
                    }
                }

                // 2. Simpan rincian jawaban jsonb ke tka_results
                await supabase.from("tka_results").delete().eq("phone", cleanPhone);
                const { error: resErr } = await supabase.from("tka_results").insert({
                    phone: cleanPhone,
                    student_name: studentSession?.name,
                    school: studentSession?.school || "SMP / MTs",
                    total_score: Number(computed.totalScore.toFixed(2)),
                    bindo_score: Number(computed.bindoScore.toFixed(2)),
                    mtk_score: Number(computed.mtkScore.toFixed(2)),
                    predicate: computed.predicate,
                    is_tuntas_kkm: true,
                    violations: snapshotViolations,
                    answers: snapshotAnswers
                });

                if (resErr) {
                    await supabase.from("tka_results").insert({
                        phone: cleanPhone,
                        student_name: studentSession?.name,
                        school: studentSession?.school || "SMP / MTs",
                        total_score: Math.round(computed.totalScore),
                        bindo_score: Math.round(computed.bindoScore),
                        mtk_score: Math.round(computed.mtkScore),
                        predicate: computed.predicate,
                        is_tuntas_kkm: true,
                        violations: snapshotViolations,
                        answers: snapshotAnswers
                    });
                }
            } catch (e) {
                console.error("Gagal sinkronisasi skor ke Supabase:", e);
            }
        }

        setIsSubmittingScore(false);
        setIsExamCompleted(true);
    }, [allQuestionsList, studentSession]);

    const handleCompleteCurrentSubject = useCallback(() => {
        setShowSubtestConfirmModal(false);
        if (currentSubtestIndex < TKA_SMP_SUBJECTS.length - 1) {
            setIsIntermission(true);
        } else {
            executeFinalSubmission();
        }
    }, [currentSubtestIndex, executeFinalSubmission]);

    const handleStartNextSubjectFromIntermission = () => {
        const nextIdx = currentSubtestIndex + 1;
        const nextCode = TKA_SMP_SUBJECTS[nextIdx].code;
        setCurrentSubtestIndex(nextIdx);
        setCurrentQIndexInSubtest(0);
        setSubtestTimeLeft(subtestDurationsSec[nextCode] || Math.round(TKA_SMP_SUBJECTS[nextIdx].durationMin * 60));
        setIsIntermission(false);
        enterExamChamber();
    };

    useEffect(() => {
        if (!isInExam || isExamCompleted || isIntermission || isSubmittingRef.current) return;

        const timer = setInterval(() => {
            setSubtestTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleCompleteCurrentSubject();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isInExam, isExamCompleted, isIntermission, currentSubtestIndex, handleCompleteCurrentSubject]);

    const handleSelectSingleOption = (optIdx: number) => {
        setAnswers((prev) => {
            const next = { ...prev, [currentQKey]: optIdx };
            answersRef.current = next;
            try {
                localStorage.setItem("tka_draft_answers", JSON.stringify(next));
            } catch { }
            return next;
        });
    };

    const handleToggleMultiOption = (optIdx: number) => {
        setAnswers((prev) => {
            const existing: number[] = Array.isArray(prev[currentQKey]) ? prev[currentQKey] : [];
            const updated = existing.includes(optIdx)
                ? existing.filter((i) => i !== optIdx)
                : [...existing, optIdx];
            const next = { ...prev, [currentQKey]: updated };
            answersRef.current = next;
            try {
                localStorage.setItem("tka_draft_answers", JSON.stringify(next));
            } catch { }
            return next;
        });
    };

    const handleSelectCategory = (statementId: string, choice: string) => {
        setAnswers((prev) => {
            const existing = prev[currentQKey] || {};
            const updated = { ...existing, [statementId]: choice };
            const next = { ...prev, [currentQKey]: updated };
            answersRef.current = next;
            try {
                localStorage.setItem("tka_draft_answers", JSON.stringify(next));
            } catch { }
            return next;
        });
    };

    const handleToggleDoubtful = () => {
        setDoubtfuls((prev) => ({ ...prev, [currentQKey]: !prev[currentQKey] }));
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const formatDurationLabel = (totalSecs: number) => {
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return s > 0 ? `${m} Menit ${s} Detik` : `${m} Menit`;
    };

    if (!studentSession) return null;

    // GERBANG KARANTINA BILIK UJIAN TKA SMP
    if (!isInExam && !isExamCompleted) {
        const bindoCount = allQuestionsList.filter((q) => q.subtes_code === "BINDO").length;
        const mtkCount = allQuestionsList.filter((q) => q.subtes_code === "MTK").length;

        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-3.5 sm:p-4 font-sans text-slate-800">
                <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-xl p-5 sm:p-9 space-y-5 text-center relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-[#1e3a8a]" />

                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1 mx-auto shadow-xs overflow-hidden">
                        <img
                            src="/logo-timsim.jpg"
                            alt="Logo SMA Muhammadiyah 18 Jakarta"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                            }}
                        />
                    </div>

                    <div className="space-y-1">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 font-mono text-[10px] font-bold text-blue-900 tracking-wider">
                            SMA MUHAMMADIYAH 18 JAKARTA
                        </span>
                        <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Bilik Ujian Tryout TKA SMP
                        </h1>
                        <p className="text-xs text-slate-500">
                            Peserta: <strong className="text-slate-800">{studentSession?.name}</strong> ({studentSession?.school})
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2.5 text-xs">
                        <div className="font-bold text-slate-700 font-mono uppercase text-[11px] flex justify-between items-center">
                            <span>Struktur Mata Uji TKA SMP:</span>
                            <span className="text-blue-700 font-black">Kepmendikdasmen No. 56/2026</span>
                        </div>
                        {isLoadingQuestions ? (
                            <div className="py-4 text-center font-mono text-slate-400">
                                Menyinkronkan paket soal dari Supabase...
                            </div>
                        ) : (
                            <div className="space-y-2 text-[11px] text-slate-600">
                                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                                    <div>
                                        <div className="font-bold text-slate-900">1. Bahasa Indonesia (BINDO)</div>
                                        <div className="text-[10px] text-slate-500">Literasi Membaca Wacana Informasi & Sastra</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded block">
                                            {bindoCount} Soal
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500">
                                            {formatDurationLabel(subtestDurationsSec.BINDO)}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                                    <div>
                                        <div className="font-bold text-slate-900">2. Matematika (MTK)</div>
                                        <div className="text-[10px] text-slate-500">Numerasi, Aljabar, Geometri & Data Peluang</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded block">
                                            {mtkCount} Soal
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500">
                                            {formatDurationLabel(subtestDurationsSec.MTK)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={enterExamChamber}
                        disabled={isLoadingQuestions}
                        className="w-full py-3.5 px-6 rounded-2xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <Maximize2 className="w-4 h-4" />
                        <span>Masuk Layar Penuh & Mulai Bahasa Indonesia</span>
                    </button>
                </div>
            </div>
        );
    }

    // LAYAR JEDA TRANSISI ANTAR-MATA PELAJARAN (BINDO -> MTK)
    if (isIntermission && !isExamCompleted) {
        const nextSubject = TKA_SMP_SUBJECTS[currentSubtestIndex + 1];
        const nextQuestionsCount = allQuestionsList.filter((q) => q.subtes_code === nextSubject.code).length;
        const nextDurationSec = subtestDurationsSec[nextSubject.code] || 4500;

        return (
            <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
                <div className="max-w-lg w-full bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl animate-in zoom-in-95">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5">
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-mono text-[10px] font-bold uppercase tracking-wider">
                            JEDA TRANSISI ANTAR-MATA UJI
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                            Mata Uji 1 (Bahasa Indonesia) Selesai!
                        </h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Jawaban Bahasa Indonesia Anda telah disimpan dengan aman. Silakan tarik napas sejenak sebelum melanjutkan ke mata uji berikutnya.
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 text-left space-y-2 text-xs">
                        <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                            MATA UJI BERIKUTNYA:
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <div className="text-base font-black text-white">
                                    {nextSubject.name} ({nextSubject.code})
                                </div>
                                <div className="text-[11px] text-slate-400">{nextSubject.domain}</div>
                            </div>
                            <div className="text-right font-mono shrink-0">
                                <div className="text-sm font-black text-emerald-400">{nextQuestionsCount} Soal</div>
                                <div className="text-[10px] text-slate-400">{formatDurationLabel(nextDurationSec)}</div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleStartNextSubjectFromIntermission}
                        className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <span>Lanjut Kerjakan {nextSubject.name}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // SELESAI UJIAN: HANYA TAMPILKAN KODE VERIFIKASI & TOMBOL WA PANITIA
    if (isExamCompleted && finalSavedReport) {
        const cleanPhone = finalSavedReport.cleanPhone || String(studentSession?.phone || "").replace(/\D/g, "");
        const token = finalSavedReport.reportToken || "";

        const waText = [
            `LAPOR_TKA — SMA Muhammadiyah 18 Jakarta`,
            `Assalamu'alaikum Panitia Tryout TKA SMP SMA Muhammadiyah 18 Jakarta.`,
            `Saya telah menyelesaikan ujian:`,
            ``,
            `Nama: ${studentSession?.name}`,
            `Asal Sekolah: ${studentSession?.school} (Kelas ${studentSession?.grade || "9"})`,
            `No. HP Login: ${cleanPhone}`,
            `Kode Verifikasi Rapor: ${token}`,
            ``,
            `Mohon tautan untuk mengunduh Sertifikat Rapor SHTKA (PDF) saya. Terima kasih.`
        ].join("\n");

        const waUrl = `https://wa.me/${SCHOOL_WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

        return (
            <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800 space-y-6">
                <div className="max-w-xl mx-auto w-full bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 text-center space-y-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-600" />

                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10px] font-bold uppercase">
                            LEMBAR JAWABAN TERKUNCI DI SERVER
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Terima Kasih, {studentSession?.name}!
                        </h2>
                        <p className="text-xs text-slate-500">
                            Asal Sekolah: <strong className="text-slate-700">{studentSession?.school}</strong>
                        </p>
                    </div>

                    {/* KODE VERIFIKASI RAPOR */}
                    <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-1.5">
                        <div className="text-[10.5px] font-mono font-bold uppercase text-blue-800">
                            KODE VERIFIKASI RAPOR ANDA (SALIN / SIMPAN):
                        </div>
                        <div className="text-base sm:text-xl font-mono font-black tracking-wider text-slate-900 bg-white py-2 px-4 rounded-xl border border-blue-200 inline-block select-all">
                            {token}
                        </div>
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs text-slate-600 leading-relaxed">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                            <span>Cara Mendapatkan Tautan Unduh Rapor PDF</span>
                        </div>
                        <ol className="list-decimal pl-4 space-y-1 text-[11.5px] text-slate-700 font-medium">
                            <li>
                                Tekan tombol hijau <strong>“Kirim Laporan ke WA Panitia”</strong> di bawah, lalu klik <strong>Kirim</strong> pada aplikasi WhatsApp Anda.
                            </li>
                            <li>
                                Balasan otomatis dari WhatsApp Panitia akan mengirimkan <strong>tautan halaman unduh rapor</strong>. Buka tautan tersebut, lalu masukkan <strong>Kode Verifikasi Rapor</strong> dan <strong>4 digit terakhir nomor HP terdaftar</strong> Anda.
                            </li>
                        </ol>
                    </div>

                    <div className="space-y-3 pt-1">
                        <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 px-5 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                        >
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <span>Kirim Laporan ke WA Panitia</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                        </a>

                        <button
                            type="button"
                            onClick={() => {
                                localStorage.removeItem("tka_result");
                                router.push("/");
                            }}
                            className="w-full py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <Home className="w-3.5 h-3.5" />
                            <span>Selesai & Kembali ke Beranda</span>
                        </button>
                    </div>
                </div>

                {/* BROSUR PROMOSI PPDB SMA MUHAMMADIYAH 18 JAKARTA */}
                <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="space-y-0.5 text-left">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px] font-bold">
                                <Sparkles className="w-3 h-3 text-amber-600" /> INFO SPMB / PPDB 2026–2027
                            </span>
                            <h3 className="text-sm sm:text-base font-black text-slate-900">
                                Penerimaan Peserta Didik Baru — SMA Muhammadiyah 18 Jakarta
                            </h3>
                        </div>
                        <span className="text-[11px] text-slate-500">Ketuk gambar untuk memperbesar</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div
                            onClick={() =>
                                setPreviewFlyer({
                                    src: "/flyer-ppdb-depan.jpg",
                                    title: "Brosur PPDB SMA Muhammadiyah 18 Jakarta — Halaman Depan"
                                })
                            }
                            className="rounded-2xl border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-blue-400 transition"
                        >
                            <img src="/flyer-ppdb-depan.jpg" alt="Flyer PPDB Depan" className="w-full h-auto object-contain" />
                            <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                                <span>Halaman Depan</span>
                                <span className="text-blue-700 font-mono inline-flex items-center gap-1">
                                    <ZoomIn className="w-3.5 h-3.5" /> Perbesar
                                </span>
                            </div>
                        </div>

                        <div
                            onClick={() =>
                                setPreviewFlyer({
                                    src: "/flyer-ppdb-belakang.jpg",
                                    title: "Brosur PPDB SMA Muhammadiyah 18 Jakarta — Halaman Belakang"
                                })
                            }
                            className="rounded-2xl border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-blue-400 transition"
                        >
                            <img src="/flyer-ppdb-belakang.jpg" alt="Flyer PPDB Belakang" className="w-full h-auto object-contain" />
                            <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                                <span>Halaman Belakang</span>
                                <span className="text-blue-700 font-mono inline-flex items-center gap-1">
                                    <ZoomIn className="w-3.5 h-3.5" /> Perbesar
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {previewFlyer && (
                    <div
                        onClick={() => setPreviewFlyer(null)}
                        className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
                        >
                            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
                                <span className="text-xs font-bold truncate">{previewFlyer.title}</span>
                                <button
                                    type="button"
                                    onClick={() => setPreviewFlyer(null)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="max-h-[82vh] overflow-y-auto bg-slate-100 flex justify-center">
                                <img src={previewFlyer.src} alt={previewFlyer.title} className="w-full h-auto object-contain" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // BILIK SOAL UJIAN AKTIF (BINDO / MTK)
    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-800 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white">
            <header className="bg-white border-b border-slate-200 px-3.5 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                            src="/logo-timsim.jpg"
                            alt="Logo Sekolah"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                            }}
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[160px] sm:max-w-md">
                            {studentSession?.name} •{" "}
                            <span className="text-slate-600 font-medium">{studentSession?.school}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 truncate">
                            <span>TKA SMP KELAS {studentSession?.grade || "9"}</span>
                            <span>•</span>
                            <span className="text-blue-700 font-bold">
                                {activeSubtest.name} ({activeSubtest.code})
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {violationCount > 0 && (
                        <span
                            title="Catatan Peringatan Fokus Layar"
                            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[10.5px] font-bold"
                        >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Peringatan: {violationCount}x</span>
                        </span>
                    )}

                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm bg-blue-50 border-blue-200 text-blue-900 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700" />
                        <span>{formatTime(subtestTimeLeft)}</span>
                    </div>

                    <button
                        onClick={() => setShowSubtestConfirmModal(true)}
                        className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                        <span>{currentSubtestIndex === TKA_SMP_SUBJECTS.length - 1 ? "Selesai Ujian" : "Lanjut MTK"}</span>
                        <FastForward className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto w-full p-3.5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start flex-1">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-5 sm:space-y-6 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10.5px] font-mono font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                SOAL NO. {currentQIndexInSubtest + 1} • {activeSubtest.code}
                            </span>
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold">
                                {currentQ?.materi}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleToggleDoubtful}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${doubtfuls[currentQKey]
                                ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            <Bookmark className="w-3.5 h-3.5" /> Ragu-ragu
                        </button>
                    </div>

                    {currentQ?.image_url && currentQ?.image_position === "above" && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
                            <img
                                src={currentQ.image_url}
                                alt="Ilustrasi Soal"
                                className="max-h-56 sm:max-h-64 object-contain rounded-xl max-w-full"
                            />
                        </div>
                    )}

                    {currentQ?.stimulus && (
                        <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs sm:text-[13px] text-slate-700 leading-relaxed whitespace-pre-line font-normal overflow-x-auto">
                            <div className="flex items-center gap-1.5 text-blue-800 font-mono font-bold text-[10px] uppercase mb-2">
                                <FileText className="w-3.5 h-3.5" /> STIMULUS WACANA INFORMASI / TEKS
                            </div>
                            <RenderLatex content={currentQ.stimulus} />
                        </div>
                    )}

                    <div className="text-sm sm:text-[15px] font-bold text-slate-900 leading-relaxed overflow-x-auto">
                        <RenderLatex content={currentQ?.question} />
                    </div>

                    {currentQ?.image_url && currentQ?.image_position === "below" && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
                            <img
                                src={currentQ.image_url}
                                alt="Ilustrasi Soal"
                                className="max-h-56 sm:max-h-64 object-contain rounded-xl max-w-full"
                            />
                        </div>
                    )}

                    {(!currentQ?.type || currentQ?.type === "PG_SEDERHANA") && currentQ?.options && (
                        <div className="space-y-2.5 sm:space-y-3 pt-1">
                            {currentQ.options.map((optText: string, oIdx: number) => {
                                const isSelected = answers[currentQKey] === oIdx;
                                const alphabet = ["A", "B", "C", "D", "E"][oIdx];

                                return (
                                    <button
                                        key={oIdx}
                                        type="button"
                                        onClick={() => handleSelectSingleOption(oIdx)}
                                        className={`w-full text-left p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm border transition flex items-start gap-3 sm:gap-3.5 cursor-pointer ${isSelected
                                            ? "bg-blue-50/90 border-blue-600 text-blue-950 font-semibold ring-1 ring-blue-600 shadow-xs"
                                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                            }`}
                                    >
                                        <span
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${isSelected ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
                                                }`}
                                        >
                                            {alphabet}
                                        </span>
                                        <span className="pt-0.5 leading-relaxed overflow-x-auto">
                                            <RenderLatex content={optText} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {currentQ?.type === "PGK_MCMA" && currentQ?.options && (
                        <div className="space-y-3 pt-1">
                            <div className="text-[11px] text-blue-800 font-semibold italic bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/60 flex items-center gap-1.5">
                                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                <span>Model MCMA: Anda dapat memilih lebih dari satu jawaban yang benar dengan mencentang kotak.</span>
                            </div>
                            {currentQ.options.map((optText: string, oIdx: number) => {
                                const chosenList: number[] = Array.isArray(answers[currentQKey]) ? answers[currentQKey] : [];
                                const isSelected = chosenList.includes(oIdx);

                                return (
                                    <button
                                        key={oIdx}
                                        type="button"
                                        onClick={() => handleToggleMultiOption(oIdx)}
                                        className={`w-full text-left p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm border transition flex items-start gap-3.5 cursor-pointer ${isSelected
                                            ? "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-semibold ring-1 ring-indigo-600 shadow-xs"
                                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                            }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${isSelected ? "bg-indigo-700 border-indigo-700 text-white" : "bg-white border-slate-300"
                                                }`}
                                        >
                                            {isSelected && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                        <span className="pt-0.5 leading-relaxed overflow-x-auto">
                                            <RenderLatex content={optText} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {currentQ?.type === "PGK_KATEGORI" && currentQ?.statements && (
                        <div className="pt-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[440px]">
                                <thead>
                                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                                        <th className="p-3.5 rounded-l-xl">Pernyataan</th>
                                        <th className="p-3.5 text-center w-28">Benar / Sesuai</th>
                                        <th className="p-3.5 text-center w-28 rounded-r-xl">Salah / Tidak Sesuai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentQ.statements.map((st: any) => {
                                        const currentVal = answers[currentQKey]?.[st.id];
                                        const labelYes =
                                            st.correctCategory === "Benar" || st.correctCategory === "Salah" ? "Benar" : "Sesuai";
                                        const labelNo =
                                            st.correctCategory === "Benar" || st.correctCategory === "Salah" ? "Salah" : "Tidak Sesuai";
                                        const isYes = currentVal === labelYes;
                                        const isNo = currentVal === labelNo;

                                        return (
                                            <tr key={st.id} className="hover:bg-slate-50/60 transition">
                                                <td className="p-3.5 text-slate-800 leading-relaxed font-normal">
                                                    <RenderLatex content={st.statement} />
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectCategory(st.id, labelYes)}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer ${isYes
                                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                                            : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                                                            }`}
                                                    >
                                                        {labelYes}
                                                    </button>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectCategory(st.id, labelNo)}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer ${isNo
                                                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                                            : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                                                            }`}
                                                    >
                                                        {labelNo}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                            type="button"
                            disabled={currentQIndexInSubtest === 0}
                            onClick={() => setCurrentQIndexInSubtest((i) => Math.max(0, i - 1))}
                            className="px-4 sm:px-5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-200 transition cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" /> Sebelumnya
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleDoubtful}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${doubtfuls[currentQKey]
                                ? "bg-amber-400 border-amber-500 text-slate-950"
                                : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                                }`}
                        >
                            <Bookmark className="w-4 h-4" /> Ragu-ragu
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
                            className="px-5 sm:px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-700/20 transition cursor-pointer"
                        >
                            {currentQIndexInSubtest < currentSubtestQuestions.length - 1 ? (
                                <>
                                    Berikutnya <ChevronRight className="w-4 h-4" />
                                </>
                            ) : (
                                <>
                                    Selesai {activeSubtest.code} <CheckCircle2 className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs lg:sticky lg:top-24">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-400 font-mono uppercase tracking-wider">
                            PALET SOAL {activeSubtest.code}
                        </span>
                        <span className="text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 font-mono">
                            {
                                currentSubtestQuestions.filter((q: any, idx: number) => {
                                    const key = q.id ? String(q.id) : `${activeSubtest.code}_${idx}`;
                                    const ans = answers[key];
                                    if (ans === undefined) return false;
                                    if (Array.isArray(ans)) return ans.length > 0;
                                    if (typeof ans === "object") return Object.keys(ans).length > 0;
                                    return true;
                                }).length
                            }
                            /{currentSubtestQuestions.length} Terisi
                        </span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                        {currentSubtestQuestions.map((q: any, idx: number) => {
                            const key = q.id ? String(q.id) : `${activeSubtest.code}_${idx}`;
                            const isCurrent = currentQIndexInSubtest === idx;
                            const ans = answers[key];
                            let isAnswered = false;
                            if (ans !== undefined) {
                                if (Array.isArray(ans)) isAnswered = ans.length > 0;
                                else if (typeof ans === "object") isAnswered = Object.keys(ans).length > 0;
                                else isAnswered = true;
                            }
                            const isDoubt = Boolean(doubtfuls[key]);

                            let btnClass = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50";
                            if (isAnswered) btnClass = "bg-blue-700 text-white font-black border-blue-700 shadow-2xs";
                            if (isDoubt) btnClass = "bg-amber-400 text-slate-900 font-black border-amber-400";

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCurrentQIndexInSubtest(idx)}
                                    className={`h-10 sm:h-11 rounded-xl border text-xs font-mono font-bold flex items-center justify-center transition cursor-pointer ${btnClass} ${isCurrent ? "ring-2 ring-slate-900 ring-offset-2" : ""
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-4 border-t border-slate-100 text-[11px] space-y-2 text-slate-500">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-blue-700" /> <span>Terjawab</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-amber-400" /> <span>Ragu-ragu</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-white border border-slate-300" /> <span>Belum Dijawab</span>
                        </div>
                    </div>
                </div>
            </main>

            {showSubtestConfirmModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto">
                            <FastForward className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-base text-slate-900">
                            {currentSubtestIndex === TKA_SMP_SUBJECTS.length - 1
                                ? "Kumpulkan Seluruh Lembar Ujian?"
                                : "Selesaikan Bahasa Indonesia & Masuk ke Jeda Matematika?"}
                        </h3>

                        {(() => {
                            const unAnsweredCount = currentSubtestQuestions.filter((q: any, idx: number) => {
                                const k = q.id ? String(q.id) : `${activeSubtest.code}_${idx}`;
                                const a = answers[k];
                                if (a === undefined || a === null) return true;
                                if (Array.isArray(a)) return a.length === 0;
                                if (typeof a === "object") return Object.keys(a).length === 0;
                                return false;
                            }).length;
                            const doubtCount = currentSubtestQuestions.filter((q: any, idx: number) => {
                                const k = q.id ? String(q.id) : `${activeSubtest.code}_${idx}`;
                                return Boolean(doubtfuls[k]);
                            }).length;

                            return (
                                <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
                                    {(unAnsweredCount > 0 || doubtCount > 0) && (
                                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-[11px]">
                                            Perhatian: Masih ada <strong>{doubtCount} soal Ragu-ragu</strong> dan{" "}
                                            <strong>{unAnsweredCount} soal Belum Dijawab</strong> (soal ragu-ragu yang sudah terisi tetap akan dinilai).
                                        </div>
                                    )}
                                    <p>
                                        {currentSubtestIndex === TKA_SMP_SUBJECTS.length - 1
                                            ? "Jawaban Anda akan dikunci dan dihitung menggunakan skala 0,00–100,00 sesuai Kepmendikdasmen No. 56 Tahun 2026."
                                            : "Setelah dikonfirmasi, jawaban Bahasa Indonesia akan dikunci dan Anda akan masuk ke layar jeda sebelum mengerjakan Matematika."}
                                    </p>
                                </div>
                            );
                        })()}

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowSubtestConfirmModal(false)}
                                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                                Cek Kembali
                            </button>
                            <button
                                type="button"
                                onClick={handleCompleteCurrentSubject}
                                disabled={isSubmittingScore}
                                className="w-1/2 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {isSubmittingScore ? "Menyimpan..." : "Ya, Lanjutkan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* POPUP PERINGATAN LEMBUT (TANPA BLOKIR UJIAN) */}
            {showViolationModal && !isSubmittingRef.current && (
                <div className="fixed inset-0 z-[999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 text-center shadow-2xl border border-amber-200 animate-in zoom-in-95">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                                PERINGATAN INTEGRITAS ({violationCount}x)
                            </span>
                            <h3 className="font-black text-lg text-slate-900">Mohon Tetap Fokus di Layar Ujian</h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            {lastWarningReason} Aktivitas ini telah dicatat oleh sistem pengawas, namun ujian Anda{" "}
                            <strong className="text-emerald-700">tidak diblokir</strong> dan dapat langsung dilanjutkan.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setShowViolationModal(false);
                                enterExamChamber();
                            }}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition"
                        >
                            Kembali & Lanjutkan Mengerjakan Ujian
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}