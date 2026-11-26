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
    BarChart3,
    Layers,
    Target,
    School,
    Award,
    Upload,
    CheckCircle2,
    XCircle,
    MinusCircle,
    FolderArchive,
    ListOrdered,
    FileSpreadsheet,
    FileText
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    generateSchoolReportsZip,
    downloadOfficialRankingPdf,
    exportRankingToExcelXlsx,
    ZipStudentPayload
} from "@/lib/exportSchoolZip";

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
    schoolRankOverall?: number;
    schoolRankBindo?: number;
    schoolRankMtk?: number;
    schoolTotalFinished?: number;
    parallelRankOverall?: number;
    parallelRankBindo?: number;
    parallelRankMtk?: number;
    parallelTotalFinished?: number;
}

export interface SchoolRankingItem {
    rank: number;
    school: string;
    totalRegistered: number;
    totalFinished: number;
    avgBindo: number;
    avgMtk: number;
    avgOverall: number;
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

// 6 Sumbu Heksagonal (3 Kompetensi BINDO + 3 Rumpun Elemen MTK)
const HEXAGON_AXES = [
    { key: "Pemahaman Tekstual", short: "Tekstual", subject: "BINDO", elements: ["Pemahaman Tekstual"] },
    { key: "Pemahaman Inferensial", short: "Inferensial", subject: "BINDO", elements: ["Pemahaman Inferensial"] },
    { key: "Evaluasi dan Apresiasi", short: "Evaluasi", subject: "BINDO", elements: ["Evaluasi dan Apresiasi"] },
    { key: "Bilangan", short: "Bilangan", subject: "MTK", elements: ["Bilangan"] },
    { key: "Aljabar", short: "Aljabar", subject: "MTK", elements: ["Aljabar"] },
    { key: "Geometri, Data & Peluang", short: "Geo & Data", subject: "MTK", elements: ["Geometri & Pengukuran", "Data & Peluang"] }
];

// Kategori Capaian Resmi TKA SMP/MTs Kemendikdasmen (Cut-Off Terpisah per Mata Uji)
function getOfficialTkaCategory(score: number, subject: "BINDO" | "MTK" = "BINDO") {
    const num = Number(score) || 0;
    const isMtk = subject === "MTK";
    const baikCutOff = isMtk ? 56.67 : 76.67;
    const memadaiCutOff = isMtk ? 33.33 : 50.0;

    if (num >= 95.0) {
        return {
            level: "Istimewa",
            badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
            barColor: "bg-indigo-600",
            note: "Predikat khusus dengan penguasaan materi dan kemampuan bernalar sangat tinggi."
        };
    }
    if (num >= baikCutOff) {
        return {
            level: "Baik",
            badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
            barColor: "bg-emerald-600",
            note: "Pemahaman kuat dan konsisten; mampu menyelesaikan soal rutin maupun nonrutin dengan strategi efektif."
        };
    }
    if (num >= memadaiCutOff) {
        return {
            level: "Memadai",
            badge: "bg-blue-50 text-blue-800 border-blue-200",
            barColor: "bg-blue-600",
            note: "Memenuhi standar minimum; paham konsep dasar dan mampu menerapkannya pada masalah kontekstual umum."
        };
    }
    return {
        level: "Kurang",
        badge: "bg-rose-50 text-rose-800 border-rose-200",
        barColor: "bg-rose-500",
        note: "Perlu penguatan kompetensi fundamental dan pendampingan belajar pada mata uji terkait."
    };
}

function formatScoreID(score: number): string {
    return (Number(score) || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function normalizePhoneDigits(raw: string): string {
    let digits = String(raw || "").replace(/\D/g, "").trim();
    if (digits.startsWith("62")) digits = "0" + digits.slice(2);
    return digits;
}

function normalizeSchoolName(raw: string): string {
    return String(raw || "SMP / MTs")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .replace(/\bTANGSEL\b/g, "TANGERANG SELATAN")
        .replace(/\bJAKSEL\b/g, "JAKARTA SELATAN")
        .replace(/\bJAKBAR\b/g, "JAKARTA BARAT")
        .replace(/\bJAKTIM\b/g, "JAKARTA TIMUR")
        .replace(/\bJAKPUS\b/g, "JAKARTA PUSAT")
        .replace(/\bJAKUT\b/g, "JAKARTA UTARA")
        .trim();
}

function formatMathTextPreview(raw: string): string {
    const supMap: Record<string, string> = {
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹",
        "-": "⁻",
        "+": "⁺"
    };
    return String(raw || "")
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)")
        .replace(/\\cdot/g, "×")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        .replace(/\\pm/g, "±")
        .replace(/\\leq/g, "≤")
        .replace(/\\geq/g, "≥")
        .replace(/\\neq/g, "≠")
        .replace(/\\pi/g, "π")
        .replace(/\\circ/g, "°")
        .replace(/\^\{([^}]+)\}/g, (_, exp) =>
            String(exp)
                .split("")
                .map((ch) => supMap[ch] || ch)
                .join("")
        )
        .replace(/\^([0-9])/g, (_, d) => supMap[d] || d)
        .replace(/\s+/g, " ")
        .trim();
}

function parseAnswersJson(raw: any): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return typeof raw === "object" ? raw : {};
}

function findMatchingResultRow(resultsList: any[], phone: string, name: string) {
    const cleanP = normalizePhoneDigits(phone);
    const cleanN = String(name || "").toUpperCase().trim();

    const exactMatch = resultsList.find(
        (r) =>
            cleanP &&
            normalizePhoneDigits(r.phone || "") === cleanP &&
            String(r.student_name || "").toUpperCase().trim() === cleanN
    );
    if (exactMatch) return exactMatch;

    const nameMatch = resultsList.find(
        (r) => cleanN && String(r.student_name || "").toUpperCase().trim() === cleanN
    );
    if (nameMatch) return nameMatch;

    return resultsList.find((r) => cleanP && normalizePhoneDigits(r.phone || "") === cleanP);
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

function resolveStudentAnswerForQuestion(
    q: any,
    idxInSubtest: number,
    globalIndex: number,
    studentAnswers: Record<string, any>
) {
    if (!studentAnswers || typeof studentAnswers !== "object") return undefined;
    const code = String(q.subtes_code || "").toUpperCase().includes("MTK") ? "MTK" : "BINDO";
    const noSoal = Number(q.no_soal) || idxInSubtest + 1;

    const candidateKeys = [
        String(q.id),
        `${code}_${noSoal}`,
        `${code}_${idxInSubtest + 1}`,
        `${code}_${idxInSubtest}`,
        String(globalIndex + 1),
        String(noSoal)
    ];

    for (const k of candidateKeys) {
        if (k && studentAnswers[k] !== undefined && studentAnswers[k] !== null) {
            return studentAnswers[k];
        }
    }
    return undefined;
}

function evaluateStudentItemDetail(q: any, userAns: any) {
    const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    const revMap = ["A", "B", "C", "D", "E"];
    const rawKey = String(q.kunci || "A").toUpperCase().trim();

    const rawType = String(q.type || "").toUpperCase().trim();
    const isKategori = rawType === "PGK_KATEGORI" || rawKey.includes("|");
    const isMcma = !isKategori && (rawType === "PGK_MCMA" || rawKey.includes(","));

    if (userAns === undefined || userAns === null) {
        return { fraction: 0, status: "KOSONG" as const, studentAnsLabel: "-", keyLabel: rawKey };
    }

    if (isMcma) {
        const correctArr: number[] =
            Array.isArray(q.multiAnswers) && q.multiAnswers.length > 0
                ? q.multiAnswers
                : rawKey
                    .split(",")
                    .map((k) => keyMap[k.trim()])
                    .filter((n) => n !== undefined);
        const userArr: number[] = Array.isArray(userAns) ? userAns : [];
        const matchCount = userArr.filter((val) => correctArr.includes(val)).length;
        const wrongCount = userArr.filter((val) => !correctArr.includes(val)).length;
        const frac = Math.max(0, (matchCount - wrongCount) / (correctArr.length || 1));
        const studentLabel = userArr.length > 0 ? userArr.map((i) => revMap[i] || i).join(", ") : "-";
        const status = frac >= 0.99 ? ("BENAR" as const) : frac > 0 ? ("PARSIAL" as const) : ("SALAH" as const);
        return { fraction: frac, status, studentAnsLabel: studentLabel, keyLabel: rawKey };
    }

    if (isKategori) {
        const optionsList: string[] =
            Array.isArray(q.options) && q.options.length > 0
                ? q.options.map((opt: any) => (typeof opt === "string" ? opt : String(opt?.text ?? "")))
                : [q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e].filter((v) => v && String(v).trim().length > 0);
        const catKeys = rawKey.split("|").map((k) => k.trim());
        const statementsList =
            Array.isArray(q.statements) && q.statements.length > 0
                ? q.statements
                : optionsList.map((stmtText, sIdx) => ({
                    id: `st_${sIdx}`,
                    statement: stmtText,
                    correctCategory: catKeys[sIdx] || "Benar"
                }));

        let correctCount = 0;
        const userLabels: string[] = [];
        statementsList.forEach((st: any, idx: number) => {
            const val =
                userAns?.[st.id] ??
                userAns?.[`st_${idx}`] ??
                (typeof userAns === "object" ? Object.values(userAns)[idx] : undefined);
            if (val) userLabels.push(String(val));
            if (String(val || "").toUpperCase().trim() === String(st.correctCategory || "").toUpperCase().trim()) {
                correctCount++;
            }
        });
        const frac = statementsList.length > 0 ? correctCount / statementsList.length : 0;
        const status = frac >= 0.99 ? ("BENAR" as const) : frac > 0 ? ("PARSIAL" as const) : ("SALAH" as const);
        return {
            fraction: frac,
            status,
            studentAnsLabel: userLabels.length > 0 ? userLabels.join(" | ") : "-",
            keyLabel: rawKey
        };
    }

    const targetIdx = typeof q.singleAnswer === "number" ? q.singleAnswer : (keyMap[rawKey] ?? 0);
    let isRight = false;
    let studentLabel = "-";
    if (typeof userAns === "number") {
        isRight = userAns === targetIdx;
        studentLabel = revMap[userAns] || String(userAns);
    } else if (typeof userAns === "string") {
        isRight = userAns.toUpperCase().trim() === rawKey;
        studentLabel = userAns.toUpperCase().trim();
    }
    return {
        fraction: isRight ? 1 : 0,
        status: isRight ? ("BENAR" as const) : ("SALAH" as const),
        studentAnsLabel: studentLabel,
        keyLabel: rawKey
    };
}

export default function AdminAnalyticsTkaSmpPage() {
    const [rawStudents, setRawStudents] = useState<TkaStudentResult[]>([]);
    const [questionsBank, setQuestionsBank] = useState<any[]>([]);
    const [rawResultsList, setRawResultsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"prospek" | "sekolah" | "materi" | "butir">("prospek");
    const [studentViewMode, setStudentViewMode] = useState<"grouped" | "parallel">("grouped");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSchool, setSelectedSchool] = useState("ALL");

    const [officials, setOfficials] = useState({
        kepalaSekolahNama: "Drs. H. Ahmad Dahlan, M.Pd.",
        kepalaSekolahNbm: "882.118.001",
        kepsekSignatureUrl: ""
    });

    const [selectedStudentForReport, setSelectedStudentForReport] = useState<TkaStudentResult | null>(null);

    const [isBusyExport, setIsBusyExport] = useState(false);
    const [busyScopeKey, setBusyScopeKey] = useState<string>("");
    const [busyStatusText, setBusyStatusText] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const savedOfficials = localStorage.getItem("tka_officials_config");
                if (savedOfficials) {
                    setOfficials((prev) => ({ ...prev, ...JSON.parse(savedOfficials) }));
                }
            } catch { }
        }
    }, []);

    const updateOfficialsField = (patch: Partial<typeof officials>) => {
        setOfficials((prev) => {
            const next = { ...prev, ...patch };
            try {
                localStorage.setItem("tka_officials_config", JSON.stringify(next));
            } catch { }
            return next;
        });
    };

    const handleSignatureUpload = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                updateOfficialsField({ kepsekSignatureUrl: reader.result });
            }
        };
        reader.readAsDataURL(file);
    };

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
                supabase.from("tka_results").select("*").order("submitted_at", { ascending: false })
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
                        phone: normalizePhoneDigits(item.phone || ""),
                        name: String(item.name || "PESERTA SIMULASI").toUpperCase().trim(),
                        school: normalizeSchoolName(item.school || "SMP / MTs"),
                        grade: String(item.grade || "9").trim(),
                        status: String(item.status || (cleanScore > 0 ? "Selesai" : "Terdaftar")).trim(),
                        violations: Number(item.violations || 0),
                        score: cleanScore,
                        bindoScore: bindoVal,
                        mtkScore: mtkVal,
                        waktu_selesai: item.waktu_selesai || ""
                    };
                });
                setRawStudents(normalized);
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
                if (user.role !== "admin" && user.role !== "guru") {
                    alert("Akses ditolak! Halaman ini khusus Administrator & Guru.");
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

    const { questionWeightsMap, itemAnalysisList, elementAnalysisList } = useMemo(() => {
        const bindoQs = questionsBank.filter((q) => !String(q.subtes_code || "").toUpperCase().includes("MTK"));
        const mtkQs = questionsBank.filter((q) => String(q.subtes_code || "").toUpperCase().includes("MTK"));

        const weightsMap: Record<string, number> = {};

        const computeForList = (qList: any[], subCode: "BINDO" | "MTK", globalOffset: number) =>
            qList.map((q: any, idx: number) => {
                const qId = String(q.id);
                const element = mapQuestionToOfficialElement(subCode, q.materi);
                const rawKey = String(q.kunci || "A").toUpperCase().trim();

                let totalAttempt = 0;
                let correctCount = 0;
                const optionCounts = [0, 0, 0, 0, 0];

                rawResultsList.forEach((res) => {
                    const ansMap = parseAnswersJson(res.answers);
                    const userAns = resolveStudentAnswerForQuestion(q, idx, globalOffset + idx, ansMap);
                    if (userAns !== undefined && userAns !== null) {
                        totalAttempt++;
                        if (typeof userAns === "number" && userAns >= 0 && userAns <= 4) {
                            optionCounts[userAns]++;
                        } else if (Array.isArray(userAns)) {
                            userAns.forEach((optI: number) => {
                                if (optI >= 0 && optI <= 4) optionCounts[optI]++;
                            });
                        }
                        const evalRes = evaluateStudentItemDetail(q, userAns);
                        if (evalRes.fraction >= 0.99) correctCount++;
                    }
                });

                const pRatio = totalAttempt > 0 ? correctCount / totalAttempt : 0.5;
                const pIndex = totalAttempt > 0 ? Number((pRatio * 100).toFixed(2)) : 0;

                const baseDiff = Number(q.difficulty) > 1 ? Number(q.difficulty) : 1 + (1 - pRatio) * 0.85;
                const finalWeight = Number(baseDiff.toFixed(4));
                weightsMap[qId] = finalWeight;

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
                    idxInSubtest: idx,
                    globalIndex: globalOffset + idx,
                    subtes_code: subCode,
                    element,
                    pertanyaan: formatMathTextPreview(String(q.pertanyaan || "")),
                    kunci: rawKey,
                    totalAttempt,
                    correctCount,
                    pIndex,
                    weight: finalWeight,
                    difficultyLabel,
                    difficultyBadge,
                    optionCounts,
                    rawQuestion: q
                };
            });

        const allItems = [
            ...computeForList(bindoQs, "BINDO", 0),
            ...computeForList(mtkQs, "MTK", bindoQs.length)
        ];

        const scopedItems = allItems.map((it) => {
            if (selectedSchool === "ALL") return it;
            const scopedResults = rawResultsList.filter(
                (r) => normalizeSchoolName(r.school || "") === selectedSchool
            );
            let att = 0;
            let corr = 0;
            const opts = [0, 0, 0, 0, 0];
            scopedResults.forEach((res) => {
                const ansMap = parseAnswersJson(res.answers);
                const uAns = resolveStudentAnswerForQuestion(
                    it.rawQuestion,
                    it.idxInSubtest,
                    it.globalIndex,
                    ansMap
                );
                if (uAns !== undefined && uAns !== null) {
                    att++;
                    if (typeof uAns === "number" && uAns >= 0 && uAns <= 4) opts[uAns]++;
                    if (evaluateStudentItemDetail(it.rawQuestion, uAns).fraction >= 0.99) corr++;
                }
            });
            const pIdx = att > 0 ? Number(((corr / att) * 100).toFixed(2)) : 0;
            return { ...it, totalAttempt: att, correctCount: corr, pIndex: pIdx, optionCounts: opts };
        });

        const elements = OFFICIAL_COMPETENCIES.map((comp) => {
            const matchedItems = scopedItems.filter((it) => it.element === comp.code && it.totalAttempt > 0);
            const totalAnswers = matchedItems.reduce((sum, it) => sum + it.totalAttempt, 0);
            const totalCorrects = matchedItems.reduce((sum, it) => sum + it.correctCount, 0);
            const masteryPct = totalAnswers > 0 ? Number(((totalCorrects / totalAnswers) * 100).toFixed(2)) : 0;
            const cat = getOfficialTkaCategory(masteryPct, comp.subject === "MTK" ? "MTK" : "BINDO");

            return {
                ...comp,
                questionCount: scopedItems.filter((it) => it.element === comp.code).length,
                testedQuestionCount: matchedItems.length,
                masteryPct,
                category: totalAnswers > 0 ? cat.level : "Belum Ada Data",
                badge: totalAnswers > 0 ? cat.badge : "bg-slate-100 text-slate-500 border-slate-200",
                barColor: totalAnswers > 0 ? cat.barColor : "bg-slate-300"
            };
        });

        return { questionWeightsMap: weightsMap, itemAnalysisList: scopedItems, elementAnalysisList: elements };
    }, [questionsBank, rawResultsList, selectedSchool]);

    const students = useMemo<TkaStudentResult[]>(() => {
        const bindoQs = questionsBank.filter((q) => !String(q.subtes_code || "").toUpperCase().includes("MTK"));
        const mtkQs = questionsBank.filter((q) => String(q.subtes_code || "").toUpperCase().includes("MTK"));

        return rawStudents.map((stu) => {
            const matchedRes = findMatchingResultRow(rawResultsList, stu.phone, stu.name);
            const ansObj = parseAnswersJson(matchedRes?.answers);
            const hasAnswers = Object.keys(ansObj).length > 0 && questionsBank.length > 0;

            if (!hasAnswers) {
                return stu;
            }

            let bindoEarned = 0,
                bindoTotalW = 0;
            bindoQs.forEach((q, idx) => {
                const w = questionWeightsMap[String(q.id)] || 1;
                const uAns = resolveStudentAnswerForQuestion(q, idx, idx, ansObj);
                const frac = evaluateStudentItemDetail(q, uAns).fraction;
                bindoEarned += frac * w;
                bindoTotalW += w;
            });

            let mtkEarned = 0,
                mtkTotalW = 0;
            mtkQs.forEach((q, idx) => {
                const w = questionWeightsMap[String(q.id)] || 1;
                const uAns = resolveStudentAnswerForQuestion(q, idx, bindoQs.length + idx, ansObj);
                const frac = evaluateStudentItemDetail(q, uAns).fraction;
                mtkEarned += frac * w;
                mtkTotalW += w;
            });

            const calcBindo = bindoTotalW > 0 ? Number(((bindoEarned / bindoTotalW) * 100).toFixed(2)) : stu.bindoScore;
            const calcMtk = mtkTotalW > 0 ? Number(((mtkEarned / mtkTotalW) * 100).toFixed(2)) : stu.mtkScore;
            const calcOverall = Number(((calcBindo + calcMtk) / 2).toFixed(2));

            return {
                ...stu,
                bindoScore: calcBindo,
                mtkScore: calcMtk,
                score: calcOverall
            };
        });
    }, [rawStudents, rawResultsList, questionsBank, questionWeightsMap]);

    const rankedStudentsWithSchoolPos = useMemo(() => {
        const allFinishedPool = students.filter(
            (st) => st.status.toLowerCase().includes("selesai") || st.score > 0
        );
        const activeParallelPool = allFinishedPool.length > 0 ? allFinishedPool : students;

        const parallelSortedOverall = [...activeParallelPool].sort((a, b) => b.score - a.score);
        const parallelSortedBindo = [...activeParallelPool].sort((a, b) => b.bindoScore - a.bindoScore);
        const parallelSortedMtk = [...activeParallelPool].sort((a, b) => b.mtkScore - a.mtkScore);

        const bySchool: Record<string, TkaStudentResult[]> = {};
        students.forEach((s) => {
            const sch = s.school || "SMP / MTs";
            if (!bySchool[sch]) bySchool[sch] = [];
            bySchool[sch].push(s);
        });

        const schoolRankLookup: Record<
            string,
            { rankOverall: number; rankBindo: number; rankMtk: number; schoolTotal: number }
        > = {};

        Object.values(bySchool).forEach((group) => {
            const finishedGroup = group.filter(
                (st) => st.status.toLowerCase().includes("selesai") || st.score > 0
            );
            const activePool = finishedGroup.length > 0 ? finishedGroup : group;

            const sortedOverall = [...activePool].sort((a, b) => b.score - a.score);
            const sortedBindo = [...activePool].sort((a, b) => b.bindoScore - a.bindoScore);
            const sortedMtk = [...activePool].sort((a, b) => b.mtkScore - a.mtkScore);

            group.forEach((st) => {
                const key = `${st.phone}_${st.name}`;
                const idxOverall = sortedOverall.findIndex((x) => x.phone === st.phone && x.name === st.name);
                const idxBindo = sortedBindo.findIndex((x) => x.phone === st.phone && x.name === st.name);
                const idxMtk = sortedMtk.findIndex((x) => x.phone === st.phone && x.name === st.name);

                schoolRankLookup[key] = {
                    rankOverall: idxOverall >= 0 ? idxOverall + 1 : activePool.length,
                    rankBindo: idxBindo >= 0 ? idxBindo + 1 : activePool.length,
                    rankMtk: idxMtk >= 0 ? idxMtk + 1 : activePool.length,
                    schoolTotal: activePool.length
                };
            });
        });

        return [...students]
            .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
            .map((s) => {
                const key = `${s.phone}_${s.name}`;
                const pOverall = parallelSortedOverall.findIndex((x) => x.phone === s.phone && x.name === s.name);
                const pBindo = parallelSortedBindo.findIndex((x) => x.phone === s.phone && x.name === s.name);
                const pMtk = parallelSortedMtk.findIndex((x) => x.phone === s.phone && x.name === s.name);

                return {
                    ...s,
                    schoolRankOverall: schoolRankLookup[key]?.rankOverall ?? 1,
                    schoolRankBindo: schoolRankLookup[key]?.rankBindo ?? 1,
                    schoolRankMtk: schoolRankLookup[key]?.rankMtk ?? 1,
                    schoolTotalFinished: schoolRankLookup[key]?.schoolTotal ?? 1,
                    parallelRankOverall: pOverall >= 0 ? pOverall + 1 : activeParallelPool.length,
                    parallelRankBindo: pBindo >= 0 ? pBindo + 1 : activeParallelPool.length,
                    parallelRankMtk: pMtk >= 0 ? pMtk + 1 : activeParallelPool.length,
                    parallelTotalFinished: activeParallelPool.length
                };
            });
    }, [students]);

    const schoolRankings = useMemo<SchoolRankingItem[]>(() => {
        const mapSchools: Record<
            string,
            {
                school: string;
                totalRegistered: number;
                finishedList: TkaStudentResult[];
            }
        > = {};

        students.forEach((s) => {
            const sch = s.school || "SMP / MTs";
            if (!mapSchools[sch]) {
                mapSchools[sch] = { school: sch, totalRegistered: 0, finishedList: [] };
            }
            mapSchools[sch].totalRegistered += 1;
            if (s.status.toLowerCase().includes("selesai") || s.score > 0) {
                mapSchools[sch].finishedList.push(s);
            }
        });

        const list = Object.values(mapSchools).map((item) => {
            const count = item.finishedList.length;
            const avgBindo =
                count > 0
                    ? Number((item.finishedList.reduce((acc, c) => acc + c.bindoScore, 0) / count).toFixed(2))
                    : 0;
            const avgMtk =
                count > 0
                    ? Number((item.finishedList.reduce((acc, c) => acc + c.mtkScore, 0) / count).toFixed(2))
                    : 0;
            const avgOverall =
                count > 0
                    ? Number((item.finishedList.reduce((acc, c) => acc + c.score, 0) / count).toFixed(2))
                    : 0;

            return {
                rank: 0,
                school: item.school,
                totalRegistered: item.totalRegistered,
                totalFinished: count,
                avgBindo,
                avgMtk,
                avgOverall
            };
        });

        return list
            .sort((a, b) => {
                if (b.avgOverall !== a.avgOverall) return b.avgOverall - a.avgOverall;
                return b.totalFinished - a.totalFinished;
            })
            .map((item, idx) => ({ ...item, rank: idx + 1 }));
    }, [students]);

    const availableSchools = useMemo(() => {
        const setSch = new Set<string>();
        students.forEach((s) => {
            if (s.school && s.school.trim()) setSch.add(s.school.trim());
        });
        return Array.from(setSch).sort();
    }, [students]);

    const filteredStudents = useMemo(() => {
        return rankedStudentsWithSchoolPos.filter((s) => {
            const matchSchool = selectedSchool === "ALL" || s.school === selectedSchool;
            const q = searchQuery.toLowerCase();
            const matchSearch =
                s.name.toLowerCase().includes(q) ||
                s.school.toLowerCase().includes(q) ||
                s.phone.includes(searchQuery);
            return matchSchool && matchSearch;
        });
    }, [rankedStudentsWithSchoolPos, selectedSchool, searchQuery]);

    const groupedBySchoolList = useMemo(() => {
        const groupsMap: Record<string, TkaStudentResult[]> = {};
        filteredStudents.forEach((s) => {
            const sch = s.school || "SMP / MTs";
            if (!groupsMap[sch]) groupsMap[sch] = [];
            groupsMap[sch].push(s);
        });

        return Object.entries(groupsMap)
            .map(([schoolName, members]) => {
                const sortedMembers = [...members].sort((a, b) => b.score - a.score);
                const finishedMembers = sortedMembers.filter(
                    (m) => m.status.toLowerCase().includes("selesai") || m.score > 0
                );
                const avgSchool =
                    finishedMembers.length > 0
                        ? Number(
                            (
                                finishedMembers.reduce((sum, m) => sum + m.score, 0) /
                                finishedMembers.length
                            ).toFixed(2)
                        )
                        : 0;
                return {
                    school: schoolName,
                    members: sortedMembers,
                    finishedCount: finishedMembers.length,
                    avgSchool
                };
            })
            .sort((a, b) => b.avgSchool - a.avgSchool);
    }, [filteredStudents]);

    const overallStats = useMemo(() => {
        const scopeStudents =
            selectedSchool === "ALL" ? students : students.filter((s) => s.school === selectedSchool);
        const finished = scopeStudents.filter((s) => s.status.toLowerCase().includes("selesai") || s.score > 0);
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

        return {
            totalProspek,
            totalSelesai,
            avgScore,
            avgBindo,
            avgMtk,
            integritasRate
        };
    }, [students, selectedSchool]);

    const buildExportPayloads = (targetStudents: TkaStudentResult[]): ZipStudentPayload[] => {
        const bindoQs = questionsBank.filter((q) => !String(q.subtes_code || "").toUpperCase().includes("MTK"));
        const mtkQs = questionsBank.filter((q) => String(q.subtes_code || "").toUpperCase().includes("MTK"));

        const schoolAvgLookup: Record<string, { b: number; m: number; o: number }> = {};
        schoolRankings.forEach((sr) => {
            schoolAvgLookup[sr.school] = {
                b: sr.avgBindo,
                m: sr.avgMtk,
                o: sr.avgOverall
            };
        });

        return targetStudents.map((stu) => {
            const matchedResult = findMatchingResultRow(rawResultsList, stu.phone, stu.name);
            const studentAnswers = parseAnswersJson(matchedResult?.answers);
            const hasAnswerData = Object.keys(studentAnswers).length > 0 && questionsBank.length > 0;

            const schAvgs = schoolAvgLookup[stu.school] || {
                b: stu.bindoScore,
                m: stu.mtkScore,
                o: stu.score
            };

            const buildItems = (qList: any[], subCode: "BINDO" | "MTK", globalOffset: number) =>
                qList.map((q, idx) => {
                    const uAns = resolveStudentAnswerForQuestion(q, idx, globalOffset + idx, studentAnswers);
                    const detail = evaluateStudentItemDetail(q, uAns);
                    return {
                        no_soal: Number(q.no_soal) || idx + 1,
                        subtes_code: subCode,
                        element: mapQuestionToOfficialElement(subCode, q.materi),
                        weight: questionWeightsMap[String(q.id)] || 1,
                        ...detail
                    };
                });

            const itemRows = [
                ...buildItems(bindoQs, "BINDO", 0),
                ...buildItems(mtkQs, "MTK", bindoQs.length)
            ];

            const sevenCompetencies = OFFICIAL_COMPETENCIES.map((comp) => {
                const compItems = itemRows.filter((it) => it.element === comp.code);
                let earnedW = 0,
                    totalW = 0,
                    rawCorrect = 0;
                compItems.forEach((it) => {
                    earnedW += it.fraction * it.weight;
                    totalW += it.weight;
                    if (it.fraction >= 0.99) rawCorrect++;
                });
                const pct = hasAnswerData && totalW > 0 ? Number(((earnedW / totalW) * 100).toFixed(2)) : 0;
                const cat = getOfficialTkaCategory(pct, comp.subject === "MTK" ? "MTK" : "BINDO");
                return {
                    code: comp.code,
                    subject: comp.subject,
                    rawCorrect,
                    totalQ: compItems.length,
                    earnedW,
                    totalW,
                    pct,
                    category: cat.level
                };
            });

            // Sumbu heksagonal dihitung dari total bobot tercapai / total bobot sumbu agar 100% sinkron dengan Rapor Siswa
            const hexagonPoints = HEXAGON_AXES.map((ax) => {
                const matched = sevenCompetencies.filter((c) => ax.elements.includes(c.code));
                const earnedSum = matched.reduce((s, c) => s + c.earnedW, 0);
                const totalWeightSum = matched.reduce((s, c) => s + c.totalW, 0);
                const studentPct =
                    hasAnswerData && totalWeightSum > 0 ? Number(((earnedSum / totalWeightSum) * 100).toFixed(2)) : 0;
                return {
                    key: ax.key,
                    short: ax.short,
                    studentPct,
                    schoolPct: ax.subject === "MTK" ? schAvgs.m : schAvgs.b
                };
            });

            const sortedHex = [...hexagonPoints].sort((a, b) => b.studentPct - a.studentPct);
            const bindoCat = getOfficialTkaCategory(stu.bindoScore, "BINDO");
            const mtkCat = getOfficialTkaCategory(stu.mtkScore, "MTK");

            return {
                rankParallelOverall: stu.parallelRankOverall || 1,
                rankParallelBindo: stu.parallelRankBindo || 1,
                rankParallelMtk: stu.parallelRankMtk || 1,
                totalParallelFinished: stu.parallelTotalFinished || targetStudents.length,
                rankInSchool: stu.schoolRankOverall || 1,
                totalInSchool: stu.schoolTotalFinished || 1,
                rankBindo: stu.schoolRankBindo || 1,
                rankMtk: stu.schoolRankMtk || 1,
                phone: stu.phone,
                name: stu.name,
                school: stu.school,
                grade: stu.grade,
                bindoScore: stu.bindoScore,
                mtkScore: stu.mtkScore,
                overallScore: stu.score,
                bindoCategory: bindoCat.level,
                mtkCategory: mtkCat.level,
                schoolAvgBindo: schAvgs.b,
                schoolAvgMtk: schAvgs.m,
                schoolAvgOverall: schAvgs.o,
                hexagonPoints,
                strongestAxis: `${sortedHex[0]?.key} (${formatScoreID(sortedHex[0]?.studentPct || 0)})`,
                weakestAxis: `${sortedHex[sortedHex.length - 1]?.key} (${formatScoreID(sortedHex[sortedHex.length - 1]?.studentPct || 0)})`,
                sevenCompetencies: sevenCompetencies.map(({ earnedW: _e, totalW: _t, ...rest }) => rest),
                itemRows: itemRows.map(({ weight: _w, ...rest }) => rest)
            };
        });
    };

    const handleExportExcelXlsx = (schoolScope?: string) => {
        const pool = schoolScope
            ? rankedStudentsWithSchoolPos.filter((s) => s.school === schoolScope)
            : filteredStudents;

        if (pool.length === 0) return;
        const payloads = buildExportPayloads(pool);
        if (schoolScope) {
            exportRankingToExcelXlsx("SCHOOL", schoolScope, payloads);
        } else {
            exportRankingToExcelXlsx(
                selectedSchool !== "ALL" ? "SCHOOL" : "PARALLEL",
                selectedSchool !== "ALL" ? selectedSchool : "Semua_Sekolah",
                payloads
            );
        }
    };

    const handleDownloadRankingTablePdf = async (mode: "PARALLEL" | "SCHOOL", schoolName?: string) => {
        const pool =
            mode === "SCHOOL" && schoolName
                ? rankedStudentsWithSchoolPos.filter((s) => s.school === schoolName)
                : filteredStudents;

        const finishedPool = pool.filter(
            (s) => s.status.toLowerCase().includes("selesai") || s.score > 0
        );
        const finalPool = finishedPool.length > 0 ? finishedPool : pool;

        if (finalPool.length === 0) {
            alert("Belum ada data peserta untuk dicetak.");
            return;
        }

        const key = mode === "SCHOOL" ? `PDF_SCH_${schoolName}` : "PDF_PARALLEL";
        setIsBusyExport(true);
        setBusyScopeKey(key);
        setBusyStatusText("Menyusun PDF Tabel...");

        try {
            const payloads = buildExportPayloads(finalPool);
            await downloadOfficialRankingPdf(
                mode,
                mode === "SCHOOL" && schoolName ? schoolName : "Semua Sekolah Mitra",
                payloads,
                officials
            );
        } catch (err: any) {
            alert("Gagal membuat PDF Rekap Tabel Peringkat: " + (err?.message || "Kesalahan browser"));
        } finally {
            setIsBusyExport(false);
            setBusyScopeKey("");
            setBusyStatusText("");
        }
    };

    const handleDownloadZipReports = async (targetSchoolName: string | "ALL_SCHOOLS") => {
        const pool =
            targetSchoolName === "ALL_SCHOOLS"
                ? rankedStudentsWithSchoolPos
                : rankedStudentsWithSchoolPos.filter((s) => s.school === targetSchoolName);

        const finishedPool = pool.filter(
            (s) => s.status.toLowerCase().includes("selesai") || s.score > 0
        );

        if (finishedPool.length === 0) {
            alert(
                targetSchoolName === "ALL_SCHOOLS"
                    ? "Belum ada peserta yang menyelesaikan ujian."
                    : `Belum ada peserta dari ${targetSchoolName} yang menyelesaikan ujian.`
            );
            return;
        }

        const key = targetSchoolName === "ALL_SCHOOLS" ? "ZIP_ALL" : `ZIP_${targetSchoolName}`;
        setIsBusyExport(true);
        setBusyScopeKey(key);
        setBusyStatusText(`Menyiapkan 0/${finishedPool.length}...`);

        try {
            const payloads = buildExportPayloads(finishedPool);
            const scopeLabel = targetSchoolName === "ALL_SCHOOLS" ? "Semua_Sekolah_Mitra" : targetSchoolName;
            await generateSchoolReportsZip(
                scopeLabel,
                payloads,
                officials,
                (curr, tot, sName) => {
                    setBusyStatusText(`Memproses ${curr}/${tot}: ${sName}...`);
                },
                targetSchoolName === "ALL_SCHOOLS"
            );
        } catch (err: any) {
            alert("Gagal membuat paket .ZIP rapor: " + (err?.message || "Kesalahan browser"));
        } finally {
            setIsBusyExport(false);
            setBusyScopeKey("");
            setBusyStatusText("");
        }
    };

    const selectedStudentDiagnostic = useMemo(() => {
        if (!selectedStudentForReport) return null;
        const stu = selectedStudentForReport;

        const matchedResult = findMatchingResultRow(rawResultsList, stu.phone, stu.name);
        const studentAnswers = parseAnswersJson(matchedResult?.answers);
        const hasAnswerData = Object.keys(studentAnswers).length > 0 && questionsBank.length > 0;

        const bindoQs = questionsBank.filter((q) => !String(q.subtes_code || "").toUpperCase().includes("MTK"));
        const mtkQs = questionsBank.filter((q) => String(q.subtes_code || "").toUpperCase().includes("MTK"));

        const buildStudentItems = (qList: any[], subCode: "BINDO" | "MTK", globalOffset: number) =>
            qList.map((q, idx) => {
                const uAns = resolveStudentAnswerForQuestion(q, idx, globalOffset + idx, studentAnswers);
                const detail = evaluateStudentItemDetail(q, uAns);
                const element = mapQuestionToOfficialElement(subCode, q.materi);
                const weight = questionWeightsMap[String(q.id)] || 1;
                return {
                    id: String(q.id),
                    no_soal: Number(q.no_soal) || idx + 1,
                    subtes_code: subCode,
                    element,
                    pertanyaan: String(q.pertanyaan || ""),
                    weight,
                    ...detail
                };
            });

        const studentItemRows = [
            ...buildStudentItems(bindoQs, "BINDO", 0),
            ...buildStudentItems(mtkQs, "MTK", bindoQs.length)
        ];

        const sevenCompetencyStats = OFFICIAL_COMPETENCIES.map((comp) => {
            const compItems = studentItemRows.filter((it) => it.element === comp.code);
            const totalQ = compItems.length;
            let earnedWeighted = 0;
            let totalWeighted = 0;
            let rawCorrect = 0;

            compItems.forEach((it) => {
                earnedWeighted += it.fraction * it.weight;
                totalWeighted += it.weight;
                if (it.fraction >= 0.99) rawCorrect++;
            });

            const pct =
                hasAnswerData && totalWeighted > 0
                    ? Number(((earnedWeighted / totalWeighted) * 100).toFixed(2))
                    : 0;

            return {
                ...comp,
                totalQ,
                rawCorrect,
                earnedWeighted,
                totalWeighted,
                pct
            };
        });

        const schoolGroup = students.filter(
            (s) => s.school === stu.school && (s.status.toLowerCase().includes("selesai") || s.score > 0)
        );
        const schoolAvgBindo =
            schoolGroup.length > 0
                ? Number((schoolGroup.reduce((a, b) => a + b.bindoScore, 0) / schoolGroup.length).toFixed(2))
                : stu.bindoScore;
        const schoolAvgMtk =
            schoolGroup.length > 0
                ? Number((schoolGroup.reduce((a, b) => a + b.mtkScore, 0) / schoolGroup.length).toFixed(2))
                : stu.mtkScore;
        const schoolAvgOverall =
            schoolGroup.length > 0
                ? Number((schoolGroup.reduce((a, b) => a + b.score, 0) / schoolGroup.length).toFixed(2))
                : stu.score;

        const hexagonPoints = HEXAGON_AXES.map((axis) => {
            const matchedComps = sevenCompetencyStats.filter((c) => axis.elements.includes(c.code));
            const totalQ = matchedComps.reduce((s, c) => s + c.totalQ, 0);
            const earnedSum = matchedComps.reduce((s, c) => s + c.earnedWeighted, 0);
            const totalWeight = matchedComps.reduce((s, c) => s + c.totalWeighted, 0);
            const studentPct =
                hasAnswerData && totalWeight > 0 ? Number(((earnedSum / totalWeight) * 100).toFixed(2)) : 0;
            const schoolPct = axis.subject === "MTK" ? schoolAvgMtk : schoolAvgBindo;

            return {
                ...axis,
                totalQ,
                studentPct,
                schoolPct
            };
        });

        const sortedHex = [...hexagonPoints].sort((a, b) => b.studentPct - a.studentPct);

        return {
            hasAnswerData,
            studentItemRows,
            sevenCompetencyStats,
            hexagonPoints,
            strongestAxis: sortedHex[0],
            weakestAxis: sortedHex[sortedHex.length - 1],
            schoolAvgBindo,
            schoolAvgMtk,
            schoolAvgOverall,
            schoolFinishedCount: schoolGroup.length
        };
    }, [selectedStudentForReport, rawResultsList, questionsBank, questionWeightsMap, students]);

    const handleExportExcelSchools = () => {
        if (schoolRankings.length === 0) return;
        import("xlsx").then((XLSX) => {
            const rows = schoolRankings.map((sch) => ({
                "Peringkat Sekolah": sch.rank,
                "Nama Sekolah (SMP/MTs)": sch.school,
                "Peserta Selesai": sch.totalFinished,
                "Total Terdaftar": sch.totalRegistered,
                "Rerata Bahasa Indonesia": Number(sch.avgBindo.toFixed(2)),
                "Rerata Matematika": Number(sch.avgMtk.toFixed(2)),
                "Rerata Gabungan Sekolah": Number(sch.avgOverall.toFixed(2))
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            ws["!cols"] = [
                { wch: 18 },
                { wch: 34 },
                { wch: 16 },
                { wch: 16 },
                { wch: 24 },
                { wch: 20 },
                { wch: 24 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Klasemen Sekolah");
            XLSX.writeFile(wb, `Peringkat_Antar_Sekolah_TKA_SMP_${new Date().toISOString().slice(0, 10)}.xlsx`);
        });
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 overflow-x-hidden">
            <style
                dangerouslySetInnerHTML={{
                    __html: `
            @page {
              size: A4 portrait;
              margin: 8mm 12mm 8mm 12mm;
            }
            @media print {
              html, body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                color: #000000 !important;
                font-family: Arial, Helvetica, sans-serif !important;
                font-size: 9pt !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-hidden {
                display: none !important;
              }
              .print-modal-wrapper {
                position: static !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                overflow: visible !important;
              }
              .print-modal-card {
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
              }
              .print-sheet {
                background: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
              }
              .print-page-one {
                space-y: 0 !important;
              }
              .print-diag-grid {
                display: grid !important;
                grid-template-columns: 5fr 7fr !important;
                gap: 8px !important;
                padding: 8px !important;
              }
              .print-compact-bars {
                gap: 4px !important;
              }
              .page-break-before {
                page-break-before: always !important;
                break-before: page !important;
              }
              .kop-divider-thick {
                border-bottom: 2.5px solid #000000 !important;
                margin-top: 5px !important;
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
                                DASHBOARD RAPOR, DIAGNOSTIK & PERINGKAT TKA SMP
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                Skala 0,00-100,00 Berbobot Kesulitan Soal • SMA Muhammadiyah 18 Jakarta
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

            <div className="max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 text-left print:p-0 print:max-w-none">
                {/* FILTER SEKOLAH ASAL SMP GLOBAL */}
                <div className="print-hidden bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-black text-slate-900">Filter Cakupan Analisis Sekolah Asal (SMP/MTs Mitra)</div>
                        <div className="text-[11px] text-slate-500">
                            Pilih sekolah asal tertentu atau lihat seluruh peserta lintas sekolah sekaligus.
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
                            Kategori: <strong>{getOfficialTkaCategory(overallStats.avgBindo, "BINDO").level}</strong>
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
                            Kategori: <strong>{getOfficialTkaCategory(overallStats.avgMtk, "MTK").level}</strong>
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
                            Dari {schoolRankings.length} Sekolah SMP/MTs
                        </div>
                    </div>

                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-500 text-[10.5px] sm:text-xs font-bold font-mono">
                            <span>INTEGRITAS LAYAR</span>
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 font-mono">
                            {overallStats.integritasRate}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                            Kepatuhan Fokus Ujian
                        </div>
                    </div>
                </div>

                {/* BAR NAVIGASI 4 TAB */}
                <div className="print-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300">
                    <button
                        type="button"
                        onClick={() => setActiveTab("prospek")}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "prospek" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>1. Rapor & Peringkat Siswa</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("sekolah")}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "sekolah" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <School className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>2. Peringkat Antar-Sekolah ({schoolRankings.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("materi")}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "materi" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>3. Rekap 7 Elemen Materi</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("butir")}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "butir" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>4. Rekap Butir Soal ({itemAnalysisList.length})</span>
                    </button>
                </div>

                {/* TAB 1: RAPOR ANAK */}
                {activeTab === "prospek" && (
                    <div className="print-hidden space-y-5">
                        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4 shadow-2xs">
                            <div className="border-b border-slate-100 pb-3">
                                <h3 className="text-sm sm:text-base font-black text-slate-900">
                                    Rapor Individual, Rekap Peringkat Sekolah & Ranking Paralel ({filteredStudents.length} Peserta)
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Unduh <strong>PDF Rekap Daftar Peringkat Resmi</strong> (per sekolah maupun paralel lintas sekolah), <strong>Excel (.xlsx)</strong>, atau paket lengkap <strong>.ZIP</strong> rapor individual siswa.
                                </p>
                            </div>

                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80">
                                <div className="inline-flex bg-slate-200/70 p-1 rounded-xl shrink-0 self-start">
                                    <button
                                        type="button"
                                        onClick={() => setStudentViewMode("grouped")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${studentViewMode === "grouped"
                                            ? "bg-white text-blue-900 shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900"
                                            }`}
                                    >
                                        <School className="w-3.5 h-3.5 text-blue-700" />
                                        <span>Per Sekolah ({groupedBySchoolList.length})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setStudentViewMode("parallel")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${studentViewMode === "parallel"
                                            ? "bg-white text-indigo-900 shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900"
                                            }`}
                                    >
                                        <ListOrdered className="w-3.5 h-3.5 text-indigo-700" />
                                        <span>Ranking Paralel ({filteredStudents.length})</span>
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Cari Nama / SMP / WA..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-44 sm:w-48 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-700"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleDownloadRankingTablePdf("PARALLEL")}
                                        disabled={isBusyExport}
                                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>
                                            {isBusyExport && busyScopeKey === "PDF_PARALLEL"
                                                ? busyStatusText
                                                : "PDF Tabel Ranking Paralel"}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleExportExcelXlsx()}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span>Excel (.xlsx)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDownloadZipReports("ALL_SCHOOLS")}
                                        disabled={isBusyExport}
                                        className="px-3 py-1.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
                                    >
                                        <FolderArchive className="w-3.5 h-3.5" />
                                        <span>
                                            {isBusyExport && busyScopeKey === "ZIP_ALL"
                                                ? busyStatusText
                                                : "Semua Sekolah (.ZIP)"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {studentViewMode === "grouped" && (
                                <div className="space-y-4">
                                    {groupedBySchoolList.map((group) => (
                                        <div
                                            key={group.school}
                                            className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs"
                                        >
                                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                                                        <School className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs sm:text-sm font-black text-slate-900">
                                                            {group.school}
                                                        </h4>
                                                        <p className="text-[10.5px] font-mono text-slate-500">
                                                            {group.finishedCount} dari {group.members.length} peserta selesai • Rerata Sekolah:{" "}
                                                            <strong className="text-slate-800">{formatScoreID(group.avgSchool)}</strong>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadRankingTablePdf("SCHOOL", group.school)}
                                                        disabled={isBusyExport || group.members.length === 0}
                                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                                                        <span>
                                                            {isBusyExport && busyScopeKey === `PDF_SCH_${group.school}`
                                                                ? busyStatusText
                                                                : "PDF Tabel Ranking Sekolah"}
                                                        </span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleExportExcelXlsx(group.school)}
                                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                    >
                                                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Excel</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadZipReports(group.school)}
                                                        disabled={isBusyExport || group.finishedCount === 0}
                                                        className="px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                                                    >
                                                        <FolderArchive className="w-3.5 h-3.5" />
                                                        <span>
                                                            {isBusyExport && busyScopeKey === `ZIP_${group.school}`
                                                                ? busyStatusText
                                                                : `Paket Rapor .ZIP (${group.finishedCount})`}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                                                    <thead className="bg-white border-b border-slate-200 font-mono text-[10px] text-slate-500">
                                                        <tr>
                                                            <th className="p-3 w-24 text-center">Rank Sekolah</th>
                                                            <th className="p-3 w-24 text-center">Rank Paralel</th>
                                                            <th className="p-3">Nama Peserta</th>
                                                            <th className="p-3 text-center">Nilai BINDO</th>
                                                            <th className="p-3 text-center">Nilai MTK</th>
                                                            <th className="p-3 text-center">Rata-Rata</th>
                                                            <th className="p-3 text-right">Rapor Anak (A4)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-medium">
                                                        {group.members.map((s, idx) => {
                                                            const bindoCat = getOfficialTkaCategory(s.bindoScore, "BINDO");
                                                            const mtkCat = getOfficialTkaCategory(s.mtkScore, "MTK");

                                                            return (
                                                                <tr key={`${s.phone}_${s.name}_${idx}`} className="hover:bg-slate-50/70">
                                                                    <td className="p-3 text-center font-mono whitespace-nowrap">
                                                                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-black text-[11px]">
                                                                            #{s.schoolRankOverall}{" "}
                                                                            <span className="font-normal text-[9.5px] text-slate-500">
                                                                                / {s.schoolTotalFinished}
                                                                            </span>
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-center font-mono whitespace-nowrap">
                                                                        <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold text-[10.5px]">
                                                                            #{s.parallelRankOverall}{" "}
                                                                            <span className="font-normal text-[9px] text-slate-500">
                                                                                / {s.parallelTotalFinished}
                                                                            </span>
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="font-bold text-slate-900">{s.name}</div>
                                                                        <div className="text-[10px] font-mono text-slate-400">
                                                                            Kelas {s.grade} • WA: {s.phone}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="font-mono font-black text-blue-900 text-xs">
                                                                            {formatScoreID(s.bindoScore)}
                                                                        </div>
                                                                        <span
                                                                            className={`inline-block mt-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold border ${bindoCat.badge}`}
                                                                        >
                                                                            {bindoCat.level} (#{s.schoolRankBindo})
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="font-mono font-black text-emerald-800 text-xs">
                                                                            {formatScoreID(s.mtkScore)}
                                                                        </div>
                                                                        <span
                                                                            className={`inline-block mt-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold border ${mtkCat.badge}`}
                                                                        >
                                                                            {mtkCat.level} (#{s.schoolRankMtk})
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-center font-mono font-black text-sm text-slate-900">
                                                                        {formatScoreID(s.score)}
                                                                    </td>
                                                                    <td className="p-3 text-right">
                                                                        <button
                                                                            onClick={() => setSelectedStudentForReport(s)}
                                                                            className="px-3 py-1.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                                        >
                                                                            <Printer className="w-3.5 h-3.5" />
                                                                            <span>Cetak Rapor & Analisis Butir</span>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {studentViewMode === "parallel" && (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                    <table className="w-full text-left text-xs border-collapse min-w-[1020px]">
                                        <thead className="bg-indigo-50/70 border-b border-slate-200 font-mono text-[10px] text-slate-700">
                                            <tr>
                                                <th className="p-3 w-24 text-center">Rank Paralel</th>
                                                <th className="p-3">Nama Peserta & Asal SMP</th>
                                                <th className="p-3 text-center">Nilai BINDO</th>
                                                <th className="p-3 text-center">Paralel BINDO</th>
                                                <th className="p-3 text-center">Nilai MTK</th>
                                                <th className="p-3 text-center">Paralel MTK</th>
                                                <th className="p-3 text-center">Rata-Rata</th>
                                                <th className="p-3 text-center">Rank di Sekolahnya</th>
                                                <th className="p-3 text-right">Rapor Anak (A4)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {filteredStudents.map((s, idx) => {
                                                const bindoCat = getOfficialTkaCategory(s.bindoScore, "BINDO");
                                                const mtkCat = getOfficialTkaCategory(s.mtkScore, "MTK");

                                                return (
                                                    <tr key={`${s.phone}_${s.name}_${idx}`} className="hover:bg-slate-50/70">
                                                        <td className="p-3 text-center font-mono whitespace-nowrap">
                                                            <span
                                                                className={`px-2.5 py-1 rounded-lg font-black text-xs ${s.parallelRankOverall === 1
                                                                    ? "bg-amber-400 text-slate-950"
                                                                    : s.parallelRankOverall === 2
                                                                        ? "bg-slate-200 text-slate-900"
                                                                        : s.parallelRankOverall === 3
                                                                            ? "bg-orange-200 text-orange-950"
                                                                            : "bg-indigo-50 text-indigo-900 border border-indigo-200"
                                                                    }`}
                                                            >
                                                                #{s.parallelRankOverall}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="font-bold text-slate-900">{s.name}</div>
                                                            <div className="text-[10.5px] font-semibold text-blue-800">{s.school}</div>
                                                            <div className="text-[10px] font-mono text-slate-400">WA: {s.phone}</div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <div className="font-mono font-black text-blue-900 text-xs">
                                                                {formatScoreID(s.bindoScore)}
                                                            </div>
                                                            <span
                                                                className={`inline-block mt-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold border ${bindoCat.badge}`}
                                                            >
                                                                {bindoCat.level}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center font-mono whitespace-nowrap">
                                                            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[10.5px]">
                                                                #{s.parallelRankBindo}{" "}
                                                                <span className="font-normal text-[9px] text-slate-500">
                                                                    / {s.parallelTotalFinished}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <div className="font-mono font-black text-emerald-800 text-xs">
                                                                {formatScoreID(s.mtkScore)}
                                                            </div>
                                                            <span
                                                                className={`inline-block mt-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold border ${mtkCat.badge}`}
                                                            >
                                                                {mtkCat.level}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center font-mono whitespace-nowrap">
                                                            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10.5px]">
                                                                #{s.parallelRankMtk}{" "}
                                                                <span className="font-normal text-[9px] text-slate-500">
                                                                    / {s.parallelTotalFinished}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-black text-sm text-slate-900">
                                                            {formatScoreID(s.score)}
                                                        </td>
                                                        <td className="p-3 text-center font-mono whitespace-nowrap">
                                                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-black text-[11px]">
                                                                #{s.schoolRankOverall}{" "}
                                                                <span className="font-normal text-[9.5px] text-slate-500">
                                                                    / {s.schoolTotalFinished}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <button
                                                                onClick={() => setSelectedStudentForReport(s)}
                                                                className="px-3 py-1.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                            >
                                                                <Printer className="w-3.5 h-3.5" />
                                                                <span>Cetak Rapor & Analisis Butir</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* PENGATURAN KEPALA SEKOLAH & UPLOAD TANDA TANGAN OTOMATIS */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-1">
                                <div className="flex items-center gap-2">
                                    <SlidersHorizontal className="w-4 h-4 text-blue-700 shrink-0" />
                                    <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                                        Pengaturan Pengesahan Kepala Sekolah & Tanda Tangan Otomatis
                                    </h3>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">Otomatis tercetak pada Rapor Anak, PDF Tabel Ranking, Paket .ZIP & Klasemen Sekolah</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end text-xs">
                                <div className="md:col-span-5 space-y-1">
                                    <label className="font-bold font-mono text-slate-600 text-[10.5px]">NAMA KEPALA SEKOLAH:</label>
                                    <input
                                        type="text"
                                        value={officials.kepalaSekolahNama}
                                        onChange={(e) => updateOfficialsField({ kepalaSekolahNama: e.target.value })}
                                        placeholder="Masukkan nama & gelar Kepala Sekolah..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-bold outline-none focus:border-blue-600 text-xs"
                                    />
                                </div>

                                <div className="md:col-span-3 space-y-1">
                                    <label className="font-bold font-mono text-slate-600 text-[10.5px]">NBM / NIP:</label>
                                    <input
                                        type="text"
                                        value={officials.kepalaSekolahNbm}
                                        onChange={(e) => updateOfficialsField({ kepalaSekolahNbm: e.target.value })}
                                        placeholder="Masukkan NBM..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold outline-none focus:border-blue-600 text-xs"
                                    />
                                </div>

                                <div className="md:col-span-4 flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                                    <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 text-blue-900 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>{officials.kepsekSignatureUrl ? "Ganti Gambar TTD" : "Upload Gambar TTD"}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleSignatureUpload(e.target.files?.[0])}
                                        />
                                    </label>

                                    {officials.kepsekSignatureUrl ? (
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={officials.kepsekSignatureUrl}
                                                alt="TTD Kepala Sekolah"
                                                className="h-11 object-contain bg-white px-2 rounded border border-slate-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateOfficialsField({ kepsekSignatureUrl: "" })}
                                                className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-mono text-slate-400 pr-2">PNG / JPG</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: KLASEMEN PERINGKAT ANTAR-SEKOLAH */}
                {activeTab === "sekolah" && (
                    <div className="space-y-5">
                        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-2xs space-y-5 print-sheet">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 print-hidden">
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                                        <Award className="w-5 h-5 text-amber-500" />
                                        <span>Klasemen Peringkat Sekolah Peserta Tryout TKA SMP ({schoolRankings.length} Sekolah)</span>
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Pemeringkatan resmi seluruh SMP/MTs berdasarkan Rerata Gabungan Bahasa Indonesia & Matematika (skala 0,00-100,00 berbobot).
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportExcelSchools}
                                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span>Excel Sekolah (.xlsx)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="px-4 py-2 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Cetak Klasemen Resmi (A4)</span>
                                    </button>
                                </div>
                            </div>

                            <div className="hidden print:block pb-2">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                                        <img
                                            src="/logo-timsim.jpg"
                                            alt="Logo SMA Muhammadiyah 18 Jakarta"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="flex-1 text-center space-y-0.5 font-sans">
                                        <h3 className="text-[10.5px] font-bold tracking-wider uppercase leading-tight text-slate-800">
                                            MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL
                                        </h3>
                                        <h4 className="text-[10px] font-bold tracking-wide uppercase leading-tight text-slate-700">
                                            PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN
                                        </h4>
                                        <h1 className="text-lg font-black uppercase tracking-tight text-[#1e3a8a]">
                                            SMA MUHAMMADIYAH 18 JAKARTA
                                        </h1>
                                        <p className="text-[9.5px] font-bold font-mono uppercase text-slate-700">
                                            TERAKREDITASI "A" • NPSN: 20107319
                                        </p>
                                        <p className="text-[9px] text-slate-600">
                                            Jl. Panjang No. 19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp: (021) 7235544
                                        </p>
                                    </div>
                                    <div className="w-16 shrink-0" />
                                </div>
                                <div className="w-full kop-divider-thick mt-2" />
                                <div className="w-full kop-divider-thin mt-[2px]" />

                                <div className="text-center pt-3 pb-2 space-y-0.5">
                                    <h2 className="text-sm font-black underline uppercase tracking-wide">
                                        KLASEMEN PERINGKAT ANTAR-SEKOLAH TRYOUT TKA JENJANG SMP/MTs TAHUN 2026
                                    </h2>
                                    <p className="text-[9.5px] font-mono text-slate-700">
                                        Berdasarkan Rerata Nilai Bahasa Indonesia, Matematika & Indeks Gabungan (Skala 0,00 - 100,00)
                                    </p>
                                </div>
                            </div>

                            {schoolRankings.length > 0 && (
                                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 print-hidden">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                        <span className="flex items-center gap-1.5 font-mono uppercase text-[11px]">
                                            <BarChart3 className="w-4 h-4 text-blue-700" />
                                            <span>Grafik Perbandingan Rerata BINDO, MTK & Gabungan Antar-Sekolah</span>
                                        </span>
                                        <div className="flex items-center gap-3 text-[10px] font-mono">
                                            <span className="flex items-center gap-1 text-blue-800">
                                                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> BINDO
                                            </span>
                                            <span className="flex items-center gap-1 text-emerald-800">
                                                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" /> MTK
                                            </span>
                                            <span className="flex items-center gap-1 text-amber-800">
                                                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Rata-Rata
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                                        {schoolRankings.map((sch) => (
                                            <div key={sch.school} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="font-black text-slate-900">
                                                        <span className="text-blue-700 font-mono mr-2">#{sch.rank}</span>
                                                        {sch.school}
                                                        <span className="ml-2 text-[10px] font-mono font-normal text-slate-500">
                                                            ({sch.totalFinished} peserta selesai)
                                                        </span>
                                                    </div>
                                                    <div className="font-mono font-black text-amber-700 text-xs">
                                                        Rerata: {formatScoreID(sch.avgOverall)}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-blue-800 font-bold">
                                                            <span>Bahasa Indonesia</span>
                                                            <span>{formatScoreID(sch.avgBindo)}</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, sch.avgBindo)}%` }} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-emerald-800 font-bold">
                                                            <span>Matematika</span>
                                                            <span>{formatScoreID(sch.avgMtk)}</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, sch.avgMtk)}%` }} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-amber-800 font-bold">
                                                            <span>Rata-Rata Sekolah</span>
                                                            <span>{formatScoreID(sch.avgOverall)}</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, sch.avgOverall)}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto rounded-2xl border border-slate-200 print:rounded-none print:border-slate-900">
                                <table className="w-full text-left text-xs border-collapse min-w-[740px] print:min-w-0">
                                    <thead className="bg-slate-50 border-b border-slate-200 print:border-slate-900 font-mono text-[10.5px] text-slate-700">
                                        <tr>
                                            <th className="p-3 text-center w-24 border-r border-slate-200 print:border-slate-900">Peringkat</th>
                                            <th className="p-3 border-r border-slate-200 print:border-slate-900">Nama Sekolah (SMP / MTs)</th>
                                            <th className="p-3 text-center border-r border-slate-200 print:border-slate-900">Peserta</th>
                                            <th className="p-3 text-center border-r border-slate-200 print:border-slate-900">Rerata BINDO</th>
                                            <th className="p-3 text-center border-r border-slate-200 print:border-slate-900">Rerata MTK</th>
                                            <th className="p-3 text-center">Rata-Rata Sekolah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 print:divide-slate-400 font-medium">
                                        {schoolRankings.map((sch) => (
                                            <tr key={sch.school} className="hover:bg-slate-50/70">
                                                <td className="p-3 text-center font-mono border-r border-slate-200 print:border-slate-400 whitespace-nowrap">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-lg font-black text-xs ${sch.rank === 1
                                                            ? "bg-amber-400 text-slate-950"
                                                            : sch.rank === 2
                                                                ? "bg-slate-200 text-slate-900"
                                                                : sch.rank === 3
                                                                    ? "bg-orange-200 text-orange-950"
                                                                    : "bg-blue-50 text-blue-900"
                                                            }`}
                                                    >
                                                        #{sch.rank}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-black text-slate-900 border-r border-slate-200 print:border-slate-400">{sch.school}</td>
                                                <td className="p-3 text-center font-mono text-slate-600 border-r border-slate-200 print:border-slate-400 whitespace-nowrap">
                                                    <strong>{sch.totalFinished}</strong> / {sch.totalRegistered}
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-blue-900 border-r border-slate-200 print:border-slate-400">
                                                    {formatScoreID(sch.avgBindo)}
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-800 border-r border-slate-200 print:border-slate-400">
                                                    {formatScoreID(sch.avgMtk)}
                                                </td>
                                                <td className="p-3 text-center font-mono font-black text-sm text-slate-900">
                                                    {formatScoreID(sch.avgOverall)}
                                                </td>
                                            </tr>
                                        ))}
                                        {schoolRankings.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-slate-400">
                                                    Belum ada sekolah peserta yang terdaftar di database.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="hidden print:flex justify-end pt-6 text-xs font-sans">
                                <div className="w-64 text-center leading-snug">
                                    <p>Jakarta, {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
                                    <p className="font-bold">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                    <div className="h-20 flex items-center justify-center my-1">
                                        {officials.kepsekSignatureUrl && (
                                            <img
                                                src={officials.kepsekSignatureUrl}
                                                alt="TTD Kepala Sekolah"
                                                className="max-h-20 max-w-[190px] w-auto object-contain mx-auto"
                                            />
                                        )}
                                    </div>
                                    <p className="font-bold underline">{officials.kepalaSekolahNama}</p>
                                    <p className="text-[9.5px] font-mono">NBM. {officials.kepalaSekolahNbm}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: REKAP 7 ELEMEN MATERI */}
                {activeTab === "materi" && (
                    <div className="print-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-2xs space-y-5">
                        <div className="border-b border-slate-100 pb-3.5">
                            <h3 className="text-sm sm:text-base font-black text-slate-900">
                                Pemetaan Kolektif 7 Elemen Materi TKA SMP (Perkaban No. 047/H/AN/2025)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Rekap tingkat ketepatan jawaban seluruh peserta pada setiap elemen kompetensi Bahasa Indonesia dan Matematika.
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

                {/* TAB 4: REKAP BUTIR SOAL KOLEKTIF */}
                {activeTab === "butir" && (
                    <div className="print-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-2xs space-y-4">
                        <div className="border-b border-slate-100 pb-3.5">
                            <h3 className="text-sm sm:text-base font-black text-slate-900">
                                Analisis Kualitas Butir Soal Kolektif (Indeks Kesukaran Empiris & Bobot)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Persentase jawaban benar (Indeks P) serta bobot kesulitan soal yang digunakan dalam perhitungan skor TKA SMP.
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
                                        <th className="p-3 text-center w-20">Bobot</th>
                                        <th className="p-3 text-center w-28">Kesukaran</th>
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
                                            <td className="p-3 text-center font-mono text-slate-600">{it.weight.toFixed(2)}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${it.difficultyBadge}`}>
                                                    {it.difficultyLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CETAK RAPOR INDIVIDUAL ANAK MULTI-HALAMAN */}
            {selectedStudentForReport && selectedStudentDiagnostic && (() => {
                const stu = selectedStudentForReport;
                const diag = selectedStudentDiagnostic;
                const bindoScore = Number(stu.bindoScore ?? stu.score ?? 0);
                const mtkScore = Number(stu.mtkScore ?? stu.score ?? 0);
                const bindoCat = getOfficialTkaCategory(bindoScore, "BINDO");
                const mtkCat = getOfficialTkaCategory(mtkScore, "MTK");

                const cx = 135;
                const cy = 122;
                const maxR = 72;
                const axes = diag.hexagonPoints;
                const getHexPoint = (idx: number, pctVal: number) => {
                    const angle = (Math.PI * 2 * idx) / 6 - Math.PI / 2;
                    const norm = Math.min(1, Math.max(0.08, pctVal / 100));
                    const r = norm * maxR;
                    return {
                        x: cx + r * Math.cos(angle),
                        y: cy + r * Math.sin(angle),
                        lx: cx + (maxR + 22) * Math.cos(angle),
                        ly: cy + (maxR + 17) * Math.sin(angle)
                    };
                };

                const studentHexPoly = axes
                    .map((ax, i) => {
                        const p = getHexPoint(i, ax.studentPct);
                        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                    })
                    .join(" ");

                const schoolHexPoly = axes
                    .map((ax, i) => {
                        const p = getHexPoint(i, ax.schoolPct);
                        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                    })
                    .join(" ");

                return (
                    <div className="print-modal-wrapper fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                        <div className="print-modal-card bg-white rounded-2xl sm:rounded-3xl w-[97vw] sm:max-w-5xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 my-auto text-left">
                            <div className="print-hidden p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between gap-2.5 bg-slate-50 rounded-t-2xl sm:rounded-t-3xl shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                                        <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                            Rapor Lengkap & Analisis Butir Soal: {stu.name}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">
                                            {stu.school} • Rank Sekolah #{stu.schoolRankOverall}/{stu.schoolTotalFinished} • Rank Paralel #{stu.parallelRankOverall}/{stu.parallelTotalFinished}
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
                                        <span>Cetak Rapor Lengkap (PDF/A4)</span>
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

                            <div className="p-4 sm:p-7 overflow-y-auto flex-1 text-slate-900 space-y-4 print-sheet">
                                <div className="space-y-3 print:space-y-2 print-page-one">
                                    <div className="pb-0.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                                                <img src="/logo-timsim.jpg" alt="Logo SMA Muhammadiyah 18" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="flex-1 text-center space-y-0.5 font-sans">
                                                <h3 className="text-[9.5px] font-bold uppercase text-slate-800">
                                                    MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL
                                                </h3>
                                                <h4 className="text-[9px] font-bold uppercase text-slate-700">
                                                    PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN
                                                </h4>
                                                <h1 className="text-base sm:text-lg font-black uppercase text-[#1e3a8a]">
                                                    SMA MUHAMMADIYAH 18 JAKARTA
                                                </h1>
                                                <p className="text-[9px] text-slate-600">
                                                    Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp. (021) 7235544
                                                </p>
                                            </div>
                                            <div className="w-14 shrink-0" />
                                        </div>
                                        <div className="w-full kop-divider-thick mt-1" />
                                        <div className="w-full kop-divider-thin mt-[2px]" />
                                    </div>

                                    <div className="text-center space-y-0.5">
                                        <h2 className="text-xs sm:text-[13px] font-black underline uppercase">
                                            SERTIFIKAT HASIL & LAPORAN DIAGNOSTIK TRYOUT TKA SMP/MTs (SHTKA)
                                        </h2>
                                        <p className="text-[9.5px] font-mono text-slate-700">
                                            Skala 0,00 - 100,00 Berbobot Tingkat Kesulitan Soal (Tanpa Batas Kelulusan Sekolah)
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 p-2 bg-slate-50/50 text-[10.5px]">
                                        <table className="w-full">
                                            <tbody>
                                                <tr>
                                                    <td className="py-0.5 w-[17%] text-slate-600">Nama Peserta</td>
                                                    <td className="py-0.5 w-[36%] font-bold">: {stu.name}</td>
                                                    <td className="py-0.5 w-[21%] text-slate-600">Peringkat Paralel</td>
                                                    <td className="py-0.5 font-mono font-black text-blue-900 whitespace-nowrap">
                                                        : Rank #{stu.parallelRankOverall} dari {stu.parallelTotalFinished} Peserta
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="py-0.5 text-slate-600">Asal Sekolah</td>
                                                    <td className="py-0.5 font-bold">: {stu.school} (Kelas {stu.grade})</td>
                                                    <td className="py-0.5 text-slate-600">Peringkat Sekolah</td>
                                                    <td className="py-0.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                        : Rank #{stu.schoolRankOverall} dari {stu.schoolTotalFinished} Siswa
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <table className="w-full text-[10px] border border-slate-900 text-left border-collapse">
                                        <thead className="bg-slate-100 border-b border-slate-900 font-mono text-[9px]">
                                            <tr>
                                                <th className="p-1.5 border-r border-slate-900">MATA UJI TKA SMP/MTs</th>
                                                <th className="p-1.5 border-r border-slate-900 text-center w-20">NILAI ANAK</th>
                                                <th className="p-1.5 border-r border-slate-900 text-center w-20">RERATA SMP</th>
                                                <th className="p-1.5 border-r border-slate-900 text-center w-22">KATEGORI</th>
                                                <th className="p-1.5 border-r border-slate-900 text-center w-28 whitespace-nowrap">RANK SEKOLAH</th>
                                                <th className="p-1.5 text-center w-28 whitespace-nowrap">RANK PARALEL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-300 font-medium">
                                            <tr>
                                                <td className="p-1.5 border-r border-slate-300">
                                                    <div className="font-bold">1. Bahasa Indonesia (BINDO)</div>
                                                    <div className="text-[8.5px] text-slate-600">Pemahaman Tekstual, Inferensial & Evaluasi/Apresiasi</div>
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-black text-blue-900 border-r border-slate-300">
                                                    {formatScoreID(bindoScore)}
                                                </td>
                                                <td className="p-1.5 text-center font-mono text-slate-600 border-r border-slate-300">
                                                    {formatScoreID(diag.schoolAvgBindo)}
                                                </td>
                                                <td className="p-1.5 text-center font-bold border-r border-slate-300">{bindoCat.level}</td>
                                                <td className="p-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                                                    #{stu.schoolRankBindo} / {stu.schoolTotalFinished}
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-black text-blue-950 whitespace-nowrap">
                                                    #{stu.parallelRankBindo} / {stu.parallelTotalFinished}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="p-1.5 border-r border-slate-300">
                                                    <div className="font-bold">2. Matematika (MTK)</div>
                                                    <div className="text-[8.5px] text-slate-600">Bilangan, Aljabar, Geometri & Pengukuran, Data & Peluang</div>
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-black text-emerald-800 border-r border-slate-300">
                                                    {formatScoreID(mtkScore)}
                                                </td>
                                                <td className="p-1.5 text-center font-mono text-slate-600 border-r border-slate-300">
                                                    {formatScoreID(diag.schoolAvgMtk)}
                                                </td>
                                                <td className="p-1.5 text-center font-bold border-r border-slate-300">{mtkCat.level}</td>
                                                <td className="p-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                                                    #{stu.schoolRankMtk} / {stu.schoolTotalFinished}
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-black text-emerald-950 whitespace-nowrap">
                                                    #{stu.parallelRankMtk} / {stu.parallelTotalFinished}
                                                </td>
                                            </tr>
                                            <tr className="bg-slate-50 font-bold">
                                                <td className="p-1.5 border-r border-slate-300">
                                                    RATA-RATA GABUNGAN (INDEKS PEMERINGKATAN)
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-black text-xs text-slate-900 border-r border-slate-300">
                                                    {formatScoreID(stu.score)}
                                                </td>
                                                <td className="p-1.5 text-center font-mono text-slate-700 border-r border-slate-300">
                                                    {formatScoreID(diag.schoolAvgOverall)}
                                                </td>
                                                <td className="p-1.5 text-center text-[9px] text-slate-500 border-r border-slate-300">Per Mata Uji</td>
                                                <td className="p-1.5 text-center font-mono font-black text-amber-900 border-r border-slate-300 whitespace-nowrap">
                                                    #{stu.schoolRankOverall} / {stu.schoolTotalFinished}
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-black text-blue-900 whitespace-nowrap">
                                                    #{stu.parallelRankOverall} / {stu.parallelTotalFinished}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <div className="text-[8.5px] text-slate-600 font-mono italic">
                                        *Keterangan: <strong>Rerata SMP</strong> dihitung otomatis dari rata-rata skor peserta selesai asal{" "}
                                        <strong>{stu.school}</strong> ({diag.schoolFinishedCount} siswa), sedangkan <strong>Rank Paralel</strong> menunjukkan peringkat peserta di antara seluruh {stu.parallelTotalFinished} peserta lintas sekolah.
                                    </div>

                                    <div className="print-diag-grid grid grid-cols-1 md:grid-cols-12 gap-2.5 border border-slate-300 rounded-xl p-2.5 bg-slate-50/40">
                                        <div className="md:col-span-5 bg-white border border-slate-200 rounded-lg p-2 flex flex-col justify-between space-y-1">
                                            <div className="text-center">
                                                <div className="text-[9px] font-mono font-black uppercase text-slate-900">
                                                    GRAFIK HEKSAGONAL TREN KOMPETENSI
                                                </div>
                                                <div className="text-[8px] text-slate-500">
                                                    Biru = Skor Anak • Oranye = Rerata Sekolah
                                                </div>
                                            </div>

                                            <div className="flex justify-center">
                                                <svg viewBox="0 0 270 242" className="w-full max-w-[205px] h-auto overflow-visible">
                                                    {[25, 50, 75, 100].map((ring) => {
                                                        const pts = axes
                                                            .map((_, i) => {
                                                                const p = getHexPoint(i, ring);
                                                                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                                                            })
                                                            .join(" ");
                                                        const top = getHexPoint(0, ring);
                                                        return (
                                                            <g key={ring}>
                                                                <polygon points={pts} fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
                                                                <text x={top.x + 3} y={top.y + 3} className="fill-slate-400 font-mono text-[7px]">
                                                                    {ring}
                                                                </text>
                                                            </g>
                                                        );
                                                    })}

                                                    {axes.map((ax, i) => {
                                                        const outer = getHexPoint(i, 100);
                                                        return (
                                                            <g key={ax.key}>
                                                                <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#cbd5e1" strokeWidth="0.8" />
                                                                <text
                                                                    x={outer.lx}
                                                                    y={outer.ly - 4}
                                                                    textAnchor="middle"
                                                                    dominantBaseline="middle"
                                                                    className="fill-slate-800 font-mono text-[8.5px] font-bold"
                                                                >
                                                                    {ax.short}
                                                                </text>
                                                                <text
                                                                    x={outer.lx}
                                                                    y={outer.ly + 6}
                                                                    textAnchor="middle"
                                                                    dominantBaseline="middle"
                                                                    className="fill-blue-800 font-mono text-[8px] font-black"
                                                                >
                                                                    ({formatScoreID(ax.studentPct)})
                                                                </text>
                                                            </g>
                                                        );
                                                    })}

                                                    <polygon
                                                        points={schoolHexPoly}
                                                        fill="rgba(245, 158, 11, 0.08)"
                                                        stroke="#d97706"
                                                        strokeWidth="1.2"
                                                        strokeDasharray="3 2"
                                                    />
                                                    <polygon
                                                        points={studentHexPoly}
                                                        fill="rgba(29, 78, 216, 0.25)"
                                                        stroke="#1d4ed8"
                                                        strokeWidth="2"
                                                    />
                                                    {axes.map((ax, i) => {
                                                        const pt = getHexPoint(i, ax.studentPct);
                                                        return (
                                                            <circle
                                                                key={ax.key}
                                                                cx={pt.x}
                                                                cy={pt.y}
                                                                r="3"
                                                                fill="#1e3a8a"
                                                                stroke="#ffffff"
                                                                strokeWidth="1"
                                                            />
                                                        );
                                                    })}
                                                </svg>
                                            </div>

                                            <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200 text-[8.5px] text-slate-700 leading-tight">
                                                <div>
                                                    • Keunggulan Utama: <strong>{diag.strongestAxis?.key} ({formatScoreID(diag.strongestAxis?.studentPct || 0)})</strong>
                                                </div>
                                                <div>
                                                    • Prioritas Perbaikan: <strong>{diag.weakestAxis?.key} ({formatScoreID(diag.weakestAxis?.studentPct || 0)})</strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="md:col-span-7 bg-white border border-slate-200 rounded-lg p-2 flex flex-col justify-between space-y-1.5">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                                <span className="text-[9px] font-mono font-black uppercase text-slate-900">
                                                    GRAFIK CAPAIAN PER KISI-KISI & SUB-ELEMEN SOAL
                                                </span>
                                                <span className="text-[8px] font-mono text-slate-400">
                                                    Skala 0,00 - 100,00
                                                </span>
                                            </div>

                                            <div className="print-compact-bars space-y-1.5 flex-1 justify-center flex flex-col">
                                                {diag.sevenCompetencyStats.map((comp) => {
                                                    const isMtk = comp.subject === "MTK";
                                                    const cat = getOfficialTkaCategory(comp.pct, isMtk ? "MTK" : "BINDO");

                                                    return (
                                                        <div key={comp.code} className="space-y-0.5 text-[9px]">
                                                            <div className="flex items-center justify-between font-mono">
                                                                <span className="font-bold text-slate-800 truncate pr-2">
                                                                    <span
                                                                        className={`inline-block px-1 rounded text-[7.5px] mr-1 ${isMtk
                                                                            ? "bg-emerald-100 text-emerald-900"
                                                                            : "bg-blue-100 text-blue-900"
                                                                            }`}
                                                                    >
                                                                        {comp.subject}
                                                                    </span>
                                                                    {comp.code}
                                                                </span>
                                                                <span className="font-black text-slate-900 shrink-0">
                                                                    {comp.rawCorrect}/{comp.totalQ} Soal •{" "}
                                                                    <span className="text-blue-900">{formatScoreID(comp.pct)}</span> ({cat.level})
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                                                                <div
                                                                    className={`h-full rounded-full ${cat.barColor}`}
                                                                    style={{ width: `${Math.max(3, Math.min(100, comp.pct))}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="text-[8px] text-slate-500 font-mono border-t border-slate-100 pt-1 leading-tight">
                                                *Setiap kisi-kisi dihitung terpisah berdasarkan bobot kesulitan butir soal pada elemen terkait.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-2 border border-slate-900 bg-white text-[9px] space-y-0.5">
                                        <div className="font-bold font-mono text-[8.5px] uppercase text-slate-900">
                                            KETERANGAN ACUAN PENILAIAN RESMI TKA JENJANG SMP/MTs:
                                        </div>
                                        <p className="text-[8px] text-slate-700 leading-tight">
                                            Hasil Tryout Tes Kemampuan Akademik (TKA) SMP/MTs dilaporkan dalam rentang nilai <strong>0,00 - 100,00</strong> menggunakan pembobotan tingkat kesulitan butir soal (tidak menggunakan batas kelulusan/KKM). Kategori capaian ditetapkan secara terpisah per mata uji:{" "}
                                            <strong>Bahasa Indonesia:</strong> Istimewa (≥95,00), Baik (76,67-94,99), Memadai (50,00-76,66), Kurang (≤50,00) |{" "}
                                            <strong>Matematika:</strong> Istimewa (≥95,00), Baik (56,67-94,99), Memadai (33,33-56,66), Kurang (≤33,33).
                                        </p>
                                    </div>

                                    <div className="pt-2 flex justify-end text-[10.5px] font-sans">
                                        <div className="w-64 text-center leading-snug">
                                            <p>Jakarta, {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
                                            <p className="font-semibold">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                            <div className="h-20 flex items-center justify-center my-0.5">
                                                {officials.kepsekSignatureUrl && (
                                                    <img
                                                        src={officials.kepsekSignatureUrl}
                                                        alt="TTD Kepala Sekolah"
                                                        className="max-h-20 max-w-[190px] w-auto object-contain mx-auto"
                                                    />
                                                )}
                                            </div>
                                            <p className="font-bold underline">{officials.kepalaSekolahNama}</p>
                                            <p className="text-[9px] font-mono">NBM. {officials.kepalaSekolahNbm}</p>
                                        </div>
                                    </div>
                                </div>

                                {diag.studentItemRows.length > 0 && (
                                    <div className="pt-6 border-t-2 border-dashed border-slate-300 print:border-none print:pt-0 page-break-before space-y-3">
                                        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                                            <div>
                                                <h3 className="text-xs sm:text-sm font-black uppercase text-slate-900">
                                                    LAMPIRAN DIAGNOSTIK RINCIAN BUTIR SOAL PESERTA
                                                </h3>
                                                <p className="text-[10px] font-mono text-slate-600">
                                                    Peserta: <strong>{stu.name}</strong> ({stu.school}) • Pemetaan Jawaban per Kisi-Kisi
                                                </p>
                                            </div>
                                            <span className="text-[9.5px] font-mono font-bold px-2.5 py-1 bg-slate-100 border border-slate-300 rounded">
                                                Total {diag.studentItemRows.length} Butir
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3">
                                            {(["BINDO", "MTK"] as const).map((subCode) => {
                                                const rows = diag.studentItemRows.filter((r) => r.subtes_code === subCode);
                                                return (
                                                    <div key={subCode} className="border border-slate-900 overflow-hidden">
                                                        <div className="bg-slate-100 border-b border-slate-900 px-2.5 py-1.5 font-mono font-black text-[10px] uppercase flex justify-between">
                                                            <span>
                                                                {subCode === "BINDO" ? "1. BAHASA INDONESIA" : "2. MATEMATIKA"} ({rows.length} Soal)
                                                            </span>
                                                            <span>
                                                                Benar: {rows.filter((r) => r.status === "BENAR").length} / {rows.length}
                                                            </span>
                                                        </div>
                                                        <table className="w-full text-[9px] border-collapse">
                                                            <thead className="bg-slate-50 border-b border-slate-400 font-mono">
                                                                <tr>
                                                                    <th className="p-1 border-r border-slate-300 text-center w-8">No</th>
                                                                    <th className="p-1 border-r border-slate-300 text-left">Kisi-Kisi / Materi</th>
                                                                    <th className="p-1 border-r border-slate-300 text-center w-12">Jwb</th>
                                                                    <th className="p-1 border-r border-slate-300 text-center w-12">Kunci</th>
                                                                    <th className="p-1 text-center w-16">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200">
                                                                {rows.map((r) => (
                                                                    <tr key={r.id}>
                                                                        <td className="p-1 text-center font-mono font-bold border-r border-slate-200">
                                                                            {r.no_soal}
                                                                        </td>
                                                                        <td className="p-1 border-r border-slate-200 truncate max-w-[140px]">
                                                                            {r.element}
                                                                        </td>
                                                                        <td className="p-1 text-center font-mono font-bold border-r border-slate-200">
                                                                            {r.studentAnsLabel}
                                                                        </td>
                                                                        <td className="p-1 text-center font-mono font-bold text-emerald-800 border-r border-slate-200">
                                                                            {r.keyLabel}
                                                                        </td>
                                                                        <td className="p-1 text-center font-mono font-bold">
                                                                            {r.status === "BENAR" ? (
                                                                                <span className="text-emerald-700 inline-flex items-center gap-0.5">
                                                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Benar
                                                                                </span>
                                                                            ) : r.status === "PARSIAL" ? (
                                                                                <span className="text-amber-700">Sebagian</span>
                                                                            ) : r.status === "KOSONG" ? (
                                                                                <span className="text-slate-400 inline-flex items-center gap-0.5">
                                                                                    <MinusCircle className="w-2.5 h-2.5" /> Kosong
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-rose-700 inline-flex items-center gap-0.5">
                                                                                    <XCircle className="w-2.5 h-2.5" /> Salah
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}