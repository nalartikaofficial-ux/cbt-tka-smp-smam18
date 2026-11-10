"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Search,
    BookOpen,
    Calculator,
    Plus,
    Trash2,
    Edit3,
    CheckCircle2,
    FileText,
    Save,
    RefreshCw,
    FolderOpen,
    Upload,
    Download,
    Eye,
    X,
    FileSpreadsheet,
    FileCode,
    Sparkles,
    ClipboardPaste,
    Check
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { tkaQuestions as defaultQuestions } from "@/data/questions";

export interface TKAPartQuestion {
    id: string | number;
    subject: "Bahasa Indonesia" | "Matematika";
    subtest: "LIT_INDO" | "PM";
    type: "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI";
    difficulty: number;
    stimulus?: string;
    question: string;
    options?: string[];
    singleAnswer?: number;
    multiAnswers?: number[];
    statements?: { id: string; statement: string; correctCategory: "Benar" | "Salah" | "Sesuai" | "Tidak Sesuai" }[];
    explanation?: string;
}

function RenderLatex({ content = "" }: { content: string }) {
    const safeText = String(content ?? "");
    if (!safeText.trim()) return null;

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
                                className="block my-2 overflow-x-auto py-1"
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
                                className="inline-block px-0.5 align-middle"
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

export default function BankSoalAdminPage() {
    const router = useRouter();
    const csvInputRef = useRef<HTMLInputElement>(null);

    const [questions, setQuestions] = useState<TKAPartQuestion[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubtest, setSelectedSubtest] = useState<"ALL" | "Bahasa Indonesia" | "Matematika">("ALL");
    const [selectedType, setSelectedType] = useState<"ALL" | "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI">("ALL");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [showWordPasteModal, setShowWordPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [selectedQuestionForPreview, setSelectedQuestionForPreview] = useState<TKAPartQuestion | null>(null);

    const initialFormState: TKAPartQuestion = {
        id: "",
        subject: "Bahasa Indonesia",
        subtest: "LIT_INDO",
        type: "PG_SEDERHANA",
        difficulty: 2,
        stimulus: "",
        question: "",
        options: ["", "", "", ""],
        singleAnswer: 0,
        multiAnswers: [0],
        statements: [
            { id: "s1", statement: "", correctCategory: "Benar" },
            { id: "s2", statement: "", correctCategory: "Salah" }
        ],
        explanation: ""
    };

    const [formData, setFormData] = useState<TKAPartQuestion>(initialFormState);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("tka_bank_soal");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setQuestions(parsed);
                        return;
                    }
                } catch { }
            }
            setQuestions((defaultQuestions as any) || []);
        }
    }, []);

    const saveQuestionsToStorage = (updated: TKAPartQuestion[]) => {
        setQuestions(updated);
        if (typeof window !== "undefined") {
            localStorage.setItem("tka_bank_soal", JSON.stringify(updated));
        }
    };

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            const matchSearch =
                (q.question && q.question.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (q.stimulus && q.stimulus.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchSub = selectedSubtest === "ALL" || q.subject === selectedSubtest;
            const matchType = selectedType === "ALL" || q.type === selectedType;

            return matchSearch && matchSub && matchType;
        });
    }, [questions, searchQuery, selectedSubtest, selectedType]);

    const stats = useMemo(() => {
        const total = questions.length;
        const indo = questions.filter((q) => q.subject === "Bahasa Indonesia" || q.subtest === "LIT_INDO").length;
        const math = questions.filter((q) => q.subject === "Matematika" || q.subtest === "PM").length;
        return { total, indo, math };
    }, [questions]);

    // 1. UNDUH TEMPLATE CSV
    const handleDownloadCsvTemplate = () => {
        const headers = "subtest,type,difficulty,stimulus,question,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,kunci,pembahasan\n";
        const sampleRow1 = `"Bahasa Indonesia","PG_SEDERHANA",1,"Wacana tentang ekosistem mangrove di pesisir utara Jakarta...","Fungsi utama mangrove terhadap iklim global adalah...","Mencegah abrasi","Menyerap karbon biru 5x lebih tinggi","Tempat hidup kepiting","Menahan intrusi air laut","","B","Karbon biru menyerap emisi karbon secara efektif."\n`;
        const sampleRow2 = `"Matematika","PG_SEDERHANA",2,"Koperasi memberikan diskon bertingkat 20% dan 10%...","Jika harga barang Rp300.000, berapa harga bayar setelah kedua diskon?","Rp 210.000","Rp 216.000","Rp 220.000","Rp 240.000","","B","300.000 x 0.8 = 240.000, lalu 240.000 x 0.9 = 216.000."\n`;

        const blob = new Blob([headers + sampleRow1 + sampleRow2], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "template_bank_soal_tka_smp.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 2. PARSER UNGGAH FILE CSV
    const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const text = evt.target?.result as string;
                const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
                if (lines.length <= 1) {
                    alert("File CSV kosong atau hanya berisi baris header!");
                    return;
                }

                const newParsedQuestions: TKAPartQuestion[] = [];
                // Loop mulai baris kedua (skip header)
                for (let i = 1; i < lines.length; i++) {
                    // Regex pemisah CSV dengan aman (menangani tanda petik ganda)
                    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map((val) => val.replace(/^"|"$/g, "").trim()) || [];
                    if (row.length < 5) continue;

                    const rawSubtest = row[0] || "Bahasa Indonesia";
                    const isMath = rawSubtest.toLowerCase().includes("matematika") || rawSubtest.toLowerCase().includes("pm");
                    const subject = isMath ? "Matematika" : "Bahasa Indonesia";
                    const subtest = isMath ? "PM" : "LIT_INDO";
                    const type = (row[1] as any) || "PG_SEDERHANA";
                    const difficulty = Number(row[2]) || 2;
                    const stimulus = row[3] || "";
                    const question = row[4] || "";

                    const options: string[] = [];
                    if (row[5]) options.push(row[5]);
                    if (row[6]) options.push(row[6]);
                    if (row[7]) options.push(row[7]);
                    if (row[8]) options.push(row[8]);
                    if (row[9]) options.push(row[9]);

                    const rawKey = (row[10] || "A").trim().toUpperCase();
                    const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
                    const singleAnswer = keyMap[rawKey] ?? 0;
                    const explanation = row[11] || "";

                    newParsedQuestions.push({
                        id: `CSV_${Date.now()}_${i}`,
                        subject,
                        subtest,
                        type,
                        difficulty,
                        stimulus,
                        question,
                        options: options.length > 0 ? options : ["A", "B", "C", "D"],
                        singleAnswer,
                        explanation
                    });
                }

                if (newParsedQuestions.length > 0) {
                    const updated = [...newParsedQuestions, ...questions];
                    saveQuestionsToStorage(updated);
                    alert(`Berhasil mengimpor ${newParsedQuestions.length} butir soal dari berkas CSV!`);
                } else {
                    alert("Gagal membaca struktur butir soal di file CSV. Pastikan kolom sesuai format template.");
                }
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan saat memproses file CSV.");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    // 3. PARSER SALIN-TEMPEL DARI NASKAH WORD (FORMAT MODEL SNBT)
    const handleParseWordPaste = () => {
        if (!pasteText.trim()) {
            alert("Kotak teks naskah masih kosong!");
            return;
        }

        try {
            const blocks = pasteText.split(/(?=\d+\.\s+)/g).filter((b) => b.trim().length > 0);
            const parsedFromWord: TKAPartQuestion[] = [];

            let currentGlobalSubtest: "Bahasa Indonesia" | "Matematika" = "Bahasa Indonesia";
            let currentGlobalStimulus = "";

            blocks.forEach((block, idx) => {
                // Cek apakah ada tag subtes sebelum nomor soal
                if (block.toUpperCase().includes("[SUBTES: MATEMATIKA]")) {
                    currentGlobalSubtest = "Matematika";
                } else if (block.toUpperCase().includes("[SUBTES: BAHASA INDONESIA]")) {
                    currentGlobalSubtest = "Bahasa Indonesia";
                }

                // Cek apakah ada tag stimulus
                const stimulusMatch = block.match(/\[STIMULUS\]([\s\S]*?)\[\/STIMULUS\]/i);
                if (stimulusMatch && stimulusMatch[1]) {
                    currentGlobalStimulus = stimulusMatch[1].trim();
                }

                // Ambil Pertanyaan
                const qMatch = block.match(/\d+\.\s+([\s\S]*?)(?=(?:^[A-E]\.|\n[A-E]\.|\nKUNCI:))/m);
                const questionText = qMatch ? qMatch[1].trim() : "";

                // Ambil Opsi A, B, C, D, E
                const optA = block.match(/(?:^|\n)A\.\s*([\s\S]*?)(?=(?:\n[B-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const optB = block.match(/(?:^|\n)B\.\s*([\s\S]*?)(?=(?:\n[C-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const optC = block.match(/(?:^|\n)C\.\s*([\s\S]*?)(?=(?:\n[D-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const optD = block.match(/(?:^|\n)D\.\s*([\s\S]*?)(?=(?:\nE\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const optE = block.match(/(?:^|\n)E\.\s*([\s\S]*?)(?=(?:\nKUNCI:|$))/)?.[1]?.trim() || "";

                const options = [optA, optB, optC, optD].filter((o) => o.length > 0);
                if (optE) options.push(optE);

                // Ambil Kunci Jawaban
                const keyMatch = block.match(/KUNCI:\s*([A-E])/i);
                const keyChar = keyMatch ? keyMatch[1].toUpperCase() : "A";
                const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
                const singleAnswer = keyMap[keyChar] ?? 0;

                // Ambil Pembahasan
                const expMatch = block.match(/PEMBAHASAN:\s*([\s\S]*?)$/i);
                const explanation = expMatch ? expMatch[1].trim() : "";

                if (questionText && options.length >= 2) {
                    parsedFromWord.push({
                        id: `WORD_${Date.now()}_${idx}`,
                        subject: currentGlobalSubtest,
                        subtest: currentGlobalSubtest === "Matematika" ? "PM" : "LIT_INDO",
                        type: "PG_SEDERHANA",
                        difficulty: 2,
                        stimulus: currentGlobalStimulus,
                        question: questionText,
                        options,
                        singleAnswer,
                        explanation
                    });
                }
            });

            if (parsedFromWord.length > 0) {
                const updated = [...parsedFromWord, ...questions];
                saveQuestionsToStorage(updated);
                setShowWordPasteModal(false);
                setPasteText("");
                alert(`Berhasil mengimpor ${parsedFromWord.length} butir soal dari salinan naskah Word!`);
            } else {
                alert("Format naskah tidak terdeteksi. Pastikan menggunakan format penomoran standar (1. Pertanyaan, A. Opsi, B. Opsi, KUNCI: X).");
            }
        } catch (err) {
            console.error(err);
            alert("Terjadi kesalahan saat memproses naskah Word.");
        }
    };

    const handleDeleteQuestion = (id: string | number) => {
        if (confirm("Hapus butir soal ini dari bank soal?")) {
            const updated = questions.filter((q) => q.id !== id);
            saveQuestionsToStorage(updated);
        }
    };

    const handleResetToDefault = () => {
        if (confirm("Kembalikan seluruh bank soal ke naskah asli bawaan sistem TKA SMP?")) {
            saveQuestionsToStorage((defaultQuestions as any) || []);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
            {/* HEADER ATAS */}
            <header className="bg-white border-b border-slate-200 py-3.5 px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                            title="Kembali ke Bilik Admin"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src="/logo-timsim.jpg"
                                alt="Logo SMA Muhammadiyah 18"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                }}
                            />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                                MANAJEMEN BANK SOAL TKA SMP
                            </h1>
                            <p className="text-[11px] text-slate-500">
                                Penyusunan Naskah Asesmen Massal &bull; SMA Muhammadiyah 18 Jakarta
                            </p>
                        </div>
                    </div>

                    {/* AKSI CEPAT IMPOR MASSAL */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadCsvTemplate}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Unduh Format Excel/CSV"
                        >
                            <Download className="w-3.5 h-3.5 text-blue-700" />
                            <span className="hidden sm:inline">Template CSV</span>
                        </button>

                        <button
                            onClick={() => csvInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Unggah Soal Sekaligus Lewat CSV/Excel"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Unggah CSV</span>
                        </button>
                        <input
                            type="file"
                            ref={csvInputRef}
                            onChange={handleUploadCsv}
                            accept=".csv"
                            className="hidden"
                        />

                        <button
                            onClick={() => setShowWordPasteModal(true)}
                            className="px-3 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Salin-Tempel Teks Naskah Word Model SNBT"
                        >
                            <ClipboardPaste className="w-3.5 h-3.5" />
                            <span>Impor Teks Word</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* KONTEN UTAMA */}
            <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
                {/* METRIK BANK SOAL */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] font-bold uppercase">
                            <span>TOTAL BANK SOAL</span>
                            <FolderOpen className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="text-3xl font-black text-slate-900 font-mono">{stats.total}</div>
                        <p className="text-[11px] text-slate-500">Butir soal terdaftar aktif di sistem</p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-blue-600 font-mono text-[10px] font-bold uppercase">
                            <span>LITERASI B. INDONESIA</span>
                            <BookOpen className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-3xl font-black text-blue-700 font-mono">{stats.indo}</div>
                        <p className="text-[11px] text-slate-500">Wacana Informasi &amp; Sastra</p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-emerald-600 font-mono text-[10px] font-bold uppercase">
                            <span>PENALARAN MATEMATIKA</span>
                            <Calculator className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-3xl font-black text-emerald-700 font-mono">{stats.math}</div>
                        <p className="text-[11px] text-slate-500">Numerasi 4 Elemen Fase D</p>
                    </div>
                </div>

                {/* TABEL BANK SOAL */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Daftar Butir Soal Terpasang</h2>
                            <p className="text-xs text-slate-500">Soal-soal ini langsung disajikan di bilik ujian siswa secara otomatis.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Cari soal / wacana..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600"
                                />
                            </div>

                            <select
                                value={selectedSubtest}
                                onChange={(e) => setSelectedSubtest(e.target.value as any)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none"
                            >
                                <option value="ALL">Semua Subtes</option>
                                <option value="Bahasa Indonesia">Literasi B. Indonesia</option>
                                <option value="Matematika">Penalaran Matematika</option>
                            </select>

                            <button
                                onClick={handleResetToDefault}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                title="Reset ke naskah asli bawaan"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-600">
                                <tr>
                                    <th className="p-3.5 w-12 text-center">No</th>
                                    <th className="p-3.5 w-36">Subtes</th>
                                    <th className="p-3.5 w-40">Bentuk Soal</th>
                                    <th className="p-3.5">Konten Soal &amp; Stimulus</th>
                                    <th className="p-3.5 w-24 text-center">Kunci</th>
                                    <th className="p-3.5 w-24 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {filteredQuestions.map((q, idx) => {
                                    const isMath = q.subject === "Matematika" || q.subtest === "PM";
                                    return (
                                        <tr key={q.id || idx} className="hover:bg-slate-50 transition">
                                            <td className="p-3.5 text-center font-mono font-bold text-blue-700">#{idx + 1}</td>
                                            <td className="p-3.5">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border ${isMath
                                                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                            : "bg-blue-50 text-blue-800 border-blue-200"
                                                        }`}
                                                >
                                                    {q.subject || (isMath ? "Matematika" : "Bahasa Indonesia")}
                                                </span>
                                            </td>
                                            <td className="p-3.5 font-mono text-[11px] text-slate-600">{q.type}</td>
                                            <td className="p-3.5 space-y-1 max-w-md">
                                                {q.stimulus && (
                                                    <div className="text-[11px] text-slate-500 italic line-clamp-1">
                                                        Stimulus: {q.stimulus}
                                                    </div>
                                                )}
                                                <div className="font-semibold text-slate-900 line-clamp-2">
                                                    <RenderLatex content={q.question} />
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                                                {q.type === "PG_SEDERHANA" && ["A", "B", "C", "D", "E"][q.singleAnswer ?? 0]}
                                                {q.type === "PGK_MCMA" && `${(q.multiAnswers || []).length} Opsi`}
                                                {q.type === "PGK_KATEGORI" && `${(q.statements || []).length} Matriks`}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedQuestionForPreview(q);
                                                            setPreviewMode(true);
                                                        }}
                                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                                        title="Pratinjau Soal"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                        className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                                                        title="Hapus Soal"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredQuestions.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                                            Tidak ada butir soal yang sesuai filter pencarian.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ========================================================================= */}
            {/* MODAL SALIN-TEMPEL NASKAH TEKS DARI WORD (MODEL SNBT)                      */}
            {/* ========================================================================= */}
            {showWordPasteModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                    <ClipboardPaste className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900">Salin-Tempel Naskah Soal Word (Model SNBT)</h3>
                                    <p className="text-[11px] text-slate-500">Tempel teks naskah soal langsung dari dokumen Microsoft Word.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWordPasteModal(false)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 space-y-1">
                            <strong>Panduan Format Teks:</strong>
                            <p>Gunakan tag <code>[SUBTES: BAHASA INDONESIA]</code> atau <code>[SUBTES: MATEMATIKA]</code>, tag wacana <code>[STIMULUS]...[/STIMULUS]</code>, nomor soal <code>1. Pertanyaan</code>, opsi <code>A.</code>, <code>B.</code>, dan baris <code>KUNCI: B</code>.</p>
                        </div>

                        <textarea
                            rows={12}
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder={`[SUBTES: BAHASA INDONESIA]\n[STIMULUS]\nHutan mangrove memiliki fungsi penting...\n[/STIMULUS]\n1. Fungsi utama mangrove adalah...\nA. Menahan intrusi\nB. Menyerap karbon\nC. Tempat ikan\nD. Sumber kayu\nKUNCI: B\nPEMBAHASAN: Karbon diserap 5x lebih tinggi.\n\n[SUBTES: MATEMATIKA]\n2. Nilai $x$ dari $2x + 6 = 16$ adalah...\nA. 3\nB. 5\nC. 7\nD. 9\nKUNCI: B`}
                            className="w-full p-3.5 rounded-2xl border border-slate-200 font-mono text-xs outline-none focus:border-blue-600"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowWordPasteModal(false)}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleParseWordPaste}
                                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" />
                                <span>Proses &amp; Masukkan ke Bank Soal</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PRATINJAU SOAL */}
            {previewMode && selectedQuestionForPreview && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                Pratinjau Layar Siswa &bull; {selectedQuestionForPreview.subject}
                            </span>
                            <button
                                onClick={() => setPreviewMode(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {selectedQuestionForPreview.stimulus && (
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                                <div className="text-[10px] font-mono font-bold text-blue-700 uppercase mb-1">
                                    STIMULUS WACANA:
                                </div>
                                {selectedQuestionForPreview.stimulus}
                            </div>
                        )}

                        <div className="text-sm font-bold text-slate-900 leading-snug">
                            <RenderLatex content={selectedQuestionForPreview.question} />
                        </div>

                        {selectedQuestionForPreview.options && (
                            <div className="space-y-2 pt-2">
                                {selectedQuestionForPreview.options.map((opt, i) => (
                                    <div
                                        key={i}
                                        className="p-3 rounded-xl border border-slate-200 text-xs flex items-center gap-3 bg-white"
                                    >
                                        <span className="w-6 h-6 rounded-lg bg-slate-100 font-mono font-bold flex items-center justify-center shrink-0">
                                            {["A", "B", "C", "D", "E"][i]}
                                        </span>
                                        <span><RenderLatex content={opt} /></span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedQuestionForPreview.explanation && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 mt-2">
                                <strong>Pembahasan:</strong> {selectedQuestionForPreview.explanation}
                            </div>
                        )}

                        <button
                            onClick={() => setPreviewMode(false)}
                            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                        >
                            Tutup Pratinjau
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}