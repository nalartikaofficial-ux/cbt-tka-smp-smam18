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
    AlertTriangle,
    HelpCircle,
    Image as ImageIcon,
    CheckSquare,
    ListOrdered,
    FileSpreadsheet,
    Check,
    Layers,
    Sparkles
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { tkaQuestions as defaultQuestions } from "@/data/questions";

// Tipe Data Butir Soal TKA SMP
export interface TKAPartQuestion {
    id: string | number;
    subject: "Bahasa Indonesia" | "Matematika";
    subtest: "LIT_INDO" | "PM";
    type: "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI";
    difficulty: number; // 1: Mudah, 2: Sedang, 3: Sulit
    stimulus?: string;
    question: string;
    imageUrl?: string;
    imagePosition?: "above" | "below";
    options?: string[]; // Untuk PG Sederhana & PGK MCMA
    singleAnswer?: number; // Index 0-4 (A-E)
    multiAnswers?: number[]; // Array Index [0, 2] dsb
    statements?: { id: string; statement: string; correctCategory: "Benar" | "Salah" | "Sesuai" | "Tidak Sesuai" }[];
    explanation?: string;
}

// Komponen Render Rumus LaTeX
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [questions, setQuestions] = useState<TKAPartQuestion[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubtest, setSelectedSubtest] = useState<"ALL" | "Bahasa Indonesia" | "Matematika">("ALL");
    const [selectedType, setSelectedType] = useState<"ALL" | "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI">("ALL");

    // State Modal Tambah / Edit Soal
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [selectedQuestionForPreview, setSelectedQuestionForPreview] = useState<TKAPartQuestion | null>(null);

    // Form State Default
    const initialFormState: TKAPartQuestion = {
        id: "",
        subject: "Bahasa Indonesia",
        subtest: "LIT_INDO",
        type: "PG_SEDERHANA",
        difficulty: 2,
        stimulus: "",
        question: "",
        imageUrl: "",
        imagePosition: "above",
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

    // Muat Soal dari LocalStorage atau Dataset Awal
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

    // Simpan ke LocalStorage setiap ada update
    const saveQuestionsToStorage = (updated: TKAPartQuestion[]) => {
        setQuestions(updated);
        if (typeof window !== "undefined") {
            localStorage.setItem("tka_bank_soal", JSON.stringify(updated));
        }
    };

    // Filter Soal
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

    // Statistik Bank Soal
    const stats = useMemo(() => {
        const total = questions.length;
        const indo = questions.filter((q) => q.subject === "Bahasa Indonesia" || q.subtest === "LIT_INDO").length;
        const math = questions.filter((q) => q.subject === "Matematika" || q.subtest === "PM").length;
        const pg = questions.filter((q) => q.type === "PG_SEDERHANA").length;
        const mcma = questions.filter((q) => q.type === "PGK_MCMA").length;
        const kategori = questions.filter((q) => q.type === "PGK_KATEGORI").length;
        return { total, indo, math, pg, mcma, kategori };
    }, [questions]);

    // Buka Form Buat Soal Baru
    const handleOpenAddModal = () => {
        setIsEditing(false);
        setFormData({
            ...initialFormState,
            id: `TKA_${Date.now()}`
        });
        setShowModal(true);
    };

    // Buka Form Edit Soal
    const handleOpenEditModal = (item: TKAPartQuestion) => {
        setIsEditing(true);
        setFormData({
            ...item,
            options: item.options && item.options.length > 0 ? item.options : ["", "", "", ""],
            statements: item.statements && item.statements.length > 0 ? item.statements : [
                { id: "s1", statement: "", correctCategory: "Benar" },
                { id: "s2", statement: "", correctCategory: "Salah" }
            ]
        });
        setShowModal(true);
    };

    // Hapus Soal
    const handleDeleteQuestion = (id: string | number) => {
        if (confirm("Apakah Anda yakin ingin menghapus butir soal ini dari bank soal?")) {
            const updated = questions.filter((q) => q.id !== id);
            saveQuestionsToStorage(updated);
        }
    };

    // Simpan Form (Tambah / Edit)
    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.question.trim()) {
            alert("Teks pertanyaan tidak boleh kosong!");
            return;
        }

        let updatedList: TKAPartQuestion[];
        if (isEditing) {
            updatedList = questions.map((q) => (q.id === formData.id ? formData : q));
        } else {
            updatedList = [formData, ...questions];
        }

        saveQuestionsToStorage(updatedList);
        setShowModal(false);
    };

    // Handler Option Text
    const handleOptionChange = (idx: number, value: string) => {
        const newOptions = [...(formData.options || [])];
        newOptions[idx] = value;
        setFormData({ ...formData, options: newOptions });
    };

    const handleAddOption = () => {
        if ((formData.options || []).length < 5) {
            setFormData({ ...formData, options: [...(formData.options || []), ""] });
        }
    };

    const handleRemoveOption = (idx: number) => {
        if ((formData.options || []).length > 2) {
            const newOptions = (formData.options || []).filter((_, i) => i !== idx);
            setFormData({ ...formData, options: newOptions });
        }
    };

    // Toggle Pilihan MCMA
    const handleToggleMcmaAnswer = (idx: number) => {
        const current = formData.multiAnswers || [];
        let updated: number[];
        if (current.includes(idx)) {
            updated = current.filter((i) => i !== idx);
        } else {
            updated = [...current, idx];
        }
        setFormData({ ...formData, multiAnswers: updated });
    };

    // Handler Matriks Kategori
    const handleStatementChange = (idx: number, field: "statement" | "correctCategory", val: any) => {
        const list = [...(formData.statements || [])];
        list[idx] = { ...list[idx], [field]: val };
        setFormData({ ...formData, statements: list });
    };

    const handleAddStatement = () => {
        const newId = `s_${Date.now()}`;
        setFormData({
            ...formData,
            statements: [...(formData.statements || []), { id: newId, statement: "", correctCategory: "Benar" }]
        });
    };

    const handleRemoveStatement = (idx: number) => {
        if ((formData.statements || []).length > 1) {
            const list = (formData.statements || []).filter((_, i) => i !== idx);
            setFormData({ ...formData, statements: list });
        }
    };

    // Export Data JSON
    const handleExportJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questions, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `bank_soal_tka_smp_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    // Import Data JSON
    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileReader = new FileReader();
        if (e.target.files && e.target.files[0]) {
            fileReader.readAsText(e.target.files[0], "UTF-8");
            fileReader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target?.result as string);
                    if (Array.isArray(parsed)) {
                        saveQuestionsToStorage(parsed);
                        alert(`Berhasil mengimpor ${parsed.length} butir soal ke dalam bank soal!`);
                    } else {
                        alert("Format file JSON tidak valid. Pastikan berisi array soal.");
                    }
                } catch {
                    alert("Gagal membaca file JSON. Periksa kembali struktur file.");
                }
            };
        }
    };

    // Reset ke Bank Soal Default
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
                            title="Kembali ke Pusat Kendali"
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
                                BILIK 01 &bull; MANAJEMEN BANK SOAL TKA SMP
                            </h1>
                            <p className="text-[11px] text-slate-500">
                                Pusat Penyusunan Naskah Asesmen Standar Nasional Pusmendik &bull; SMA Muhammadiyah 18
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportJSON}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Download Cadangan Soal (JSON)"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Ekspor JSON</span>
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Unggah Berkas Naskah Soal (JSON)"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Impor JSON</span>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportJSON}
                            accept=".json"
                            className="hidden"
                        />

                        <button
                            onClick={handleOpenAddModal}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Butir Soal</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* KONTEN UTAMA */}
            <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

                {/* 4 KARTU STATISTIK BANK SOAL */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] font-bold uppercase">
                            <span>TOTAL BANK SOAL</span>
                            <FolderOpen className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="text-3xl font-black text-slate-900 font-mono">{stats.total}</div>
                        <p className="text-[11px] text-slate-500">Butir soal terdaftar aktif</p>
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
                        <p className="text-[11px] text-slate-500">Numerasi 4 domain konten</p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-purple-600 font-mono text-[10px] font-bold uppercase">
                            <span>MODEL VARIATIF</span>
                            <Sparkles className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="text-2xl font-black text-purple-900 font-mono">
                            {stats.pg} <span className="text-xs text-slate-400 font-normal">PG</span> &bull; {stats.mcma} <span className="text-xs text-slate-400 font-normal">MCMA</span> &bull; {stats.kategori} <span className="text-xs text-slate-400 font-normal">Matriks</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Format asesmen standar Pusmendik</p>
                    </div>
                </div>

                {/* TABEL BANK SOAL & FILTER */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Daftar Naskah Butir Soal Terstandarisasi</h2>
                            <p className="text-xs text-slate-500">Pilih butir soal untuk mengedit narasi stimulus, kunci, atau formula LaTeX.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Cari kata kunci soal..."
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

                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as any)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none"
                            >
                                <option value="ALL">Semua Model Soal</option>
                                <option value="PG_SEDERHANA">PG Sederhana (Single Choice)</option>
                                <option value="PGK_MCMA">PG Kompleks (MCMA Checkbox)</option>
                                <option value="PGK_KATEGORI">PG Kompleks (Matriks Benar/Salah)</option>
                            </select>

                            <button
                                onClick={handleResetToDefault}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
                                title="Reset ke naskah asli default"
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
                                    <th className="p-3.5 w-44">Bentuk Soal</th>
                                    <th className="p-3.5">Konten Soal &amp; Stimulus</th>
                                    <th className="p-3.5 w-24 text-center">Tingkat</th>
                                    <th className="p-3.5 w-28 text-center">Kunci</th>
                                    <th className="p-3.5 w-28 text-right">Aksi</th>
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
                                            <td className="p-3.5 font-mono text-[11px] text-slate-600">
                                                {q.type === "PG_SEDERHANA" && "PG Sederhana"}
                                                {q.type === "PGK_MCMA" && "PGK (MCMA)"}
                                                {q.type === "PGK_KATEGORI" && "PGK (Matriks)"}
                                            </td>
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
                                            <td className="p-3.5 text-center font-mono">
                                                <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                                                    Lvl {q.difficulty || 2}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                                                {q.type === "PG_SEDERHANA" && ["A", "B", "C", "D", "E"][q.singleAnswer ?? 0]}
                                                {q.type === "PGK_MCMA" && `${(q.multiAnswers || []).length} Pilihan`}
                                                {q.type === "PGK_KATEGORI" && `${(q.statements || []).length} Matriks`}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedQuestionForPreview(q);
                                                            setPreviewMode(true);
                                                        }}
                                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                                                        title="Lihat Pratinjau Soal"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenEditModal(q)}
                                                        className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
                                                        title="Edit Butir Soal"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                        className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                                                        title="Hapus Butir Soal"
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
                                        <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                                            Tidak ada butir soal yang sesuai dengan kriteria filter Anda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ========================================================================= */}
            {/* MODAL FORM TAMBAH / EDIT BUTIR SOAL LENGKAP                                */}
            {/* ========================================================================= */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
                        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900">
                                        {isEditing ? "Edit Butir Soal TKA SMP" : "Tambah Butir Soal Baru"}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-mono">ID: {formData.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveForm} className="p-6 overflow-y-auto space-y-4 text-xs text-left">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="font-bold font-mono text-slate-700">SUBTES RESMI:</label>
                                    <select
                                        value={formData.subject}
                                        onChange={(e) => {
                                            const sub = e.target.value as any;
                                            setFormData({
                                                ...formData,
                                                subject: sub,
                                                subtest: sub === "Bahasa Indonesia" ? "LIT_INDO" : "PM"
                                            });
                                        }}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-600 outline-none bg-white"
                                    >
                                        <option value="Bahasa Indonesia">Literasi Bahasa Indonesia</option>
                                        <option value="Matematika">Penalaran Matematika</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold font-mono text-slate-700">BENTUK SOAL:</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-600 outline-none bg-white"
                                    >
                                        <option value="PG_SEDERHANA">PG Sederhana (Pilihan A-D/E)</option>
                                        <option value="PGK_MCMA">PG Kompleks (MCMA Centang Banyak)</option>
                                        <option value="PGK_KATEGORI">PG Kompleks (Matriks Benar/Salah)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold font-mono text-slate-700">TINGKAT KESUKARAN:</label>
                                    <select
                                        value={formData.difficulty}
                                        onChange={(e) => setFormData({ ...formData, difficulty: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:border-blue-600 outline-none bg-white"
                                    >
                                        <option value={1}>Level 1 (Mudah / Pemahaman)</option>
                                        <option value={2}>Level 2 (Sedang / Aplikasi)</option>
                                        <option value={3}>Level 3 (Sulit / Penalaran HOTS)</option>
                                    </select>
                                </div>
                            </div>

                            {/* STIMULUS WACANA */}
                            <div className="space-y-1">
                                <label className="font-bold font-mono text-slate-700">
                                    STIMULUS WACANA / TEKS INFORMASI (OPSIONAL):
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Ketik teks wacana bacaan atau stimulus bacaan di sini..."
                                    value={formData.stimulus || ""}
                                    onChange={(e) => setFormData({ ...formData, stimulus: e.target.value })}
                                    className="w-full p-3 rounded-xl border border-slate-200 font-normal focus:border-blue-600 outline-none"
                                />
                            </div>

                            {/* TEKS PERTANYAAN */}
                            <div className="space-y-1">
                                <label className="font-bold font-mono text-slate-700">
                                    TEKS PERTANYAAN / SOAL (DUKUNGAN LATEX $...$):
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Contoh: Nilai $x$ dari persamaan $2x + 5 = 15$ adalah..."
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full p-3 rounded-xl border border-slate-200 font-semibold focus:border-blue-600 outline-none"
                                />
                            </div>

                            {/* INPUT PILIHAN GANDA SEDERHANA */}
                            {formData.type === "PG_SEDERHANA" && (
                                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                    <label className="font-bold font-mono text-slate-700 block">
                                        OPSI JAWABAN &amp; PILIH KUNCI JAWABAN BENAR:
                                    </label>
                                    {(formData.options || []).map((opt, idx) => {
                                        const isCorrect = formData.singleAnswer === idx;
                                        const char = ["A", "B", "C", "D", "E"][idx];
                                        return (
                                            <div key={idx} className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, singleAnswer: idx })}
                                                    className={`w-8 h-8 rounded-xl font-mono font-bold flex items-center justify-center shrink-0 transition ${isCorrect
                                                            ? "bg-emerald-600 text-white shadow-xs"
                                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                        }`}
                                                >
                                                    {char}
                                                </button>
                                                <input
                                                    type="text"
                                                    required
                                                    value={opt}
                                                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                                                    placeholder={`Teks jawaban pilihan ${char}...`}
                                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-medium"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveOption(idx)}
                                                    className="p-2 text-rose-500 hover:text-rose-700"
                                                    title="Hapus Opsi"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {(formData.options || []).length < 5 && (
                                        <button
                                            type="button"
                                            onClick={handleAddOption}
                                            className="text-blue-700 hover:underline font-bold text-xs inline-flex items-center gap-1 mt-1"
                                        >
                                            <Plus className="w-3 h-3" /> Tambah Pilihan Opsi ({["A", "B", "C", "D", "E"][(formData.options || []).length]})
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* INPUT PILIHAN GANDA KOMPLEKS (MCMA) */}
                            {formData.type === "PGK_MCMA" && (
                                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                    <label className="font-bold font-mono text-slate-700 block">
                                        OPSI JAWABAN MCMA (CENTANG LEBIH DARI SATU KUNCI BENAR):
                                    </label>
                                    {(formData.options || []).map((opt, idx) => {
                                        const isChecked = (formData.multiAnswers || []).includes(idx);
                                        const char = ["A", "B", "C", "D", "E"][idx];
                                        return (
                                            <div key={idx} className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleMcmaAnswer(idx)}
                                                    className={`w-8 h-8 rounded-xl font-mono font-bold flex items-center justify-center shrink-0 border transition ${isChecked
                                                            ? "bg-indigo-700 border-indigo-700 text-white shadow-xs"
                                                            : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                                                        }`}
                                                >
                                                    {isChecked ? <Check className="w-4 h-4" /> : char}
                                                </button>
                                                <input
                                                    type="text"
                                                    required
                                                    value={opt}
                                                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                                                    placeholder={`Pernyataan opsi ${char}...`}
                                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-medium"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveOption(idx)}
                                                    className="p-2 text-rose-500 hover:text-rose-700"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {(formData.options || []).length < 5 && (
                                        <button
                                            type="button"
                                            onClick={handleAddOption}
                                            className="text-blue-700 hover:underline font-bold text-xs inline-flex items-center gap-1 mt-1"
                                        >
                                            <Plus className="w-3 h-3" /> Tambah Opsi MCMA
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* INPUT PGK KATEGORI / MATRIKS */}
                            {formData.type === "PGK_KATEGORI" && (
                                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                    <label className="font-bold font-mono text-slate-700 block">
                                        DAFTAR PERNYATAAN MATRIKS (BENAR / SALAH):
                                    </label>
                                    {(formData.statements || []).map((st, idx) => (
                                        <div key={st.id || idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                            <span className="font-mono font-bold text-slate-500 w-5 text-center">{idx + 1}.</span>
                                            <input
                                                type="text"
                                                required
                                                value={st.statement}
                                                onChange={(e) => handleStatementChange(idx, "statement", e.target.value)}
                                                placeholder="Ketik pernyataan analisis di sini..."
                                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-600 outline-none text-xs"
                                            />
                                            <select
                                                value={st.correctCategory}
                                                onChange={(e) => handleStatementChange(idx, "correctCategory", e.target.value)}
                                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-xs outline-none"
                                            >
                                                <option value="Benar">Kunci: Benar</option>
                                                <option value="Salah">Kunci: Salah</option>
                                                <option value="Sesuai">Kunci: Sesuai</option>
                                                <option value="Tidak Sesuai">Kunci: Tidak Sesuai</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStatement(idx)}
                                                className="p-1.5 text-rose-500 hover:text-rose-700"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleAddStatement}
                                        className="text-blue-700 hover:underline font-bold text-xs inline-flex items-center gap-1 mt-1"
                                    >
                                        <Plus className="w-3 h-3" /> Tambah Baris Pernyataan
                                    </button>
                                </div>
                            )}

                            {/* PEMBAHASAN SOAL */}
                            <div className="space-y-1 pt-2 border-t border-slate-100">
                                <label className="font-bold font-mono text-slate-700">
                                    PEMBAHASAN SOAL / SOLUSI JAWABAN:
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Ketik langkah pemecahan atau dasar analisis wacana..."
                                    value={formData.explanation || ""}
                                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                                    className="w-full p-3 rounded-xl border border-slate-200 font-normal focus:border-blue-600 outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-700"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 shadow-md"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Simpan ke Bank Soal</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL PRATINJAU SOAL (PREVIEW LAYAR SISWA)                                */}
            {/* ========================================================================= */}
            {previewMode && selectedQuestionForPreview && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                Pratinjau Layar Siswa &bull; {selectedQuestionForPreview.subject}
                            </span>
                            <button
                                onClick={() => setPreviewMode(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
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

                        {/* Opsi Jawaban */}
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
                            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                        >
                            Tutup Pratinjau
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}