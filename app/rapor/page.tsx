"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Download,
    Printer,
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Loader2,
    Home,
    FileCheck2,
    KeyRound,
    ArrowRight,
    Sparkles
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { supabase } from "@/lib/supabase";

const OFFICIAL_COMPETENCIES = [
    { code: "Pemahaman Tekstual", subject: "BINDO" },
    { code: "Pemahaman Inferensial", subject: "BINDO" },
    { code: "Evaluasi dan Apresiasi", subject: "BINDO" },
    { code: "Bilangan", subject: "MTK" },
    { code: "Aljabar", subject: "MTK" },
    { code: "Geometri & Pengukuran", subject: "MTK" },
    { code: "Data & Peluang", subject: "MTK" }
];

const HEXAGON_AXES = [
    { key: "Pemahaman Tekstual", short: "Tekstual", subject: "BINDO", elements: ["Pemahaman Tekstual"] },
    { key: "Pemahaman Inferensial", short: "Inferensial", subject: "BINDO", elements: ["Pemahaman Inferensial"] },
    { key: "Evaluasi dan Apresiasi", short: "Evaluasi", subject: "BINDO", elements: ["Evaluasi dan Apresiasi"] },
    { key: "Bilangan", short: "Bilangan", subject: "MTK", elements: ["Bilangan"] },
    { key: "Aljabar", short: "Aljabar", subject: "MTK", elements: ["Aljabar"] },
    {
        key: "Geometri, Data & Peluang",
        short: "Geo & Data",
        subject: "MTK",
        elements: ["Geometri & Pengukuran", "Data & Peluang"]
    }
];

function getOfficialTkaCategory(score: number, subject: "BINDO" | "MTK" = "BINDO") {
    const num = Number(score) || 0;
    const isMtk = subject === "MTK";
    const baikCutOff = isMtk ? 56.67 : 76.67;
    const memadaiCutOff = isMtk ? 33.33 : 50.0;

    if (num >= 95.0) return { level: "Istimewa", barHex: "#4f46e5" };
    if (num >= baikCutOff) return { level: "Baik", barHex: "#059669" };
    if (num >= memadaiCutOff) return { level: "Memadai", barHex: "#2563eb" };
    return { level: "Kurang", barHex: "#f43f5e" };
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

function parseAnswersJson(raw: unknown): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof raw === "object" ? (raw as Record<string, any>) : {};
}

function findMatchingResultRow(resultsList: any[], phone: string, name: string) {
    const cleanP = normalizePhoneDigits(phone);
    const cleanN = String(name || "").toUpperCase().trim();

    const exactMatch = resultsList.find(
        (r) =>
            cleanP &&
            normalizePhoneDigits(r?.phone || "") === cleanP &&
            String(r?.student_name || "").toUpperCase().trim() === cleanN
    );
    if (exactMatch) return exactMatch;

    const nameMatch = resultsList.find(
        (r) => cleanN && String(r?.student_name || "").toUpperCase().trim() === cleanN
    );
    if (nameMatch) return nameMatch;

    return resultsList.find((r) => cleanP && normalizePhoneDigits(r?.phone || "") === cleanP);
}

function mapQuestionToOfficialElement(subtesCode: string, rawMateri?: string): string {
    const m = String(rawMateri || "").toLowerCase();
    if (subtesCode === "BINDO") {
        if (m.includes("inferen") || m.includes("tersirat") || m.includes("ide pokok")) {
            return "Pemahaman Inferensial";
        }
        if (m.includes("evaluasi") || m.includes("apresiasi") || m.includes("refleksi")) {
            return "Evaluasi dan Apresiasi";
        }
        return "Pemahaman Tekstual";
    } else {
        if (m.includes("aljabar") || m.includes("persamaan") || m.includes("fungsi") || m.includes("barisan")) {
            return "Aljabar";
        }
        if (
            m.includes("geometri") ||
            m.includes("ukur") ||
            m.includes("sudut") ||
            m.includes("pythagoras") ||
            m.includes("bangun")
        ) {
            return "Geometri & Pengukuran";
        }
        if (m.includes("data") || m.includes("peluang") || m.includes("statis")) {
            return "Data & Peluang";
        }
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
    const code = String(q?.subtes_code || "").toUpperCase().includes("MTK") ? "MTK" : "BINDO";
    const noSoal = Number(q?.no_soal) || idxInSubtest + 1;

    const candidateKeys = [
        String(q?.id ?? ""),
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
    const rawKey = String(q?.kunci || "A").toUpperCase().trim();

    const rawType = String(q?.type || "").toUpperCase().trim();
    const isKategori = rawType === "PGK_KATEGORI" || rawKey.includes("|");
    const isMcma = !isKategori && (rawType === "PGK_MCMA" || rawKey.includes(","));

    if (userAns === undefined || userAns === null) {
        return { fraction: 0, status: "KOSONG" as const, studentAnsLabel: "-", keyLabel: rawKey };
    }

    if (isMcma) {
        const correctArr: number[] =
            Array.isArray(q?.multiAnswers) && q.multiAnswers.length > 0
                ? q.multiAnswers
                : rawKey
                    .split(",")
                    .map((k) => keyMap[k.trim()])
                    .filter((n) => n !== undefined);
        const userArr: number[] = Array.isArray(userAns) ? userAns : [];
        const matchCount = userArr.filter((val) => correctArr.includes(val)).length;
        const wrongCount = userArr.filter((val) => !correctArr.includes(val)).length;
        const frac = Math.max(0, (matchCount - wrongCount) / (correctArr.length || 1));
        const studentLabel = userArr.length > 0 ? userArr.map((i) => revMap[i] || String(i)).join(", ") : "-";
        const status = frac >= 0.99 ? ("BENAR" as const) : frac > 0 ? ("PARSIAL" as const) : ("SALAH" as const);
        return { fraction: frac, status, studentAnsLabel: studentLabel, keyLabel: rawKey };
    }

    if (isKategori) {
        const optionsList: string[] =
            Array.isArray(q?.options) && q.options.length > 0
                ? q.options.map((opt: any) => (typeof opt === "string" ? opt : String(opt?.text ?? "")))
                : [q?.opsi_a, q?.opsi_b, q?.opsi_c, q?.opsi_d, q?.opsi_e].filter(
                    (v) => v !== undefined && v !== null && String(v).trim().length > 0
                );
        const catKeys = rawKey.split("|").map((k) => k.trim());
        const statementsList =
            Array.isArray(q?.statements) && q.statements.length > 0
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

    const targetIdx = typeof q?.singleAnswer === "number" ? q?.singleAnswer : (keyMap[rawKey] ?? 0);
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

// Bobot kesulitan soal empiris identik dengan Dashboard Admin
function computeUnifiedWeightsMap(questionsBank: any[], rawResultsList: any[]): Record<string, number> {
    const bindoQs = questionsBank.filter((q) => !String(q?.subtes_code || "").toUpperCase().includes("MTK"));
    const mtkQs = questionsBank.filter((q) => String(q?.subtes_code || "").toUpperCase().includes("MTK"));
    const weightsMap: Record<string, number> = {};

    const processList = (qList: any[], globalOffset: number) => {
        qList.forEach((q: any, idx: number) => {
            const qId = String(q?.id ?? idx);
            let totalAttempt = 0;
            let correctCount = 0;

            rawResultsList.forEach((res) => {
                const ansMap = parseAnswersJson(res?.answers);
                const userAns = resolveStudentAnswerForQuestion(q, idx, globalOffset + idx, ansMap);
                if (userAns !== undefined && userAns !== null) {
                    totalAttempt++;
                    if (evaluateStudentItemDetail(q, userAns).fraction >= 0.99) {
                        correctCount++;
                    }
                }
            });

            const pRatio = totalAttempt > 0 ? correctCount / totalAttempt : 0.5;
            const baseDiff = Number(q?.difficulty) > 1 ? Number(q.difficulty) : 1 + (1 - pRatio) * 0.85;
            weightsMap[qId] = Number(baseDiff.toFixed(4));
        });
    };

    processList(bindoQs, 0);
    processList(mtkQs, bindoQs.length);
    return weightsMap;
}

function triggerCrossBrowserPdfDownload(pdf: jsPDF, fileName: string): string {
    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    try {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch {
        window.open(blobUrl, "_blank");
    }

    return blobUrl;
}

async function captureA4DesktopCanvas(element: HTMLElement, targetId: string) {
    return html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: 1120,
        onclone: (clonedDoc) => {
            const clonedEl = clonedDoc.getElementById(targetId);
            if (clonedEl) {
                clonedEl.style.width = "840px";
                clonedEl.style.maxWidth = "840px";
                clonedEl.style.minWidth = "840px";
                clonedEl.style.padding = "28px 32px";
                clonedEl.style.borderRadius = "0px";
                clonedEl.style.boxShadow = "none";
            }
            const twoColGrids = clonedDoc.querySelectorAll(".pdf-force-desktop-grid");
            twoColGrids.forEach((node) => {
                const el = node as HTMLElement;
                el.style.display = "grid";
                el.style.gridTemplateColumns = "repeat(12, minmax(0, 1fr))";
                el.style.gap = "12px";
            });
            const col5 = clonedDoc.querySelectorAll(".pdf-col-5");
            col5.forEach((node) => {
                (node as HTMLElement).style.gridColumn = "span 5 / span 5";
            });
            const col7 = clonedDoc.querySelectorAll(".pdf-col-7");
            col7.forEach((node) => {
                (node as HTMLElement).style.gridColumn = "span 7 / span 7";
            });
            const twoSubGrids = clonedDoc.querySelectorAll(".pdf-force-2col");
            twoSubGrids.forEach((node) => {
                const el = node as HTMLElement;
                el.style.display = "grid";
                el.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
                el.style.gap = "12px";
            });
        }
    });
}

function addCanvasFittedToA4Page(pdf: jsPDF, canvas: HTMLCanvasElement, isFirstPage: boolean) {
    if (!isFirstPage) pdf.addPage("a4", "portrait");
    const pageW = 210;
    const pageH = 297;
    const margin = 4;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    let renderW = maxW;
    let renderH = (canvas.height * renderW) / canvas.width;

    if (renderH > maxH) {
        renderH = maxH;
        renderW = (canvas.width * renderH) / canvas.height;
    }

    const offsetX = (pageW - renderW) / 2;
    const imgData = canvas.toDataURL("image/jpeg", 0.94);
    pdf.addImage(imgData, "JPEG", offsetX, margin, renderW, renderH);
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

async function addFullImagePageToA4(pdf: jsPDF, imgSrc: string) {
    const img = await loadImageElement(imgSrc);
    if (!img || !img.naturalWidth || !img.naturalHeight) return;

    const isLandscape = img.naturalWidth > img.naturalHeight;
    pdf.addPage("a4", isLandscape ? "landscape" : "portrait");

    const pageW = isLandscape ? 297 : 210;
    const pageH = isLandscape ? 210 : 297;
    const margin = 6;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const offsetX = (pageW - drawW) / 2;
    const offsetY = (pageH - drawH) / 2;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(img, 0, 0);
        const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(dataUrl, "JPEG", offsetX, offsetY, drawW, drawH);
    }
}

function PrivateStudentReportContent() {
    const searchParams = useSearchParams();
    const initialToken = String(searchParams.get("t") || "").trim().toUpperCase();
    const autoDownloadParam = searchParams.get("autodownload") === "1";

    const [activePhone, setActivePhone] = useState<string>("");
    const [activeToken, setActiveToken] = useState<string>("");
    const [inputTokenCode, setInputTokenCode] = useState<string>(initialToken);
    const [inputPhoneLast4, setInputPhoneLast4] = useState<string>("");
    const [shouldAutoDownload, setShouldAutoDownload] = useState<boolean>(autoDownloadParam);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [questionsBank, setQuestionsBank] = useState<any[]>([]);
    const [allResultsList, setAllResultsList] = useState<any[]>([]);

    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [pdfDownloadNotice, setPdfDownloadNotice] = useState<string>("");
    const autoDownloadTriggeredRef = useRef<boolean>(false);

    const page1Ref = useRef<HTMLDivElement>(null);
    const page2Ref = useRef<HTMLDivElement>(null);

    const verifyAndLoadStudent = useCallback(async (tokenToCheck: string, last4DigitsToCheck: string) => {
        const cleanToken = String(tokenToCheck || "").trim().toUpperCase();
        const cleanLast4 = String(last4DigitsToCheck || "").replace(/\D/g, "").slice(0, 4);

        if (!cleanToken) {
            setAccessError("Silakan masukkan Kode Verifikasi Rapor (SHTKA-...) Anda terlebih dahulu.");
            return;
        }
        if (cleanLast4.length !== 4) {
            setAccessError("Silakan masukkan 4 digit terakhir nomor HP/WhatsApp yang didaftarkan saat login.");
            return;
        }

        setIsLoading(true);
        setAccessError(null);
        autoDownloadTriggeredRef.current = false;

        try {
            const [stuRes, qRes, resAll] = await Promise.all([
                supabase.from("tka_students").select("*"),
                supabase
                    .from("tka_questions")
                    .select("*")
                    .order("subtes_code", { ascending: true })
                    .order("no_soal", { ascending: true }),
                supabase.from("tka_results").select("*").order("submitted_at", { ascending: false })
            ]);

            const listStudents = Array.isArray(stuRes.data) ? stuRes.data : [];
            const listResults = Array.isArray(resAll.data) ? resAll.data : [];

            let targetStudent = listStudents.find((s) => {
                const dbToken = String(s?.report_token || "").trim().toUpperCase();
                const dbPhone = normalizePhoneDigits(s?.phone || "");
                return dbToken === cleanToken && dbPhone.endsWith(cleanLast4);
            });

            if (!targetStudent && typeof window !== "undefined") {
                try {
                    const localSaved = JSON.parse(window.localStorage.getItem("tka_result") || "{}");
                    const localToken = String(localSaved?.reportToken || "").trim().toUpperCase();
                    const localPhone = normalizePhoneDigits(localSaved?.cleanPhone || "");
                    if (localToken === cleanToken && localPhone.endsWith(cleanLast4)) {
                        targetStudent = listStudents.find(
                            (s) => normalizePhoneDigits(s?.phone || "") === localPhone
                        );
                    }
                } catch { }
            }

            if (!targetStudent) {
                setAccessError(
                    "Kombinasi Kode Verifikasi Rapor dan 4 digit terakhir nomor HP tidak cocok. Periksa kembali kode SHTKA-... dan 4 angka terakhir nomor WA yang Anda daftarkan."
                );
                setIsLoading(false);
                return;
            }

            const matchedPhone = normalizePhoneDigits(targetStudent.phone || "");
            setActivePhone(matchedPhone);
            setActiveToken(cleanToken);
            setAllStudents(listStudents);
            if (Array.isArray(qRes.data)) setQuestionsBank(qRes.data);

            let finalResultsList = [...listResults];
            if (typeof window !== "undefined") {
                try {
                    const localSaved = JSON.parse(window.localStorage.getItem("tka_result") || "{}");
                    if (localSaved?.answers && !findMatchingResultRow(finalResultsList, matchedPhone, targetStudent.name)) {
                        finalResultsList.push({
                            phone: matchedPhone,
                            student_name: targetStudent.name,
                            answers: localSaved.answers
                        });
                    }
                } catch { }
            }
            setAllResultsList(finalResultsList);
        } catch {
            setAccessError("Terjadi gangguan koneksi saat memuat Sertifikat Hasil TKA SMP.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reportData = useMemo(() => {
        if (allStudents.length === 0 || !activePhone) return null;

        const weightsMap = computeUnifiedWeightsMap(questionsBank, allResultsList);
        const bindoQs = questionsBank.filter((q) => !String(q?.subtes_code || "").toUpperCase().includes("MTK"));
        const mtkQs = questionsBank.filter((q) => String(q?.subtes_code || "").toUpperCase().includes("MTK"));

        // Hitung ulang skor desimal seluruh peserta dengan rumus yang identik dengan Dashboard Admin
        const normalizedAll = allStudents.map((item: any) => {
            const cleanP = normalizePhoneDigits(item?.phone || "");
            const cleanN = String(item?.name || "PESERTA").toUpperCase().trim();
            const rawScore = Number(item?.score ?? 0);
            let bindoScore = Number(item?.bindo_score ?? rawScore);
            let mtkScore = Number(item?.mtk_score ?? rawScore);
            let score = rawScore;

            const matchedRes = findMatchingResultRow(allResultsList, cleanP, cleanN);
            const ansObj = parseAnswersJson(matchedRes?.answers);
            const hasAns = Object.keys(ansObj).length > 0 && questionsBank.length > 0;

            if (hasAns) {
                let bEarned = 0,
                    bTotalW = 0;
                bindoQs.forEach((q, idx) => {
                    const w = weightsMap[String(q?.id ?? idx)] || 1;
                    const uAns = resolveStudentAnswerForQuestion(q, idx, idx, ansObj);
                    bEarned += evaluateStudentItemDetail(q, uAns).fraction * w;
                    bTotalW += w;
                });

                let mEarned = 0,
                    mTotalW = 0;
                mtkQs.forEach((q, idx) => {
                    const w = weightsMap[String(q?.id ?? idx)] || 1;
                    const uAns = resolveStudentAnswerForQuestion(q, idx, bindoQs.length + idx, ansObj);
                    mEarned += evaluateStudentItemDetail(q, uAns).fraction * w;
                    mTotalW += w;
                });

                if (bTotalW > 0) bindoScore = Number(((bEarned / bTotalW) * 100).toFixed(2));
                if (mTotalW > 0) mtkScore = Number(((mEarned / mTotalW) * 100).toFixed(2));
                score = Number(((bindoScore + mtkScore) / 2).toFixed(2));
            }

            return {
                phone: cleanP,
                name: cleanN,
                school: normalizeSchoolName(item?.school || "SMP / MTs"),
                grade: String(item?.grade || "9").trim(),
                status: String(item?.status || (score > 0 ? "Selesai" : "Terdaftar")).trim(),
                score,
                bindoScore,
                mtkScore
            };
        });

        const stu = normalizedAll.find((s) => s.phone === activePhone);
        if (!stu) return null;

        const finishedAll = normalizedAll.filter(
            (s) => s.status.toLowerCase().includes("selesai") || s.score > 0
        );
        const parallelPool = finishedAll.length > 0 ? finishedAll : normalizedAll;

        const pSortedOverall = [...parallelPool].sort((a, b) => b.score - a.score);
        const pSortedBindo = [...parallelPool].sort((a, b) => b.bindoScore - a.bindoScore);
        const pSortedMtk = [...parallelPool].sort((a, b) => b.mtkScore - a.mtkScore);

        const schoolPool = parallelPool.filter((s) => s.school === stu.school);
        const activeSchoolPool = schoolPool.length > 0 ? schoolPool : [stu];
        const sSortedOverall = [...activeSchoolPool].sort((a, b) => b.score - a.score);
        const sSortedBindo = [...activeSchoolPool].sort((a, b) => b.bindoScore - a.bindoScore);
        const sSortedMtk = [...activeSchoolPool].sort((a, b) => b.mtkScore - a.mtkScore);

        const schoolAvgBindo = Number(
            (activeSchoolPool.reduce((sum, x) => sum + x.bindoScore, 0) / activeSchoolPool.length).toFixed(2)
        );
        const schoolAvgMtk = Number(
            (activeSchoolPool.reduce((sum, x) => sum + x.mtkScore, 0) / activeSchoolPool.length).toFixed(2)
        );
        const schoolAvgOverall = Number(
            (activeSchoolPool.reduce((sum, x) => sum + x.score, 0) / activeSchoolPool.length).toFixed(2)
        );

        const targetResultRow = findMatchingResultRow(allResultsList, stu.phone, stu.name);
        const studentAnswers = parseAnswersJson(targetResultRow?.answers);
        const hasAnswers = Object.keys(studentAnswers).length > 0 && questionsBank.length > 0;

        const buildItems = (qList: any[], subCode: "BINDO" | "MTK", globalOffset: number) =>
            qList.map((q, idx) => {
                const uAns = resolveStudentAnswerForQuestion(q, idx, globalOffset + idx, studentAnswers);
                const detail = evaluateStudentItemDetail(q, uAns);
                const element = mapQuestionToOfficialElement(subCode, q?.materi);
                const weight = weightsMap[String(q?.id ?? idx)] || 1;
                return {
                    id: String(q?.id ?? `${subCode}_${idx + 1}`),
                    no_soal: Number(q?.no_soal) || idx + 1,
                    subtes_code: subCode,
                    element,
                    weight,
                    ...detail
                };
            });

        const itemRows = [
            ...buildItems(bindoQs, "BINDO", 0),
            ...buildItems(mtkQs, "MTK", bindoQs.length)
        ];

        const sevenCompetencies = OFFICIAL_COMPETENCIES.map((comp) => {
            const compItems = itemRows.filter((it) => it.element === comp.code);
            let earnedW = 0;
            let totalW = 0;
            let rawCorrect = 0;
            compItems.forEach((it) => {
                earnedW += it.fraction * it.weight;
                totalW += it.weight;
                if (it.fraction >= 0.99) rawCorrect++;
            });
            const pct = hasAnswers && totalW > 0 ? Number(((earnedW / totalW) * 100).toFixed(2)) : 0;
            return {
                ...comp,
                totalQ: compItems.length,
                rawCorrect,
                earnedW,
                totalW,
                pct
            };
        });

        const hexagonPoints = HEXAGON_AXES.map((ax) => {
            const matched = sevenCompetencies.filter((c) => ax.elements.includes(c.code));
            const earnedSum = matched.reduce((s, c) => s + c.earnedW, 0);
            const totalWeightSum = matched.reduce((s, c) => s + c.totalW, 0);
            const studentPct =
                hasAnswers && totalWeightSum > 0 ? Number(((earnedSum / totalWeightSum) * 100).toFixed(2)) : 0;
            return {
                ...ax,
                studentPct,
                schoolPct: ax.subject === "MTK" ? schoolAvgMtk : schoolAvgBindo
            };
        });

        const sortedHex = [...hexagonPoints].sort((a, b) => b.studentPct - a.studentPct);

        return {
            stu,
            parallelRankOverall: Math.max(1, pSortedOverall.findIndex((x) => x.phone === stu.phone) + 1),
            parallelRankBindo: Math.max(1, pSortedBindo.findIndex((x) => x.phone === stu.phone) + 1),
            parallelRankMtk: Math.max(1, pSortedMtk.findIndex((x) => x.phone === stu.phone) + 1),
            parallelTotal: parallelPool.length,
            schoolRankOverall: Math.max(1, sSortedOverall.findIndex((x) => x.phone === stu.phone) + 1),
            schoolRankBindo: Math.max(1, sSortedBindo.findIndex((x) => x.phone === stu.phone) + 1),
            schoolRankMtk: Math.max(1, sSortedMtk.findIndex((x) => x.phone === stu.phone) + 1),
            schoolTotal: activeSchoolPool.length,
            schoolAvgBindo,
            schoolAvgMtk,
            schoolAvgOverall,
            sevenCompetencies,
            hexagonPoints,
            strongestAxis: sortedHex[0],
            weakestAxis: sortedHex[sortedHex.length - 1],
            itemRows
        };
    }, [allStudents, questionsBank, allResultsList, activePhone]);

    const handleDownloadPdfFile = useCallback(async () => {
        if (!reportData || !page1Ref.current || isGeneratingPdf) return;
        setIsGeneratingPdf(true);
        setPdfDownloadNotice("Sedang menyusun file PDF Sertifikat SHTKA & Brosur PPDB (4 Halaman A4)...");

        try {
            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            // Halaman 1: Sertifikat Hasil TKA SMP (SHTKA)
            const canvas1 = await captureA4DesktopCanvas(page1Ref.current, "shtka-page-1");
            addCanvasFittedToA4Page(pdf, canvas1, true);

            // Halaman 2: Lampiran Analisis Butir Soal Peserta
            if (page2Ref.current && reportData.itemRows.length > 0) {
                const canvas2 = await captureA4DesktopCanvas(page2Ref.current, "shtka-page-2");
                addCanvasFittedToA4Page(pdf, canvas2, false);
            }

            // Halaman 3: Brosur PPDB Halaman Depan (Full A4 Utuh Tanpa Terpotong)
            await addFullImagePageToA4(pdf, "/flyer-ppdb-depan.jpg");

            // Halaman 4: Brosur PPDB Halaman Belakang (Full A4 Utuh Tanpa Terpotong)
            await addFullImagePageToA4(pdf, "/flyer-ppdb-belakang.jpg");

            const safeName = reportData.stu.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
            const fileName = `Rapor_SHTKA_${safeName}.pdf`;
            triggerCrossBrowserPdfDownload(pdf, fileName);
            setPdfDownloadNotice(`File "${fileName}" berhasil disiapkan! Cek folder Unduhan / Files perangkat Anda.`);
        } catch (err) {
            console.error("PDF capture error:", err);
            setPdfDownloadNotice("Klik tombol Cetak A4 di samping lalu pilih Simpan sebagai PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [reportData, isGeneratingPdf]);

    useEffect(() => {
        if (!isLoading && reportData && shouldAutoDownload && !autoDownloadTriggeredRef.current) {
            autoDownloadTriggeredRef.current = true;
            const t = setTimeout(() => {
                handleDownloadPdfFile();
            }, 650);
            return () => clearTimeout(t);
        }
    }, [isLoading, reportData, shouldAutoDownload, handleDownloadPdfFile]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 gap-3 text-slate-700 font-sans">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
                <div className="text-sm font-bold">Memverifikasi Kode & 4 Digit Nomor HP Anda...</div>
            </div>
        );
    }

    if (!activeToken || accessError || !reportData) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
                <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 text-center space-y-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-[#1e3a8a]" />

                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1e3a8a] border border-blue-200 flex items-center justify-center mx-auto">
                        <KeyRound className="w-7 h-7" />
                    </div>

                    <div className="space-y-1">
                        <span className="px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 font-mono text-[10px] font-bold text-blue-900">
                            SMA MUHAMMADIYAH 18 JAKARTA
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900">
                            Portal Unduh Sertifikat Rapor SHTKA
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Masukkan <strong>Kode Verifikasi Rapor</strong> dan <strong>4 digit terakhir nomor HP terdaftar</strong> Anda untuk membuka serta mengunduh PDF rapor pribadi.
                        </p>
                    </div>

                    {accessError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 text-left">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                            <span>{accessError}</span>
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setShouldAutoDownload(true);
                            verifyAndLoadStudent(inputTokenCode, inputPhoneLast4);
                        }}
                        className="space-y-3.5 text-left"
                    >
                        <div>
                            <label className="block text-[11px] font-mono font-bold text-slate-700 mb-1">
                                1. KODE VERIFIKASI RAPOR (SHTKA-...):
                            </label>
                            <input
                                type="text"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                value={inputTokenCode}
                                onChange={(e) => setInputTokenCode(e.target.value.toUpperCase())}
                                placeholder="SHTKA-XXXXXX-XXXXX"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono font-bold text-sm text-center uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-mono font-bold text-slate-700 mb-1">
                                2. 4 DIGIT TERAKHIR NO. HP / WA TERDAFTAR:
                            </label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={4}
                                value={inputPhoneLast4}
                                onChange={(e) => setInputPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                placeholder="••••"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono font-black text-base text-center tracking-[0.45em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3.5 px-5 bg-[#1e3a8a] hover:bg-blue-900 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Buka & Unduh Rapor PDF</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>

                    <div className="pt-1">
                        <Link
                            href="/"
                            className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5"
                        >
                            <Home className="w-3.5 h-3.5" />
                            <span>Kembali ke Beranda</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const { stu } = reportData;
    const bindoCat = getOfficialTkaCategory(stu.bindoScore, "BINDO");
    const mtkCat = getOfficialTkaCategory(stu.mtkScore, "MTK");

    const cx = 135;
    const cy = 122;
    const maxR = 72;
    const axes = reportData.hexagonPoints;
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
        <div className="min-h-screen bg-slate-100 py-5 px-3 sm:px-6 font-sans text-slate-900">
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    @page { size: A4 portrait; margin: 8mm 12mm; }
                    @media print {
                        body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .no-print { display: none !important; }
                        .page-break-before { page-break-before: always !important; break-before: page !important; }
                    }
                    #shtka-page-1, #shtka-page-2 {
                        background-color: #ffffff !important;
                        color: #0f172a !important;
                    }
                `
                }}
            />

            {/* BAR AKSI UNDUH PDF */}
            <div className="no-print max-w-4xl mx-auto mb-4 bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                        <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            Sertifikat Hasil TKA SMP: {stu.name}
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-mono truncate">
                            {pdfDownloadNotice || "Dokumen terverifikasi resmi SMA Muhammadiyah 18 Jakarta"}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleDownloadPdfFile}
                        disabled={isGeneratingPdf}
                        className="px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60"
                    >
                        {isGeneratingPdf ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{isGeneratingPdf ? "Menyiapkan PDF..." : "Unduh Rapor PDF"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak A4</span>
                    </button>
                </div>
            </div>

            {/* LEMBAR RAPOR UTAMA A4 */}
            <div className="max-w-4xl mx-auto space-y-6 overflow-x-auto">
                {/* HALAMAN 1: SHTKA, GRAFIK HEKSAGONAL & KISI-KISI */}
                <div
                    id="shtka-page-1"
                    ref={page1Ref}
                    style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                    className="border border-slate-200 rounded-2xl print:border-none print:rounded-none p-5 sm:p-8 shadow-sm space-y-3"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
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
                            <div className="text-[9.5px] font-bold uppercase text-slate-800">
                                MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL
                            </div>
                            <div className="text-[9px] font-bold uppercase text-slate-700">
                                PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN
                            </div>
                            <div className="text-base sm:text-lg font-black uppercase text-[#1e3a8a]">
                                SMA MUHAMMADIYAH 18 JAKARTA
                            </div>
                            <div className="text-[9px] text-slate-600">
                                Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp. (021) 7235544
                            </div>
                        </div>
                        <div className="w-14 shrink-0" />
                    </div>
                    <div className="border-b-2 border-slate-900" />
                    <div className="border-b border-slate-900 !mt-0.5" />

                    <div className="text-center space-y-0.5 pt-1">
                        <h1 className="text-xs sm:text-sm font-black underline uppercase">
                            SERTIFIKAT HASIL & LAPORAN DIAGNOSTIK TRYOUT TKA SMP/MTs (SHTKA)
                        </h1>
                        <p className="text-[9.5px] font-mono text-slate-700">
                            Skala 0,00 - 100,00 Berbobot Tingkat Kesulitan Soal (Tanpa Batas Kelulusan Sekolah)
                        </p>
                    </div>

                    <div className="border border-slate-900 p-2.5 bg-slate-50 text-[10.5px]">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="py-0.5 w-[17%] text-slate-600">Nama Peserta</td>
                                    <td className="py-0.5 w-[36%] font-bold">: {stu.name}</td>
                                    <td className="py-0.5 w-[21%] text-slate-600">Peringkat Paralel</td>
                                    <td className="py-0.5 font-mono font-black text-blue-900 whitespace-nowrap">
                                        : Rank #{reportData.parallelRankOverall} dari {reportData.parallelTotal} Peserta
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-0.5 text-slate-600">Asal Sekolah</td>
                                    <td className="py-0.5 font-bold">: {stu.school} (Kelas {stu.grade})</td>
                                    <td className="py-0.5 text-slate-600">Peringkat Sekolah</td>
                                    <td className="py-0.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                        : Rank #{reportData.schoolRankOverall} dari {reportData.schoolTotal} Siswa
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
                                    {formatScoreID(stu.bindoScore)}
                                </td>
                                <td className="p-1.5 text-center font-mono text-slate-600 border-r border-slate-300">
                                    {formatScoreID(reportData.schoolAvgBindo)}
                                </td>
                                <td className="p-1.5 text-center font-bold border-r border-slate-300">{bindoCat.level}</td>
                                <td className="p-1.5 text-center font-mono font-bold border-r border-slate-300 whitespace-nowrap">
                                    #{reportData.schoolRankBindo} / {reportData.schoolTotal}
                                </td>
                                <td className="p-1.5 text-center font-mono font-black text-blue-950 whitespace-nowrap">
                                    #{reportData.parallelRankBindo} / {reportData.parallelTotal}
                                </td>
                            </tr>
                            <tr>
                                <td className="p-1.5 border-r border-slate-300">
                                    <div className="font-bold">2. Matematika (MTK)</div>
                                    <div className="text-[8.5px] text-slate-600">Bilangan, Aljabar, Geometri & Pengukuran, Data & Peluang</div>
                                </td>
                                <td className="p-1.5 text-center font-mono font-black text-emerald-800 border-r border-slate-300">
                                    {formatScoreID(stu.mtkScore)}
                                </td>
                                <td className="p-1.5 text-center font-mono text-slate-600 border-r border-slate-300">
                                    {formatScoreID(reportData.schoolAvgMtk)}
                                </td>
                                <td className="p-1.5 text-center font-bold border-r border-slate-300">{mtkCat.level}</td>
                                <td className="p-1.5 text-center font-mono font-bold border-r border-slate-300 whitespace-nowrap">
                                    #{reportData.schoolRankMtk} / {reportData.schoolTotal}
                                </td>
                                <td className="p-1.5 text-center font-mono font-black text-emerald-950 whitespace-nowrap">
                                    #{reportData.parallelRankMtk} / {reportData.parallelTotal}
                                </td>
                            </tr>
                            <tr className="bg-slate-50 font-bold">
                                <td className="p-1.5 border-r border-slate-300">RATA-RATA GABUNGAN (INDEKS PEMERINGKATAN)</td>
                                <td className="p-1.5 text-center font-mono font-black text-xs border-r border-slate-300">
                                    {formatScoreID(stu.score)}
                                </td>
                                <td className="p-1.5 text-center font-mono text-slate-700 border-r border-slate-300">
                                    {formatScoreID(reportData.schoolAvgOverall)}
                                </td>
                                <td className="p-1.5 text-center text-[9px] text-slate-500 border-r border-slate-300">Per Mata Uji</td>
                                <td className="p-1.5 text-center font-mono font-black text-amber-900 border-r border-slate-300 whitespace-nowrap">
                                    #{reportData.schoolRankOverall} / {reportData.schoolTotal}
                                </td>
                                <td className="p-1.5 text-center font-mono font-black text-blue-900 whitespace-nowrap">
                                    #{reportData.parallelRankOverall} / {reportData.parallelTotal}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="pdf-force-desktop-grid grid grid-cols-1 md:grid-cols-12 gap-3 border border-slate-300 rounded-xl p-3 bg-slate-50">
                        <div className="pdf-col-5 md:col-span-5 bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between space-y-1.5">
                            <div className="text-center">
                                <div className="text-[9px] font-mono font-black uppercase text-slate-900">
                                    GRAFIK HEKSAGONAL TREN KOMPETENSI
                                </div>
                                <div className="text-[8px] text-slate-500">Biru = Skor Anak • Oranye = Rerata Sekolah</div>
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
                                        return <polygon key={ring} points={pts} fill="none" stroke="#cbd5e1" strokeWidth="0.8" />;
                                    })}
                                    {axes.map((ax, i) => {
                                        const outer = getHexPoint(i, 100);
                                        return (
                                            <g key={ax.key}>
                                                <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#cbd5e1" strokeWidth="0.8" />
                                                <text x={outer.lx} y={outer.ly - 4} textAnchor="middle" fill="#1e293b" fontSize="8.5" fontWeight="700">
                                                    {ax.short}
                                                </text>
                                                <text x={outer.lx} y={outer.ly + 6} textAnchor="middle" fill="#1e40af" fontSize="8" fontWeight="800">
                                                    ({formatScoreID(ax.studentPct)})
                                                </text>
                                            </g>
                                        );
                                    })}
                                    <polygon points={schoolHexPoly} fill="rgba(245, 158, 11, 0.08)" stroke="#d97706" strokeWidth="1.2" strokeDasharray="3 2" />
                                    <polygon points={studentHexPoly} fill="rgba(29, 78, 216, 0.25)" stroke="#1d4ed8" strokeWidth="2" />
                                </svg>
                            </div>

                            <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-[8.5px] text-slate-700 leading-tight">
                                <div>• Keunggulan Utama: <strong>{reportData.strongestAxis?.key} ({formatScoreID(reportData.strongestAxis?.studentPct || 0)})</strong></div>
                                <div>• Prioritas Perbaikan: <strong>{reportData.weakestAxis?.key} ({formatScoreID(reportData.weakestAxis?.studentPct || 0)})</strong></div>
                            </div>
                        </div>

                        <div className="pdf-col-7 md:col-span-7 bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                <span className="text-[9px] font-mono font-black uppercase text-slate-900">
                                    GRAFIK CAPAIAN PER KISI-KISI & SUB-ELEMEN SOAL
                                </span>
                                <span className="text-[8px] font-mono text-slate-400">Skala 0,00 - 100,00</span>
                            </div>

                            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                                {reportData.sevenCompetencies.map((comp) => {
                                    const isMtk = comp.subject === "MTK";
                                    const cat = getOfficialTkaCategory(comp.pct, isMtk ? "MTK" : "BINDO");
                                    return (
                                        <div key={comp.code} className="space-y-0.5 text-[9px]">
                                            <div className="flex items-center justify-between font-mono">
                                                <span className="font-bold text-slate-800 truncate pr-2">
                                                    <span
                                                        style={{
                                                            backgroundColor: isMtk ? "#d1fae5" : "#dbeafe",
                                                            color: isMtk ? "#064e3b" : "#1e3a8a"
                                                        }}
                                                        className="inline-block px-1 rounded text-[7.5px] mr-1"
                                                    >
                                                        {comp.subject}
                                                    </span>
                                                    {comp.code}
                                                </span>
                                                <span className="font-black text-slate-900 shrink-0">
                                                    {comp.rawCorrect}/{comp.totalQ} Soal • <span className="text-blue-900">{formatScoreID(comp.pct)}</span> ({cat.level})
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${Math.max(3, Math.min(100, comp.pct))}%`,
                                                        backgroundColor: cat.barHex
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="text-[8px] text-slate-500 font-mono border-t border-slate-100 pt-1">
                                *Setiap kisi-kisi dihitung terpisah berdasarkan bobot kesulitan butir soal pada elemen terkait.
                            </div>
                        </div>
                    </div>

                    <div className="p-2.5 border border-slate-900 bg-white text-[9px] space-y-0.5">
                        <div className="font-bold font-mono text-[8.5px] uppercase flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-800" />
                            <span>SERTIFIKAT ELEKTRONIK TERVERIFIKASI — SMA MUHAMMADIYAH 18 JAKARTA</span>
                        </div>
                        <p className="text-[8px] text-slate-700 leading-tight">
                            Kode Verifikasi: <strong className="font-mono">{activeToken}</strong> • Dicetak pada {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}. Kategori capaian ditetapkan secara terpisah per mata uji sesuai standar TKA SMP/MTs.
                        </p>
                    </div>
                </div>

                {/* HALAMAN 2: LAMPIRAN ANALISIS BUTIR SOAL PESERTA */}
                {reportData.itemRows.length > 0 && (
                    <div
                        id="shtka-page-2"
                        ref={page2Ref}
                        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                        className="border border-slate-200 rounded-2xl print:border-none print:rounded-none p-5 sm:p-8 shadow-sm page-break-before space-y-3"
                    >
                        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                            <div>
                                <h2 className="text-xs sm:text-sm font-black uppercase">LAMPIRAN DIAGNOSTIK RINCIAN BUTIR SOAL PESERTA</h2>
                                <p className="text-[10px] font-mono text-slate-600">
                                    Peserta: <strong>{stu.name}</strong> ({stu.school})
                                </p>
                            </div>
                            <span className="text-[9.5px] font-mono font-bold px-2.5 py-1 bg-slate-100 border border-slate-300 rounded">
                                Total {reportData.itemRows.length} Butir
                            </span>
                        </div>

                        <div className="pdf-force-2col grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["BINDO", "MTK"] as const).map((subCode) => {
                                const rows = reportData.itemRows.filter((r) => r.subtes_code === subCode);
                                return (
                                    <div key={subCode} className="border border-slate-900 overflow-hidden">
                                        <div className="bg-slate-100 border-b border-slate-900 px-2.5 py-1.5 font-mono font-black text-[10px] uppercase flex justify-between">
                                            <span>{subCode === "BINDO" ? "1. BAHASA INDONESIA" : "2. MATEMATIKA"} ({rows.length} Soal)</span>
                                            <span>Benar: {rows.filter((r) => r.status === "BENAR").length} / {rows.length}</span>
                                        </div>
                                        <table className="w-full text-[9px] border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-400 font-mono">
                                                <tr>
                                                    <th className="p-1 border-r border-slate-300 text-center w-8">No</th>
                                                    <th className="p-1 border-r border-slate-300 text-left">Kisi-Kisi</th>
                                                    <th className="p-1 border-r border-slate-300 text-center w-12">Jwb</th>
                                                    <th className="p-1 border-r border-slate-300 text-center w-12">Kunci</th>
                                                    <th className="p-1 text-center w-16">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {rows.map((r) => (
                                                    <tr key={r.id}>
                                                        <td className="p-1 text-center font-mono font-bold border-r border-slate-200">{r.no_soal}</td>
                                                        <td className="p-1 border-r border-slate-200 truncate max-w-[140px]">{r.element}</td>
                                                        <td className="p-1 text-center font-mono font-bold border-r border-slate-200">{r.studentAnsLabel}</td>
                                                        <td className="p-1 text-center font-mono font-bold text-emerald-800 border-r border-slate-200">{r.keyLabel}</td>
                                                        <td className="p-1 text-center font-mono font-bold">
                                                            {r.status === "BENAR" ? (
                                                                <span className="text-emerald-700 inline-flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Benar</span>
                                                            ) : r.status === "KOSONG" ? (
                                                                <span className="text-slate-400 inline-flex items-center gap-0.5"><MinusCircle className="w-2.5 h-2.5" /> Kosong</span>
                                                            ) : (
                                                                <span className="text-rose-700 inline-flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5" /> Salah</span>
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

                {/* PRATINJAU BROSUR PPDB (HALAMAN 3 & 4 DI FILE PDF) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm page-break-before space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-900 pb-2.5">
                        <div>
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-amber-800">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> LAMPIRAN HALAMAN 3 & 4 PDF — SPMB / PPDB 2026–2027
                            </div>
                            <h2 className="text-xs sm:text-sm font-black uppercase text-[#1e3a8a]">
                                BROSUR RESMI PENERIMAAN PESERTA DIDIK BARU — SMA MUHAMMADIYAH 18 JAKARTA
                            </h2>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded self-start sm:self-auto">
                            WA Info PPDB: 0817-7995-1229
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex flex-col justify-between">
                            <img
                                src="/flyer-ppdb-depan.jpg"
                                alt="Brosur PPDB SMA Muhammadiyah 18 Jakarta Halaman Depan"
                                className="w-full h-auto object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                }}
                            />
                            <div className="p-2.5 bg-white border-t border-slate-200 text-center font-mono text-[10px] font-bold text-slate-700">
                                HALAMAN 3 PDF — BROSUR DEPAN (UTUH A4)
                            </div>
                        </div>

                        <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex flex-col justify-between">
                            <img
                                src="/flyer-ppdb-belakang.jpg"
                                alt="Brosur PPDB SMA Muhammadiyah 18 Jakarta Halaman Belakang"
                                className="w-full h-auto object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                }}
                            />
                            <div className="p-2.5 bg-white border-t border-slate-200 text-center font-mono text-[10px] font-bold text-slate-700">
                                HALAMAN 4 PDF — BROSUR BELAKANG (UTUH A4)
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PrivateStudentReportPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 text-sm font-bold text-slate-700">
                    Menyiapkan Rapor SHTKA...
                </div>
            }
        >
            <PrivateStudentReportContent />
        </Suspense>
    );
}