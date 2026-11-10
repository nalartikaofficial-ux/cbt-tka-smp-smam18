"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Search,
    BookOpen,
    Calculator,
    Trash2,
    FileText,
    RefreshCw,
    FolderOpen,
    Download,
    Eye,
    X,
    FileSpreadsheet,
    ClipboardPaste,
    Check,
    AlertTriangle,
    Sparkles,
    Layers
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Interface Butir Soal Format SNBT
export interface QuestionSNBT {
    id: string | number;
    no_soal: number;
    subtes_code: "LIT_INDO" | "PM" | string;
    subject: "Bahasa Indonesia" | "Matematika";
    type: "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI";
    stimulus?: string;
    pertanyaan: string;
    opsi_a: string;
    opsi_b: string;
    opsi_c: string;
    opsi_d: string;
    opsi_e?: string;
    kunci: string; // "A", "B", "C", "D", "E"
    pembahasan?: string;
    image_url?: string;
}

// Helper Render Formula LaTeX / KaTeX
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

    const [questions, setQuestions] = useState<QuestionSNBT[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubtest, setSelectedSubtest] = useState<"ALL" | "LIT_INDO" | "PM">("ALL");

    // Modal State
    const [showWordPasteModal, setShowWordPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const [selectedQuestionForPreview, setSelectedQuestionForPreview] = useState<QuestionSNBT | null>(null);

    // 1. Muat Soal dari LocalStorage (Jika kosong, mulai dari nol/kosong)
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("tka_bank_soal_snbt");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        setQuestions(parsed);
                    }
                } catch { }
            } else {
                setQuestions([]);
            }
        }
    }, []);

    const saveQuestions = (updated: QuestionSNBT[]) => {
        setQuestions(updated);
        if (typeof window !== "undefined") {
            localStorage.setItem("tka_bank_soal_snbt", JSON.stringify(updated));
            // Sinkronkan juga ke key umum agar bilik ujian otomatis membaca soal baru ini
            localStorage.setItem("tka_bank_soal", JSON.stringify(updated));
        }
    };

    // 2. Kosongkan Seluruh Soal (Hapus Soal Lama)
    const handleClearAllQuestions = () => {
        if (confirm("Apakah Anda yakin ingin MENGHAPUS SEMUA SOAL yang ada? Bank soal akan bersih dan siap diisi dari berkas CSV/Word baru.")) {
            saveQuestions([]);
        }
    };

    // 3. Download Template CSV Format SNBT
    const handleDownloadCsvTemplateSNBT = () => {
        const headers = "no_soal,subtes_code,stimulus,pertanyaan,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,kunci,pembahasan\n";
        const sample1 = `1,"LIT_INDO","Kawasan mangrove di pesisir utara Jakarta memegang peranan krusial dalam menahan abrasi...","Fungsi utama ekosistem mangrove terhadap mitigasi perubahan iklim adalah...","Mencegah abrasi fisik tanah pesisir","Menyerap karbon biru dengan kapasitas 5 kali lebih tinggi dari hutan tropis daratan","Melindungi kepiting dan bibit bandeng","Menahan laju intrusi air laut","Menambah keindahan pantai","B","Kapasitas penyerapan karbon biru sangat tinggi."\n`;
        const sample2 = `2,"PM","Sebuah koperasi memberikan promosi diskon bertingkat 20% + 10%...","Jika harga satu set perlengkapan adalah Rp300.000, berapakah harga yang harus dibayar?","Rp 210.000","Rp 216.000","Rp 220.000","Rp 240.000","Rp 250.000","B","300.000 x 0.8 = 240.000; 240.000 x 0.9 = 216.000."\n`;

        const blob = new Blob([headers + sample1 + sample2], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "template_tka_smp_model_snbt.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 4. Unggah File CSV Format SNBT
    const handleUploadCsvSNBT = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const text = evt.target?.result as string;
                const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
                if (lines.length <= 1) {
                    alert("File CSV kosong atau hanya berisi baris header!");
                    return;
                }

                const newParsed: QuestionSNBT[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map((val) => val.replace(/^"|"$/g, "").trim()) || [];
                    if (row.length < 5) continue;

                    const no_soal = Number(row[0]) || i;
                    const subCodeRaw = (row[1] || "LIT_INDO").toUpperCase().trim();
                    const isMath = subCodeRaw.includes("PM") || subCodeRaw.includes("MATH") || subCodeRaw.includes("MATEMATIKA");
                    const subtes_code = isMath ? "PM" : "LIT_INDO";
                    const subject = isMath ? "Matematika" : "Bahasa Indonesia";

                    const stimulus = row[2] || "";
                    const pertanyaan = row[3] || "";
                    const opsi_a = row[4] || "";
                    const opsi_b = row[5] || "";
                    const opsi_c = row[6] || "";
                    const opsi_d = row[7] || "";
                    const opsi_e = row[8] || "";
                    const kunci = (row[9] || "A").trim().toUpperCase();
                    const pembahasan = row[10] || "";

                    newParsed.push({
                        id: `${subtes_code}_${no_soal}_${Date.now()}`,
                        no_soal,
                        subtes_code,
                        subject,
                        type: "PG_SEDERHANA",
                        stimulus,
                        pertanyaan,
                        opsi_a,
                        opsi_b,
                        opsi_c,
                        opsi_d,
                        opsi_e,
                        kunci,
                        pembahasan
                    });
                }

                if (newParsed.length > 0) {
                    const updated = [...newParsed, ...questions];
                    saveQuestions(updated);
                    alert(`Berhasil mengimpor ${newParsed.length} butir soal dari berkas CSV Model SNBT!`);
                } else {
                    alert("Gagal membaca butir soal. Pastikan struktur kolom sesuai template.");
                }
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan saat memproses CSV.");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    // 5. Impor Salin-Tempel dari Naskah Word (Model SNBT)
    const handleParseWordPaste = () => {
        if (!pasteText.trim()) {
            alert("Kotak teks naskah masih kosong!");
            return;
        }

        try {
            const blocks = pasteText.split(/(?=\d+\.\s+)/g).filter((b) => b.trim().length > 0);
            const parsedFromWord: QuestionSNBT[] = [];

            let currentSubCode: "LIT_INDO" | "PM" = "LIT_INDO";
            let currentStimulus = "";

            blocks.forEach((block, idx) => {
                if (block.toUpperCase().includes("[SUBTES: MATEMATIKA]") || block.toUpperCase().includes("[SUBTES: PM]")) {
                    currentSubCode = "PM";
                } else if (block.toUpperCase().includes("[SUBTES: BAHASA INDONESIA]") || block.toUpperCase().includes("[SUBTES: LIT_INDO]")) {
                    currentSubCode = "LIT_INDO";
                }

                const stimMatch = block.match(/\[STIMULUS\]([\s\S]*?)\[\/STIMULUS\]/i);
                if (stimMatch && stimMatch[1]) {
                    currentStimulus = stimMatch[1].trim();
                }

                const qMatch = block.match(/\d+\.\s+([\s\S]*?)(?=(?:^[A-E]\.|\n[A-E]\.|\nKUNCI:))/m);
                const pertanyaan = qMatch ? qMatch[1].trim() : "";

                const opsi_a = block.match(/(?:^|\n)A\.\s*([\s\S]*?)(?=(?:\n[B-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const opsi_b = block.match(/(?:^|\n)B\.\s*([\s\S]*?)(?=(?:\n[C-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const opsi_c = block.match(/(?:^|\n)C\.\s*([\s\S]*?)(?=(?:\n[D-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const opsi_d = block.match(/(?:^|\n)D\.\s*([\s\S]*?)(?=(?:\nE\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
                const opsi_e = block.match(/(?:^|\n)E\.\s*([\s\S]*?)(?=(?:\nKUNCI:|$))/)?.[1]?.trim() || "";

                const keyMatch = block.match(/KUNCI:\s*([A-E])/i);
                const kunci = keyMatch ? keyMatch[1].toUpperCase() : "A";

                const expMatch = block.match(/PEMBAHASAN:\s*([\s\S]*?)$/i);
                const pembahasan = expMatch ? expMatch[1].trim() : "";

                if (pertanyaan && opsi_a && opsi_b) {
                    parsedFromWord.push({
                        id: `WORD_${currentSubCode}_${Date.now()}_${idx}`,
                        no_soal: idx + 1,
                        subtes_code: currentSubCode,
                        subject: currentSubCode === "PM" ? "Matematika" : "Bahasa Indonesia",
                        type: "PG_SEDERHANA",
                        stimulus: currentStimulus,
                        pertanyaan,
                        opsi_a,
                        opsi_b,
                        opsi_c,
                        opsi_d,
                        opsi_e,
                        kunci,
                        pembahasan
                    });
                }
            });

            if (parsedFromWord.length > 0) {
                const updated = [...parsedFromWord, ...questions];
                saveQuestions(updated);
                setShowWordPasteModal(false);
                setPasteText("");
                alert(`Berhasil mengimpor ${parsedFromWord.length} butir soal dari salinan Word!`);
            } else {
                alert("Format teks tidak terdeteksi. Gunakan pola: 1. Pertanyaan, A. Opsi, B. Opsi, KUNCI: X");
            }
        } catch {
            alert("Terjadi kesalahan saat memproses naskah Word.");
        }
    };

    // Hapus Satuan
    const handleDeleteOne = (id: string | number) => {
        if (confirm("Hapus butir soal ini?")) {
            const updated = questions.filter((q) => q.id !== id);
            saveQuestions(updated);
        }
    };

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            const matchSearch =
                (q.pertanyaan && q.pertanyaan.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (q.stimulus && q.stimulus.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchSub = selectedSubtest === "ALL" || q.subtes_code === selectedSubtest;
            return matchSearch && matchSub;
        });
    }, [questions, searchQuery, selectedSubtest]);

    const stats = useMemo(() => {
        const total = questions.length;
        const indo = questions.filter((q) => q.subtes_code === "LIT_INDO").length;
        const math = questions.filter((q) => q.subtes_code === "PM").length;
        return { total, indo, math };
    }, [questions]);

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
                                Penyusunan Naskah Asesmen Massal Model SNBT &bull; SMA Muhammadiyah 18 Jakarta
                            </p>
                        </div>
                    </div>

                    {/* AKSI TOMBOL ATAS */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadCsvTemplateSNBT}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <Download className="w-3.5 h-3.5 text-blue-700" />
                            <span>Template CSV (SNBT)</span>
                        </button>

                        <button
                            onClick={() => csvInputRef.current?.click()}
                            className="px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Unggah CSV</span>
                        </button>
                        <input
                            type="file"
                            ref={csvInputRef}
                            onChange={handleUploadCsvSNBT}
                            accept=".csv"
                            className="hidden"
                        />

                        <button
                            onClick={() => setShowWordPasteModal(true)}
                            className="px-3.5 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <ClipboardPaste className="w-3.5 h-3.5" />
                            <span>Impor Teks Word</span>
                        </button>

                        {questions.length > 0 && (
                            <button
                                onClick={handleClearAllQuestions}
                                className="px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                title="Hapus semua soal untuk mulai dari nol"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Kosongkan Soal</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* METRIK BANK SOAL */}
            <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] font-bold uppercase">
                            <span>TOTAL BANK SOAL AKTIF</span>
                            <FolderOpen className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="text-3xl font-black text-slate-900 font-mono">{stats.total}</div>
                        <p className="text-[11px] text-slate-500">Butir soal terdaftar di database</p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-blue-600 font-mono text-[10px] font-bold uppercase">
                            <span>LITERASI B. INDONESIA (LIT_INDO)</span>
                            <BookOpen className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-3xl font-black text-blue-700 font-mono">{stats.indo}</div>
                        <p className="text-[11px] text-slate-500">Wacana Informasi &amp; Sastra</p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-emerald-600 font-mono text-[10px] font-bold uppercase">
                            <span>PENALARAN MATEMATIKA (PM)</span>
                            <Calculator className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-3xl font-black text-emerald-700 font-mono">{stats.math}</div>
                        <p className="text-[11px] text-slate-500">Numerasi 4 Elemen Fase D</p>
                    </div>
                </div>

                {/* TABEL BANK SOAL (DIPERLEBAR, RAPI & MUDAH DILIHAT) */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Daftar Naskah Soal Terpasang</h2>
                            <p className="text-xs text-slate-500">Klik ikon mata (Pratinjau) untuk melihat tampilan penuh seperti di layar ujian siswa.</p>
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
                                <option value="LIT_INDO">Literasi Bahasa Indonesia</option>
                                <option value="PM">Penalaran Matematika</option>
                            </select>
                        </div>
                    </div>

                    {/* TABLE CONTAINER */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-600">
                                <tr>
                                    <th className="p-3.5 w-14 text-center">No</th>
                                    <th className="p-3.5 w-44">Subtes</th>
                                    <th className="p-3.5">Konten Stimulus / Pertanyaan</th>
                                    <th className="p-3.5 w-24 text-center">Kunci</th>
                                    <th className="p-3.5 w-24 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {filteredQuestions.map((q, idx) => {
                                    const isMath = q.subtes_code === "PM";
                                    return (
                                        <tr key={q.id || idx} className="hover:bg-slate-50/80 transition">
                                            <td className="p-3.5 text-center font-mono font-bold text-blue-700">
                                                #{q.no_soal || idx + 1}
                                            </td>
                                            <td className="p-3.5">
                                                <span
                                                    className={`px-3 py-1 rounded-full font-mono text-[10.5px] font-bold border inline-block ${isMath
                                                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                            : "bg-blue-50 text-blue-800 border-blue-200"
                                                        }`}
                                                >
                                                    {isMath ? "PM (Matematika)" : "LIT_INDO (B. Indo)"}
                                                </span>
                                            </td>
                                            <td className="p-3.5 space-y-1.5">
                                                {q.stimulus && (
                                                    <div className="text-[11.5px] text-slate-500 italic line-clamp-1 bg-slate-50 p-1.5 px-2.5 rounded-lg border border-slate-100">
                                                        <strong>Wacana:</strong> {q.stimulus}
                                                    </div>
                                                )}
                                                <div className="font-semibold text-slate-900 leading-relaxed text-[12.5px]">
                                                    <RenderLatex content={q.pertanyaan} />
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black text-xs inline-flex items-center justify-center shadow-2xs">
                                                    {q.kunci}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setSelectedQuestionForPreview(q)}
                                                        className="p-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
                                                        title="Buka Pratinjau Lengkap"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOne(q.id)}
                                                        className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                                                        title="Hapus Butir Soal"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredQuestions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-slate-400 font-medium space-y-2">
                                            <FolderOpen className="w-8 h-8 mx-auto text-slate-300" />
                                            <p>Bank soal masih kosong. Silakan klik tombol <strong>Unggah CSV</strong> atau <strong>Impor Teks Word</strong> di atas.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ========================================================================= */}
            {/* MODAL PRATINJAU SOAL BESAR, JELAS & ELEGAN (MIRIP BILIK UJIAN)            */}
            {/* ========================================================================= */}
            {selectedQuestionForPreview && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                            <div className="flex items-center gap-2.5">
                                <span className="px-3 py-1 rounded-full font-mono text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    SOAL NO. {selectedQuestionForPreview.no_soal} &bull; {selectedQuestionForPreview.subtes_code}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                    Pratinjau Layar Siswa
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedQuestionForPreview(null)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-500 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-5 text-left text-sm leading-relaxed">
                            {/* Box Stimulus Wacana */}
                            {selectedQuestionForPreview.stimulus && (
                                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line">
                                    <div className="text-[10px] font-mono font-bold text-blue-700 uppercase mb-2 flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5" /> STIMULUS WACANA BACAAN / INFORMASI
                                    </div>
                                    <RenderLatex content={selectedQuestionForPreview.stimulus} />
                                </div>
                            )}

                            {/* Teks Pertanyaan */}
                            <div className="font-bold text-slate-900 text-base leading-snug">
                                <RenderLatex content={selectedQuestionForPreview.pertanyaan} />
                            </div>

                            {/* Daftar Opsi A - E */}
                            <div className="space-y-2.5 pt-1">
                                {[
                                    { key: "A", text: selectedQuestionForPreview.opsi_a },
                                    { key: "B", text: selectedQuestionForPreview.opsi_b },
                                    { key: "C", text: selectedQuestionForPreview.opsi_c },
                                    { key: "D", text: selectedQuestionForPreview.opsi_d },
                                    { key: "E", text: selectedQuestionForPreview.opsi_e },
                                ]
                                    .filter((opt) => opt.text && opt.text.trim().length > 0)
                                    .map((opt) => {
                                        const isKey = selectedQuestionForPreview.kunci === opt.key;
                                        return (
                                            <div
                                                key={opt.key}
                                                className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 transition ${isKey
                                                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold shadow-xs"
                                                        : "bg-white border-slate-200 text-slate-700"
                                                    }`}
                                            >
                                                <span
                                                    className={`w-7 h-7 rounded-xl font-mono font-bold flex items-center justify-center shrink-0 ${isKey ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                                                        }`}
                                                >
                                                    {opt.key}
                                                </span>
                                                <div className="flex-1 pt-0.5 leading-relaxed">
                                                    <RenderLatex content={opt.text} />
                                                </div>
                                                {isKey && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold uppercase shrink-0">
                                                        KUNCI BENAR
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Box Pembahasan */}
                            {selectedQuestionForPreview.pembahasan && (
                                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1">
                                    <div className="font-mono font-bold text-[10px] text-amber-800 uppercase">
                                        PEMBAHASAN SOAL:
                                    </div>
                                    <div className="leading-relaxed">
                                        <RenderLatex content={selectedQuestionForPreview.pembahasan} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-3xl">
                            <button
                                onClick={() => setSelectedQuestionForPreview(null)}
                                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                            >
                                Tutup Pratinjau
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL SALIN-TEMPEL DARI WORD (MODEL SNBT)                                 */}
            {/* ========================================================================= */}
            {showWordPasteModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
                                    <ClipboardPaste className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900">Salin-Tempel Teks Naskah Word (Model SNBT)</h3>
                                    <p className="text-[11px] text-slate-500">Tempel teks naskah soal langsung dari dokumen Microsoft Word Anda.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWordPasteModal(false)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 space-y-1 leading-relaxed">
                            <strong>Aturan Penulisan Naskah Word:</strong>
                            <p>Gunakan tag <code>[SUBTES: BAHASA INDONESIA]</code> atau <code>[SUBTES: MATEMATIKA]</code>, tag wacana <code>[STIMULUS]...[/STIMULUS]</code>, nomor soal <code>1. Pertanyaan</code>, opsi <code>A.</code>, <code>B.</code>, dan baris <code>KUNCI: B</code>.</p>
                        </div>

                        <textarea
                            rows={10}
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder={`[SUBTES: BAHASA INDONESIA]\n[STIMULUS]\nHutan mangrove memiliki fungsi penting...\n[/STIMULUS]\n1. Fungsi utama mangrove adalah...\nA. Menahan intrusi\nB. Menyerap karbon 5x lebih tinggi\nC. Tempat bibit ikan\nD. Sumber kayu bakar\nKUNCI: B\nPEMBAHASAN: Karbon biru diserap secara masif oleh akar bakau.\n\n[SUBTES: MATEMATIKA]\n2. Nilai $x$ dari $2x + 6 = 16$ adalah...\nA. 3\nB. 5\nC. 7\nD. 9\nKUNCI: B`}
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
                                <span>Proses Masuk ke Bank Soal</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}