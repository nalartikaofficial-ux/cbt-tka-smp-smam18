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
    Download,
    School,
    Award
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
    schoolRankOverall?: number;
    schoolRankBindo?: number;
    schoolRankMtk?: number;
    schoolTotalFinished?: number;
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

// Kategori Capaian Resmi Kepmendikdasmen No. 56 Tahun 2026 (Skala 0,00 - 100,00)
function getKepmendikdasmen56Detail(score: number, subject: "BINDO" | "MTK" | "GENERAL" = "BINDO") {
    const num = Number(score) || 0;
    const isMtk = subject === "MTK";
    const baikCutOff = isMtk ? 56.67 : 76.67;
    const memadaiCutOff = isMtk ? 33.33 : 50.0;

    if (num >= 95.0) {
        return {
            level: "Istimewa",
            badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
            barColor: "bg-indigo-600",
            voucher: "Voucher Beasiswa Istimewa Bebas Biaya SPP / Uang Pangkal s.d. 100%",
            note: "Predikat khusus bagi peserta didik dengan penguasaan materi dan kemampuan bernalar sangat tinggi."
        };
    }
    if (num >= baikCutOff) {
        return {
            level: "Baik",
            badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
            barColor: "bg-emerald-600",
            voucher: "Voucher Beasiswa Jalur Prestasi Akademik PPDB (Potongan s.d. 50%)",
            note: "Pemahaman kuat dan konsisten; mampu menyelesaikan soal rutin maupun nonrutin dengan strategi efektif."
        };
    }
    if (num >= memadaiCutOff) {
        return {
            level: "Memadai",
            badge: "bg-blue-50 text-blue-800 border-blue-200",
            barColor: "bg-blue-600",
            voucher: "Potongan Khusus Biaya Masuk Gelombang Awal PPDB",
            note: "Memenuhi standar minimum; paham konsep dasar dan mampu menerapkannya pada masalah kontekstual umum."
        };
    }
    return {
        level: "Kurang",
        badge: "bg-rose-50 text-rose-800 border-rose-200",
        barColor: "bg-rose-500",
        voucher: "Program Klinik Belajar & Subsidi Registrasi Awal PPDB",
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

// Evaluasi kebenaran 1 butir soal untuk seorang siswa (mendukung PG_SEDERHANA, PGK_MCMA, PGK_KATEGORI)
function evaluateStudentItemFraction(q: any, userAns: any): number {
    if (userAns === undefined || userAns === null) return 0;
    const qType = q.type || "PG_SEDERHANA";
    const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

    if (qType === "PGK_MCMA") {
        const correctArr: number[] = Array.isArray(q.multiAnswers)
            ? q.multiAnswers
            : String(q.kunci || "A")
                .toUpperCase()
                .split(",")
                .map((k) => keyMap[k.trim()])
                .filter((n) => n !== undefined);
        const userArr: number[] = Array.isArray(userAns) ? userAns : [];
        const matchCount = userArr.filter((val) => correctArr.includes(val)).length;
        const wrongCount = userArr.filter((val) => !correctArr.includes(val)).length;
        return Math.max(0, (matchCount - wrongCount) / (correctArr.length || 1));
    }

    if (qType === "PGK_KATEGORI") {
        const optionsList: string[] = Array.isArray(q.options) && q.options.length > 0
            ? q.options.map((opt: any) => (typeof opt === "string" ? opt : String(opt?.text ?? "")))
            : [q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e].filter((v) => v && String(v).trim().length > 0);
        const catKeys = String(q.kunci || "").split("|").map((k) => k.trim());
        const statementsList = Array.isArray(q.statements) && q.statements.length > 0
            ? q.statements
            : optionsList.map((stmtText, sIdx) => ({
                id: `st_${sIdx}`,
                statement: stmtText,
                correctCategory: catKeys[sIdx] || "Benar"
            }));

        let correctCount = 0;
        statementsList.forEach((st: any, idx: number) => {
            const val = userAns?.[st.id] ?? userAns?.[`st_${idx}`];
            if (val === st.correctCategory) correctCount++;
        });
        return statementsList.length > 0 ? correctCount / statementsList.length : 0;
    }

    // PG_SEDERHANA
    const rawKey = String(q.kunci || "A").toUpperCase().trim();
    const targetIdx = typeof q.singleAnswer === "number" ? q.singleAnswer : (keyMap[rawKey] ?? 0);
    if (typeof userAns === "number") {
        return userAns === targetIdx ? 1 : 0;
    }
    if (typeof userAns === "string") {
        return userAns.toUpperCase().trim() === rawKey ? 1 : 0;
    }
    return 0;
}

export default function AdminAnalyticsTkaSmpPage() {
    const [students, setStudents] = useState<TkaStudentResult[]>([]);
    const [questionsBank, setQuestionsBank] = useState<any[]>([]);
    const [rawResultsList, setRawResultsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"prospek" | "sekolah" | "materi" | "butir">("prospek");
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
                        phone: normalizePhoneDigits(item.phone || ""),
                        name: String(item.name || "PESERTA SIMULASI").toUpperCase().trim(),
                        school: String(item.school || "SMP / MTs").toUpperCase().trim(),
                        grade: String(item.grade || "9").trim(),
                        status: String(item.status || (cleanScore > 0 ? "Selesai" : "Terdaftar")).trim(),
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

    // Hitung Peringkat Internal Masing-Masing Sekolah (BINDO, MTK, Rerata)
    const rankedStudentsWithSchoolPos = useMemo(() => {
        const bySchool: Record<string, TkaStudentResult[]> = {};
        students.forEach((s) => {
            const sch = s.school || "SMP / MTs";
            if (!bySchool[sch]) bySchool[sch] = [];
            bySchool[sch].push(s);
        });

        const rankLookup: Record<
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
                const idxOverall = sortedOverall.findIndex((x) => x.phone === st.phone);
                const idxBindo = sortedBindo.findIndex((x) => x.phone === st.phone);
                const idxMtk = sortedMtk.findIndex((x) => x.phone === st.phone);

                rankLookup[st.phone] = {
                    rankOverall: idxOverall >= 0 ? idxOverall + 1 : activePool.length,
                    rankBindo: idxBindo >= 0 ? idxBindo + 1 : activePool.length,
                    rankMtk: idxMtk >= 0 ? idxMtk + 1 : activePool.length,
                    schoolTotal: activePool.length
                };
            });
        });

        return [...students]
            .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
            .map((s) => ({
                ...s,
                schoolRankOverall: rankLookup[s.phone]?.rankOverall ?? 1,
                schoolRankBindo: rankLookup[s.phone]?.rankBindo ?? 1,
                schoolRankMtk: rankLookup[s.phone]?.rankMtk ?? 1,
                schoolTotalFinished: rankLookup[s.phone]?.schoolTotal ?? 1
            }));
    }, [students]);

    // Klasemen Peringkat Antar-Sekolah (Seluruh SMP/MTs Peserta)
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

    // Statistik Agregat Berdasarkan Kepmendikdasmen No. 56 Tahun 2026
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

        const countCategories = (scores: number[]) => ({
            istimewa: scores.filter((v) => v >= 95.0).length,
            baik: scores.filter((v) => v >= 76.67 && v < 95.0).length,
            memadai: scores.filter((v) => v >= 50.0 && v < 76.67).length,
            kurang: scores.filter((v) => v < 50.0).length
        });

        const bindoScores = finished.map((s) => Number(s.bindoScore) || 0);
        const mtkScores = finished.map((s) => Number(s.mtkScore) || 0);

        const bindoDist = {
            istimewa: bindoScores.filter((v) => v >= 95.0).length,
            baik: bindoScores.filter((v) => v >= 76.67 && v < 95.0).length,
            memadai: bindoScores.filter((v) => v >= 50.0 && v < 76.67).length,
            kurang: bindoScores.filter((v) => v < 50.0).length
        };

        const mtkDist = {
            istimewa: mtkScores.filter((v) => v >= 95.0).length,
            baik: mtkScores.filter((v) => v >= 56.67 && v < 95.0).length,
            memadai: mtkScores.filter((v) => v >= 33.33 && v < 56.67).length,
            kurang: mtkScores.filter((v) => v < 33.33).length
        };

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

    // Analisis Butir Soal & 7 Elemen Kompetensi Agregat
    const { itemAnalysisList, elementAnalysisList } = useMemo(() => {
        const scopedResults =
            selectedSchool === "ALL"
                ? rawResultsList
                : rawResultsList.filter((r) => String(r.school || "").toUpperCase().trim() === selectedSchool);

        const items = questionsBank.map((q: any, idx: number) => {
            const code = String(q.subtes_code || "").toUpperCase().includes("MTK") ? "MTK" : "BINDO";
            const qId = String(q.id);
            const element = mapQuestionToOfficialElement(code, q.materi);
            const rawKey = String(q.kunci || "A").toUpperCase().trim();

            let totalAttempt = 0;
            let correctCount = 0;
            const optionCounts = [0, 0, 0, 0, 0];

            scopedResults.forEach((res) => {
                const ansObj = res.answers || {};
                const userAns = ansObj[qId];
                if (userAns !== undefined && userAns !== null) {
                    totalAttempt++;
                    if (typeof userAns === "number" && userAns >= 0 && userAns <= 4) {
                        optionCounts[userAns]++;
                    } else if (Array.isArray(userAns)) {
                        userAns.forEach((optI: number) => {
                            if (optI >= 0 && optI <= 4) optionCounts[optI]++;
                        });
                    }
                    const frac = evaluateStudentItemFraction(q, userAns);
                    if (frac >= 0.99) correctCount++;
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

    // Analisis Kisi-Kisi Individual untuk Rapor Siswa yang Sedang Dibuka
    const selectedStudentDiagnostic = useMemo(() => {
        if (!selectedStudentForReport) return null;
        const stu = selectedStudentForReport;
        const cleanPhone = normalizePhoneDigits(stu.phone);

        // Cari record jawaban terbaru siswa di tka_results
        const matchedResult = rawResultsList.find(
            (r) => normalizePhoneDigits(r.phone || "") === cleanPhone
        );
        const studentAnswers = matchedResult?.answers || {};
        const hasAnswerData = Object.keys(studentAnswers).length > 0 && questionsBank.length > 0;

        // Hitung persentase tiap 7 kisi-kisi untuk anak ini
        const sevenCompetencyStats = OFFICIAL_COMPETENCIES.map((comp) => {
            const compQuestions = questionsBank.filter((q) => {
                const code = String(q.subtes_code || "").toUpperCase().includes("MTK") ? "MTK" : "BINDO";
                return mapQuestionToOfficialElement(code, q.materi) === comp.code;
            });

            const totalQ = compQuestions.length;
            let earnedWeighted = 0;
            let totalWeighted = 0;

            if (hasAnswerData && totalQ > 0) {
                compQuestions.forEach((q) => {
                    const w = Number(q.difficulty) || 1;
                    const userAns = studentAnswers[String(q.id)];
                    earnedWeighted += evaluateStudentItemFraction(q, userAns) * w;
                    totalWeighted += w;
                });
            }

            // Fallback proporsional berbasis skor subtes jika data answers lama belum tersimpan
            const fallbackPct = comp.subject === "MTK" ? stu.mtkScore : stu.bindoScore;
            const pct =
                hasAnswerData && totalWeighted > 0
                    ? Number(((earnedWeighted / totalWeighted) * 100).toFixed(2))
                    : Number(fallbackPct.toFixed(2));

            return {
                ...comp,
                totalQ,
                correctEquivalent: Number(earnedWeighted.toFixed(1)),
                pct
            };
        });

        // Hitung 6 Sumbu Heksagonal (Anak vs Rata-Rata Sekolah)
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
            const weightedSum = matchedComps.reduce((s, c) => s + c.pct * (c.totalQ || 1), 0);
            const totalWeight = matchedComps.reduce((s, c) => s + (c.totalQ || 1), 0);
            const studentPct = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(1)) : 0;
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
            sevenCompetencyStats,
            hexagonPoints,
            strongestAxis: sortedHex[0],
            weakestAxis: sortedHex[sortedHex.length - 1],
            schoolAvgBindo,
            schoolAvgMtk,
            schoolAvgOverall
        };
    }, [selectedStudentForReport, rawResultsList, questionsBank, students]);

    const handleExportCsvLeads = () => {
        if (filteredStudents.length === 0) return;
        const headers =
            "Rank Global,Asal Sekolah SMP/MTs,Rank Sekolah (Rerata),Rank Sekolah (BINDO),Rank Sekolah (MTK),Nama Peserta,Kelas,No. WhatsApp,Nilai BINDO,Kategori BINDO,Nilai MTK,Kategori MTK,Rerata Indeks,Status\n";
        const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

        const rows = filteredStudents
            .map((s, idx) => {
                const bCat = getKepmendikdasmen56Detail(s.bindoScore).level;
                const mCat = getKepmendikdasmen56Detail(s.mtkScore).level;
                return [
                    idx + 1,
                    esc(s.school),
                    esc(`#${s.schoolRankOverall} dari ${s.schoolTotalFinished}`),
                    esc(`#${s.schoolRankBindo} dari ${s.schoolTotalFinished}`),
                    esc(`#${s.schoolRankMtk} dari ${s.schoolTotalFinished}`),
                    esc(s.name),
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
        link.setAttribute("download", `Rapor_Peringkat_Siswa_TKA_SMP_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportCsvSchools = () => {
        if (schoolRankings.length === 0) return;
        const headers =
            "Peringkat Sekolah,Nama Sekolah (SMP/MTs),Peserta Selesai,Total Terdaftar,Rerata Bahasa Indonesia,Rerata Matematika,Rerata Gabungan Sekolah\n";
        const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

        const rows = schoolRankings
            .map((sch) =>
                [
                    sch.rank,
                    esc(sch.school),
                    sch.totalFinished,
                    sch.totalRegistered,
                    esc(formatScoreID(sch.avgBindo)),
                    esc(formatScoreID(sch.avgMtk)),
                    esc(formatScoreID(sch.avgOverall))
                ].join(",")
            )
            .join("\n");

        const blob = new Blob(["\ufeff", headers + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Peringkat_Antar_Sekolah_TKA_SMP_${new Date().toISOString().slice(0, 10)}.csv`);
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
              margin: 9mm 13mm 9mm 13mm;
            }
            @media print {
              html, body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                color: #000000 !important;
                font-family: 'Times New Roman', Times, serif !important;
                font-size: 10pt !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
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
                margin-top: 6px !important;
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
                            Pilih sekolah asal untuk melihat peringkat internal anak di sekolahnya, grafik diagnostik, atau cetak rapor per anak.
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
                            Kategori: <strong>{getKepmendikdasmen56Detail(overallStats.avgMtk, "MTK").level}</strong>
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

                {/* BAR NAVIGASI 4 TAB ANALISIS LENGKAP */}
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
                        <span>3. Analisis 7 Elemen Materi</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("butir")}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "butir" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>4. Analisis Butir Soal ({itemAnalysisList.length})</span>
                    </button>
                </div>

                {/* ============================================================== */}
                {/* TAB 1: RAPOR INDIVIDUAL ANAK & PERINGKAT INTERNAL SEKOLAH      */}
                {/* ============================================================== */}
                {activeTab === "prospek" && (
                    <div className="print-hidden space-y-5">
                        {/* Tabel Rapor Siswa & Peringkat Per Pelajaran di Sekolah Masing-Masing */}
                        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-8 space-y-4 shadow-2xs">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                                        Rapor Individual Siswa & Peringkat Internal Sekolah ({filteredStudents.length} Siswa)
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Klik <strong>Cetak Rapor & Grafik</strong> untuk mencetak SHTKA lengkap dengan Grafik Heksagonal 6 Kisi-Kisi, Grafik Batang, dan Peringkat Anak di Sekolahnya.
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
                                <table className="w-full text-left text-xs border-collapse min-w-[980px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600">
                                        <tr>
                                            <th className="p-3 w-12 text-center">Global</th>
                                            <th className="p-3">Nama Peserta & Asal SMP</th>
                                            <th className="p-3 text-center">Nilai BINDO</th>
                                            <th className="p-3 text-center">Rank BINDO<br /><span className="text-[9px] font-normal">(di Sekolahnya)</span></th>
                                            <th className="p-3 text-center">Nilai MTK</th>
                                            <th className="p-3 text-center">Rank MTK<br /><span className="text-[9px] font-normal">(di Sekolahnya)</span></th>
                                            <th className="p-3 text-center">Rata-Rata</th>
                                            <th className="p-3 text-center">Rank Rerata<br /><span className="text-[9px] font-normal">(di Sekolahnya)</span></th>
                                            <th className="p-3 text-right">Rapor Diagnostik</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {filteredStudents.map((s, idx) => {
                                            const bindoCat = getKepmendikdasmen56Detail(s.bindoScore);
                                            const mtkCat = getKepmendikdasmen56Detail(s.mtkScore);

                                            return (
                                                <tr key={`${s.phone}_${idx}`} className="hover:bg-slate-50/70">
                                                    <td className="p-3 text-center font-mono font-bold text-slate-500">#{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900">{s.name}</div>
                                                        <div className="text-[10.5px] font-semibold text-blue-800">{s.school}</div>
                                                        <div className="text-[10px] font-mono text-slate-400">WA: {s.phone}</div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="font-mono font-black text-blue-900 text-xs">
                                                            {formatScoreID(s.bindoScore)}
                                                        </div>
                                                        <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold border ${bindoCat.badge}`}>
                                                            {bindoCat.level}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-mono">
                                                        <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-black text-[11px]">
                                                            #{s.schoolRankBindo} <span className="font-normal text-[9.5px] text-slate-500">/ {s.schoolTotalFinished}</span>
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="font-mono font-black text-emerald-800 text-xs">
                                                            {formatScoreID(s.mtkScore)}
                                                        </div>
                                                        <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold border ${mtkCat.badge}`}>
                                                            {mtkCat.level}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-mono">
                                                        <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-black text-[11px]">
                                                            #{s.schoolRankMtk} <span className="font-normal text-[9.5px] text-slate-500">/ {s.schoolTotalFinished}</span>
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-black text-sm text-slate-900">
                                                        {formatScoreID(s.score)}
                                                    </td>
                                                    <td className="p-3 text-center font-mono">
                                                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-black text-[11px]">
                                                            #{s.schoolRankOverall} <span className="font-normal text-[9.5px] text-slate-500">/ {s.schoolTotalFinished}</span>
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => setSelectedStudentForReport(s)}
                                                            className="px-3 py-1.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                            <span>Cetak Rapor & Grafik</span>
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
                                    Pengaturan Pejabat Penandatangan Rapor SHTKA
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
                {/* TAB 2: KLASEMEN PERINGKAT ANTAR-SEKOLAH (SELURUH SMP/MTs)      */}
                {/* ============================================================== */}
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
                                        Pemeringkatan resmi seluruh SMP/MTs berdasarkan Rerata Gabungan Bahasa Indonesia & Matematika setelah ujian selesai.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportCsvSchools}
                                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Export Excel Sekolah</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="px-4 py-2 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Cetak Klasemen (A4)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Grafik Batang Perbandingan Rerata Antar-Sekolah */}
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

                            {/* Kop Cetak Klasemen Sekolah (Muncul saat Print A4) */}
                            <div className="hidden print:block text-center pb-2">
                                <h3 className="text-[11px] font-bold uppercase font-sans">
                                    MAJELIS PENDIDIKAN DASAR DAN MENENGAH PDM JAKARTA SELATAN
                                </h3>
                                <h1 className="text-xl font-black uppercase font-sans">SMA MUHAMMADIYAH 18 JAKARTA</h1>
                                <p className="text-[10px] text-slate-600 font-sans">
                                    KLASEMEN PERINGKAT ANTAR-SEKOLAH TRYOUT TKA JENJANG SMP TAHUN 2026
                                </p>
                                <div className="w-full kop-divider-thick mt-1.5" />
                                <div className="w-full kop-divider-thin mt-[2px]" />
                            </div>

                            {/* Tabel Klasemen Sekolah */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[740px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] text-slate-700">
                                        <tr>
                                            <th className="p-3.5 text-center w-24">Peringkat Sekolah</th>
                                            <th className="p-3.5">Nama Sekolah (SMP / MTs)</th>
                                            <th className="p-3.5 text-center">Peserta Selesai</th>
                                            <th className="p-3.5 text-center">Rerata Bahasa Indonesia</th>
                                            <th className="p-3.5 text-center">Rerata Matematika</th>
                                            <th className="p-3.5 text-center">Rata-Rata Sekolah</th>
                                            <th className="p-3.5 text-center">Predikat Sekolah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {schoolRankings.map((sch) => {
                                            const cat = getKepmendikdasmen56Detail(sch.avgOverall);
                                            return (
                                                <tr key={sch.school} className="hover:bg-slate-50/70">
                                                    <td className="p-3.5 text-center font-mono">
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
                                                    <td className="p-3.5 font-black text-slate-900">{sch.school}</td>
                                                    <td className="p-3.5 text-center font-mono text-slate-600">
                                                        <strong>{sch.totalFinished}</strong> / {sch.totalRegistered} Siswa
                                                    </td>
                                                    <td className="p-3.5 text-center font-mono font-bold text-blue-900">
                                                        {formatScoreID(sch.avgBindo)}
                                                    </td>
                                                    <td className="p-3.5 text-center font-mono font-bold text-emerald-800">
                                                        {formatScoreID(sch.avgMtk)}
                                                    </td>
                                                    <td className="p-3.5 text-center font-mono font-black text-sm text-slate-900">
                                                        {formatScoreID(sch.avgOverall)}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${cat.badge}`}>
                                                            {cat.level}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {schoolRankings.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="text-center py-8 text-slate-400">
                                                    Belum ada sekolah peserta yang terdaftar di database.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 3: ANALISIS 7 ELEMEN MATERI (PERKABAN NO. 047/H/AN/2025)   */}
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
                {/* TAB 4: ANALISIS BUTIR SOAL (ITEM ANALYSIS & DISTRACTOR)        */}
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

            {/* ======================================================================== */}
            {/* MODAL CETAK RAPOR INDIVIDUAL ANAK + PERINGKAT SEKOLAH + GRAFIK DIAGNOSTIK */}
            {/* ======================================================================== */}
            {selectedStudentForReport && selectedStudentDiagnostic && (() => {
                const stu = selectedStudentForReport;
                const diag = selectedStudentDiagnostic;
                const bindoScore = Number(stu.bindoScore ?? stu.score ?? 0);
                const mtkScore = Number(stu.mtkScore ?? stu.score ?? 0);
                const bindoCat = getKepmendikdasmen56Detail(bindoScore);
                const mtkCat = getKepmendikdasmen56Detail(mtkScore);
                const overallCat = getKepmendikdasmen56Detail(stu.score);
                const bestCat = bindoScore >= mtkScore ? bindoCat : mtkCat;
                const cleanPhone = normalizePhoneDigits(stu.phone);
                const voucherCode = `M18-SHTKA-${cleanPhone.slice(-4) || "2026"}-${Math.round(stu.score)}`;

                // Koordinat SVG Radar Heksagonal (6 Sumbu)
                const cx = 135;
                const cy = 122;
                const maxR = 76;
                const axes = diag.hexagonPoints;
                const getHexPoint = (idx: number, pctVal: number) => {
                    const angle = (Math.PI * 2 * idx) / 6 - Math.PI / 2;
                    const norm = Math.min(1, Math.max(0.08, pctVal / 100));
                    const r = norm * maxR;
                    return {
                        x: cx + r * Math.cos(angle),
                        y: cy + r * Math.sin(angle),
                        lx: cx + (maxR + 22) * Math.cos(angle),
                        ly: cy + (maxR + 18) * Math.sin(angle)
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
                    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl sm:rounded-3xl w-[97vw] sm:max-w-5xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 my-auto text-left">
                            {/* Toolbar Atas Modal */}
                            <div className="print-hidden p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between gap-2.5 bg-slate-50 rounded-t-2xl sm:rounded-t-3xl shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                                        <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                            Rapor Hasil & Diagnostik Kompetensi: {stu.name}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">
                                            {stu.school} • Rank Sekolah #{stu.schoolRankOverall} dari {stu.schoolTotalFinished} Siswa
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
                                        <span>Cetak Rapor Anak (PDF/A4)</span>
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

                            {/* LEMBAR CETAK RAPOR A4 */}
                            <div className="p-4 sm:p-8 overflow-y-auto flex-1 text-slate-900 space-y-4 print-sheet">
                                {/* Kop Surat */}
                                <div className="pb-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                                            <img src="/logo-timsim.jpg" alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1 text-center space-y-0.5">
                                            <h3 className="text-[10px] font-bold uppercase font-sans">
                                                MAJELIS PENDIDIKAN DASAR DAN MENENGAH PDM JAKARTA SELATAN
                                            </h3>
                                            <h1 className="text-base sm:text-xl font-black uppercase font-sans">
                                                SMA MUHAMMADIYAH 18 JAKARTA
                                            </h1>
                                            <p className="text-[9.5px] text-slate-600 font-sans">
                                                Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp. (021) 7235544
                                            </p>
                                        </div>
                                        <div className="w-14 shrink-0" />
                                    </div>
                                    <div className="w-full kop-divider-thick mt-1.5" />
                                    <div className="w-full kop-divider-thin mt-[2px]" />
                                </div>

                                {/* Judul Rapor */}
                                <div className="text-center space-y-0.5">
                                    <h2 className="text-xs sm:text-sm font-black underline uppercase">
                                        LAPORAN HASIL & DIAGNOSTIK KOMPETENSI TRYOUT TKA SMP/MTs (SHTKA)
                                    </h2>
                                    <p className="text-[10.5px] font-mono text-slate-700">
                                        Standar Kepmendikdasmen No. 56 Tahun 2026 & Perkaban No. 047/H/AN/2025
                                    </p>
                                </div>

                                {/* Identitas Siswa */}
                                <div className="border border-slate-900 p-2.5 bg-slate-50/50 text-[11px]">
                                    <table className="w-full">
                                        <tbody>
                                            <tr>
                                                <td className="py-0.5 w-[18%] text-slate-600">Nama Peserta</td>
                                                <td className="py-0.5 w-[37%] font-bold">: {stu.name}</td>
                                                <td className="py-0.5 w-[20%] text-slate-600">No. WhatsApp</td>
                                                <td className="py-0.5 font-mono font-bold">: {stu.phone}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-0.5 text-slate-600">Asal Sekolah</td>
                                                <td className="py-0.5 font-bold">: {stu.school} (Kelas {stu.grade})</td>
                                                <td className="py-0.5 text-slate-600">Kode Voucher</td>
                                                <td className="py-0.5 font-mono font-black text-blue-900">: {voucherCode}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Tabel Hasil Mata Uji & Peringkat Internal Sekolah */}
                                <table className="w-full text-[11px] border border-slate-900 text-left border-collapse">
                                    <thead className="bg-slate-100 border-b border-slate-900 font-mono text-[9.5px]">
                                        <tr>
                                            <th className="p-2 border-r border-slate-900">MATA UJI / KOMPONEN</th>
                                            <th className="p-2 border-r border-slate-900 text-center w-24">NILAI ANAK</th>
                                            <th className="p-2 border-r border-slate-900 text-center w-24">RERATA SEKOLAH</th>
                                            <th className="p-2 border-r border-slate-900 text-center w-28">KATEGORI</th>
                                            <th className="p-2 text-center w-36">PERINGKAT DI SEKOLAH</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300 font-medium">
                                        <tr>
                                            <td className="p-2 border-r border-slate-300">
                                                <div className="font-bold">1. Bahasa Indonesia (BINDO)</div>
                                                <div className="text-[9.5px] text-slate-600">Literasi Membaca Wacana Informasi & Sastra</div>
                                            </td>
                                            <td className="p-2 text-center font-mono font-black text-blue-900 border-r border-slate-300">
                                                {formatScoreID(bindoScore)}
                                            </td>
                                            <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-300">
                                                {formatScoreID(diag.schoolAvgBindo)}
                                            </td>
                                            <td className="p-2 text-center font-bold border-r border-slate-300">{bindoCat.level}</td>
                                            <td className="p-2 text-center font-mono font-black text-blue-950">
                                                Peringkat #{stu.schoolRankBindo} dari {stu.schoolTotalFinished}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border-r border-slate-300">
                                                <div className="font-bold">2. Matematika (MTK)</div>
                                                <div className="text-[9.5px] text-slate-600">Numerasi, Aljabar, Geometri & Data Peluang</div>
                                            </td>
                                            <td className="p-2 text-center font-mono font-black text-emerald-800 border-r border-slate-300">
                                                {formatScoreID(mtkScore)}
                                            </td>
                                            <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-300">
                                                {formatScoreID(diag.schoolAvgMtk)}
                                            </td>
                                            <td className="p-2 text-center font-bold border-r border-slate-300">{mtkCat.level}</td>
                                            <td className="p-2 text-center font-mono font-black text-emerald-950">
                                                Peringkat #{stu.schoolRankMtk} dari {stu.schoolTotalFinished}
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-50 font-bold">
                                            <td className="p-2 border-r border-slate-300">
                                                RATA-RATA GABUNGAN (INDEKS TKA SMP)
                                            </td>
                                            <td className="p-2 text-center font-mono font-black text-sm text-slate-900 border-r border-slate-300">
                                                {formatScoreID(stu.score)}
                                            </td>
                                            <td className="p-2 text-center font-mono text-slate-700 border-r border-slate-300">
                                                {formatScoreID(diag.schoolAvgOverall)}
                                            </td>
                                            <td className="p-2 text-center border-r border-slate-300">{overallCat.level}</td>
                                            <td className="p-2 text-center font-mono font-black text-amber-900">
                                                Peringkat #{stu.schoolRankOverall} dari {stu.schoolTotalFinished}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* GRAFIK DIAGNOSTIK: KIRI = RADAR HEKSAGONAL (6 KISI-KISI), KANAN = BAR CHART PERSENTASE PER KISI-KISI */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 border border-slate-300 rounded-2xl p-3 bg-slate-50/40">
                                    {/* KIRI: GRAFIK HEKSAGONAL 6 KOMPETENSI */}
                                    <div className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between space-y-1.5">
                                        <div className="text-center">
                                            <div className="text-[9.5px] font-mono font-black uppercase text-slate-900">
                                                GRAFIK HEKSAGONAL TREN KOMPETENSI
                                            </div>
                                            <div className="text-[8.5px] text-slate-500">
                                                Biru = Capaian Anak (%) • Oranye = Rerata Sekolah
                                            </div>
                                        </div>

                                        <div className="flex justify-center">
                                            <svg viewBox="0 0 270 245" className="w-full max-w-[235px] h-auto overflow-visible">
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
                                                                {ring}%
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
                                                                ({ax.studentPct}%)
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

                                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[9px] text-slate-700 leading-snug">
                                            <div>
                                                • Potensi Tertinggi: <strong>{diag.strongestAxis?.key} ({diag.strongestAxis?.studentPct}%)</strong>
                                            </div>
                                            <div>
                                                • Prioritas Penguatan: <strong>{diag.weakestAxis?.key} ({diag.weakestAxis?.studentPct}%)</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KANAN: GRAFIK BATANG PERSENTASE PER KISI-KISI SOAL */}
                                    <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between space-y-2">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                            <span className="text-[9.5px] font-mono font-black uppercase text-slate-900">
                                                GRAFIK PERSENTASE CAPAIAN PER KISI-KISI SOAL
                                            </span>
                                            <span className="text-[8.5px] font-mono text-slate-400">
                                                {diag.hasAnswerData ? "Berbasis Butir Soal" : "Estimasi Skor Subtes"}
                                            </span>
                                        </div>

                                        <div className="space-y-2 flex-1 justify-center flex flex-col">
                                            {diag.sevenCompetencyStats.map((comp) => {
                                                const isMtk = comp.subject === "MTK";
                                                const barColor =
                                                    comp.pct >= 76.67
                                                        ? "bg-emerald-600"
                                                        : comp.pct >= 50
                                                            ? isMtk
                                                                ? "bg-teal-600"
                                                                : "bg-blue-600"
                                                            : "bg-rose-500";

                                                return (
                                                    <div key={comp.code} className="space-y-0.5 text-[9.5px]">
                                                        <div className="flex items-center justify-between font-mono">
                                                            <span className="font-bold text-slate-800 truncate pr-2">
                                                                <span
                                                                    className={`inline-block px-1 rounded text-[8px] mr-1 ${isMtk
                                                                        ? "bg-emerald-100 text-emerald-900"
                                                                        : "bg-blue-100 text-blue-900"
                                                                        }`}
                                                                >
                                                                    {comp.subject}
                                                                </span>
                                                                {comp.code}
                                                            </span>
                                                            <span className="font-black text-slate-900 shrink-0">
                                                                {diag.hasAnswerData && comp.totalQ > 0
                                                                    ? `${comp.correctEquivalent}/${comp.totalQ} (${comp.pct}%)`
                                                                    : `${comp.pct}%`}
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                                                            <div
                                                                className={`h-full rounded-full ${barColor}`}
                                                                style={{ width: `${Math.max(4, Math.min(100, comp.pct))}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="text-[8.5px] text-slate-500 font-mono border-t border-slate-100 pt-1">
                                            *Keterangan warna batang: Hijau (≥76,67% Istimewa), Biru/Teal (50–76,66% Memadai), Merah (≤50% Kurang).
                                        </div>
                                    </div>
                                </div>

                                {/* Rekomendasi Jalur Prestasi PPDB */}
                                <div className="p-2.5 border border-slate-900 bg-white text-[10px] space-y-1">
                                    <div className="font-bold font-mono text-[9.5px] uppercase">
                                        REKOMENDASI JALUR PRESTASI PPDB SMA MUHAMMADIYAH 18 JAKARTA:
                                    </div>
                                    <p className="text-[9px] text-slate-600 leading-snug">
                                        *Acuan Resmi TKA SMP (Skala 0,00–100,00 berbobot tingkat kesulitan soal; tanpa batas kelulusan sekolah):{" "}
                                        <strong>Bahasa Indonesia:</strong> Istimewa (≥95,00), Baik (76,67–94,99), Memadai (50,00–76,66), Kurang (≤50,00) |{" "}
                                        <strong>Matematika:</strong> Istimewa (≥95,00), Baik (56,67–94,99), Memadai (33,33–56,66), Kurang (≤33,33).
                                    </p>
                                </div>

                                {/* Tanda Tangan Pejabat */}
                                <div className="pt-3 grid grid-cols-2 text-[11px] text-center border-t border-slate-300">
                                    <div>
                                        <p>Mengetahui,</p>
                                        <p className="font-semibold">Kepala SMA Muhammadiyah 18 Jakarta</p>
                                        <div className="h-12" />
                                        <p className="font-bold underline">{officials.kepalaSekolahNama}</p>
                                        <p className="text-[9.5px] font-mono">NBM. {officials.kepalaSekolahNbm}</p>
                                    </div>
                                    <div>
                                        <p>Jakarta, {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
                                        <p className="font-semibold">{officials.koordinatorJabatan}</p>
                                        <div className="h-12" />
                                        <p className="font-bold underline">{officials.koordinatorNama}</p>
                                        <p className="text-[9.5px] font-mono">NBM/NIP. {officials.koordinatorNbm}</p>
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