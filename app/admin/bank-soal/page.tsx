"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
    ChevronLeft,
    Search,
    BookOpen,
    Calculator,
    Trash2,
    FileText,
    FolderOpen,
    Download,
    Eye,
    X,
    FileSpreadsheet,
    ClipboardPaste,
    Check,
    RefreshCw,
    Database
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { supabase } from "@/lib/supabase";

export interface QuestionCBT {
    id: string;
    no_soal: number;
    subtes_code: "BINDO" | "MTK" | string;
    subject: "Bahasa Indonesia" | "Matematika";
    materi?: string;
    type: "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI";
    stimulus?: string;
    image_url?: string;
    image_position?: "above" | "below";
    pertanyaan: string;
    opsi_a: string;
    opsi_b: string;
    opsi_c: string;
    opsi_d: string;
    opsi_e?: string;
    kunci: string; // "A", "B", "C", "D", "E"
    difficulty: number;
    tingkat_kesukaran?: string;
    pembahasan?: string;
}

// Komponen Render LaTeX dengan Pengaman Ekstra (Anti-Crash & Responsif HP)
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

// Parser Baris CSV Robust (Menangani kutip dua & koma dalam kalimat)
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "“" || char === "”") {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result.map((item) => item.replace(/^"|"$/g, "").trim());
}

// Normalisasi Kode Subtes ke BINDO atau MTK
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

export default function BankSoalAdminPage() {
    const csvInputRef = useRef<HTMLInputElement>(null);

    const [questions, setQuestions] = useState<QuestionCBT[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubtest, setSelectedSubtest] = useState<"ALL" | "BINDO" | "MTK">("ALL");

    const [showWordPasteModal, setShowWordPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const [selectedQuestionForPreview, setSelectedQuestionForPreview] = useState<QuestionCBT | null>(null);

    // 1. Tarik Soal dari Supabase PostgreSQL (tka_questions)
    const fetchQuestionsFromSupabase = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("tka_questions")
                .select("*")
                .order("subtes_code", { ascending: true })
                .order("no_soal", { ascending: true });

            if (error) {
                console.error("Supabase fetch error:", error);
                alert("Gagal memuat soal dari Supabase: " + error.message);
                return;
            }

            const normalized: QuestionCBT[] = (data || []).map((q: any) => {
                const code = normalizeSubtestCode(q.subtes_code || q.subject);
                return {
                    id: String(q.id),
                    no_soal: Number(q.no_soal) || 1,
                    subtes_code: code,
                    subject: code === "MTK" ? "Matematika" : "Bahasa Indonesia",
                    materi: q.materi || (code === "MTK" ? "Numerasi SMP" : "Literasi Membaca"),
                    type: q.type || "PG_SEDERHANA",
                    stimulus: q.stimulus || "",
                    image_url: q.image_url || "",
                    image_position: q.image_position || "above",
                    pertanyaan: q.pertanyaan || "",
                    opsi_a: q.opsi_a || "",
                    opsi_b: q.opsi_b || "",
                    opsi_c: q.opsi_c || "",
                    opsi_d: q.opsi_d || "",
                    opsi_e: q.opsi_e || "",
                    kunci: (q.kunci || "A").toUpperCase().trim(),
                    difficulty: Number(q.difficulty) || 2,
                    tingkat_kesukaran: q.tingkat_kesukaran || "Sedang",
                    pembahasan: q.pembahasan || ""
                };
            });

            setQuestions(normalized);
            if (typeof window !== "undefined") {
                localStorage.setItem("tka_bank_soal_cbt", JSON.stringify(normalized));
                localStorage.setItem("tka_bank_soal", JSON.stringify(normalized));
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestionsFromSupabase();
    }, []);

    // 2. Kosongkan Semua Soal di Supabase
    const handleClearAllQuestions = async () => {
        if (
            !confirm(
                "Apakah Anda yakin ingin MENGHAPUS SEMUA SOAL di database Supabase? Bank soal akan bersih dan siap diunggah ulang."
            )
        ) {
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("tka_questions")
                .delete()
                .neq("id", "00000000-0000-0000-0000-000000000000");

            if (error) throw error;

            setQuestions([]);
            if (typeof window !== "undefined") {
                localStorage.removeItem("tka_bank_soal_cbt");
                localStorage.removeItem("tka_bank_soal");
            }
            alert("Seluruh soal di Supabase berhasil dikosongkan.");
        } catch (err: any) {
            alert("Gagal mengosongkan soal: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSaving(false);
        }
    };

    // 3. Download Template CSV Resmi TKA SMP (14 Kolom: BINDO & MTK)
    const handleDownloadCsvTemplateM18 = () => {
        const headers =
            "No,Subtes,Wacana / Stimulus,Link Gambar (Opsional),Posisi Gambar,Pertanyaan,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,Kunci Jawaban,Tingkat Kesukaran,Pembahasan\n";
        const row1 = `1,"BINDO","Kawasan ekosistem mangrove di pesisir utara Jakarta memegang peranan krusial dalam menahan laju intrusi air laut ke daratan yang kian mengkhawatirkan...","","above","Berdasarkan teks wacana di atas, fungsi utama ekosistem mangrove yang terkait langsung dengan mitigasi perubahan iklim global adalah...","Mencegah abrasi fisik tanah pesisir akibat gelombang laut tinggi.","Menyerap karbon biru (blue carbon) dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan.","Melindungi bibit bandeng dan kepiting bakau dari pencemaran sampah plastik.","Menahan laju intrusi air laut yang dipicu penurunan muka tanah ibu kota.","","B","Mudah","Hutan bakau berfungsi sebagai penyerap karbon biru dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan."\n`;
        const row2 = `2,"MTK","Menjelang tahun ajaran baru, sebuah koperasi pendidikan memberikan promosi diskon bertingkat untuk paket seragam dan alat tulis. Setiap pembelian paket seragam diberi diskon 20%, dan jika pembeli adalah anggota koperasi, akan mendapatkan potongan harga tambahan sebesar 10% dari harga setelah diskon pertama.","","above","Jika harga label satu set paket perlengkapan sekolah adalah Rp300.000, berapakah nominal rupiah yang harus dibayarkan oleh seorang siswa yang terdaftar sebagai anggota koperasi?","Rp 210.000","Rp 216.000","Rp 220.000","Rp 240.000","","B","Sedang","Diskon 1 (20%): Rp300.000 x 0.8 = Rp240.000. Diskon 2 (10%): Rp240.000 x 0.9 = Rp216.000."\n`;

        const blob = new Blob([headers + row1 + row2], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Template_Bank_Soal_TKA_SMP_M18.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 4. Unggah CSV & Simpan Langsung ke Supabase
    const handleUploadCsvM18 = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target?.result as string;
                const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
                if (lines.length <= 1) {
                    alert("File CSV kosong atau hanya berisi baris header!");
                    return;
                }

                const rowsToInsert: any[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    if (row.length < 6) continue;

                    const no_soal = Number(row[0]) || i;
                    const subtes_code = normalizeSubtestCode(row[1]);
                    const subject = subtes_code === "MTK" ? "Matematika" : "Bahasa Indonesia";
                    const materi = subtes_code === "MTK" ? "Numerasi SMP" : "Literasi Membaca";

                    const stimulus = row[2] || "";
                    const image_url = row[3] || "";
                    const image_position = row[4]?.toLowerCase() === "below" ? "below" : "above";
                    const pertanyaan = row[5] || "";

                    const opsi_a = row[6] || "";
                    const opsi_b = row[7] || "";
                    const opsi_c = row[8] || "";
                    const opsi_d = row[9] || "";
                    const opsi_e = row[10] || "";

                    const kunci = (row[11] || "A").trim().toUpperCase();
                    const tingkat_kesukaran = row[12] || "Sedang";
                    const diffMap: Record<string, number> = { mudah: 1, sedang: 2, sulit: 3 };
                    const difficulty = diffMap[tingkat_kesukaran.toLowerCase()] ?? 2;
                    const pembahasan = row[13] || "";

                    if (pertanyaan) {
                        rowsToInsert.push({
                            no_soal,
                            subtes_code,
                            subject,
                            materi,
                            type: "PG_SEDERHANA",
                            stimulus,
                            image_url,
                            image_position,
                            pertanyaan,
                            opsi_a,
                            opsi_b,
                            opsi_c,
                            opsi_d,
                            opsi_e,
                            kunci,
                            difficulty,
                            tingkat_kesukaran,
                            pembahasan
                        });
                    }
                }

                if (rowsToInsert.length > 0) {
                    setIsSaving(true);
                    const { error } = await supabase.from("tka_questions").insert(rowsToInsert);
                    if (error) throw error;

                    await fetchQuestionsFromSupabase();
                    alert(`Berhasil menyimpan ${rowsToInsert.length} butir soal TKA SMP ke database Supabase!`);
                } else {
                    alert("Gagal membaca butir soal. Pastikan kolom sesuai urutan template.");
                }
            } catch (err: any) {
                console.error(err);
                alert("Gagal menyimpan CSV ke Supabase: " + (err?.message || "Kesalahan format"));
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    // 5. Impor Salin-Tempel dari Naskah Word & Simpan ke Supabase
    const handleParseWordPaste = async () => {
        if (!pasteText.trim()) {
            alert("Kotak teks naskah masih kosong!");
            return;
        }

        try {
            const blocks = pasteText.split(/(?=\d+\.\s+)/g).filter((b) => b.trim().length > 0);
            const rowsToInsert: any[] = [];

            let currentSubCode: "BINDO" | "MTK" = "BINDO";
            let currentStimulus = "";

            blocks.forEach((block, idx) => {
                const upperBlock = block.toUpperCase();
                if (
                    upperBlock.includes("[SUBTES: MATEMATIKA]") ||
                    upperBlock.includes("[SUBTES: MTK]") ||
                    upperBlock.includes("[SUBTES: PM]") ||
                    upperBlock.includes("[MAPEL: MATEMATIKA]")
                ) {
                    currentSubCode = "MTK";
                } else if (
                    upperBlock.includes("[SUBTES: BAHASA INDONESIA]") ||
                    upperBlock.includes("[SUBTES: BINDO]") ||
                    upperBlock.includes("[SUBTES: LIT_INDO]") ||
                    upperBlock.includes("[MAPEL: BAHASA INDONESIA]")
                ) {
                    currentSubCode = "BINDO";
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
                    rowsToInsert.push({
                        no_soal: idx + 1,
                        subtes_code: currentSubCode,
                        subject: currentSubCode === "MTK" ? "Matematika" : "Bahasa Indonesia",
                        materi: currentSubCode === "MTK" ? "Numerasi SMP" : "Literasi Membaca",
                        type: "PG_SEDERHANA",
                        stimulus: currentStimulus,
                        pertanyaan,
                        opsi_a,
                        opsi_b,
                        opsi_c,
                        opsi_d,
                        opsi_e,
                        kunci,
                        difficulty: 2,
                        tingkat_kesukaran: "Sedang",
                        pembahasan
                    });
                }
            });

            if (rowsToInsert.length > 0) {
                setIsSaving(true);
                const { error } = await supabase.from("tka_questions").insert(rowsToInsert);
                if (error) throw error;

                await fetchQuestionsFromSupabase();
                setShowWordPasteModal(false);
                setPasteText("");
                alert(`Berhasil menyimpan ${rowsToInsert.length} butir soal TKA SMP ke database Supabase!`);
            } else {
                alert("Format teks tidak terdeteksi. Gunakan format: 1. Pertanyaan, A. Opsi, B. Opsi, KUNCI: X");
            }
        } catch (err: any) {
            alert("Gagal menyimpan naskah Word ke Supabase: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSaving(false);
        }
    };

    // 6. Hapus Butir Soal di Supabase
    const handleDeleteOne = async (id: string) => {
        if (!confirm("Hapus butir soal ini dari database Supabase?")) return;

        setIsSaving(true);
        try {
            const { error } = await supabase.from("tka_questions").delete().eq("id", id);
            if (error) throw error;

            const updated = questions.filter((q) => q.id !== id);
            setQuestions(updated);
            if (typeof window !== "undefined") {
                localStorage.setItem("tka_bank_soal_cbt", JSON.stringify(updated));
                localStorage.setItem("tka_bank_soal", JSON.stringify(updated));
            }
        } catch (err: any) {
            alert("Gagal menghapus soal: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSaving(false);
        }
    };

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            const matchSearch =
                (q.pertanyaan && q.pertanyaan.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (q.stimulus && q.stimulus.toLowerCase().includes(searchQuery.toLowerCase()));

            const code = normalizeSubtestCode(q.subtes_code);
            const matchSub = selectedSubtest === "ALL" || code === selectedSubtest;
            return matchSearch && matchSub;
        });
    }, [questions, searchQuery, selectedSubtest]);

    const stats = useMemo(() => {
        const total = questions.length;
        const bindo = questions.filter((q) => normalizeSubtestCode(q.subtes_code) === "BINDO").length;
        const mtk = questions.filter((q) => normalizeSubtestCode(q.subtes_code) === "MTK").length;
        return { total, bindo, mtk };
    }, [questions]);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 overflow-x-hidden">
            {/* HEADER ATAS RESPONSIF HP & TABLET */}
            <header className="bg-white border-b border-slate-200 py-3 sm:py-3.5 px-3 sm:px-6 lg:px-8 sticky top-0 z-30 shadow-xs">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Baris Identitas Halaman */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Link
                            href="/admin"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 transition shrink-0 cursor-pointer"
                            title="Kembali ke Bilik Admin"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src="/logo-timsim.jpg"
                                alt="Logo SMA Muhammadiyah 18"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                }}
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight uppercase truncate">
                                    BANK SOAL TRYOUT TKA SMP
                                </h1>
                                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[9.5px] font-bold">
                                    <Database className="w-2.5 h-2.5" /> Supabase Cloud
                                </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                                Bahasa Indonesia (BINDO) & Matematika (MTK) • SMA Muhammadiyah 18 Jakarta
                            </p>
                        </div>
                    </div>

                    {/* Toolbar Tombol Aksi (Grid 2 kolom di HP, Flex sejajar di Tablet/Desktop) */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                        <button
                            onClick={fetchQuestionsFromSupabase}
                            disabled={isLoading || isSaving}
                            className="px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Muat ulang dari Supabase"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
                            <span>Sync</span>
                        </button>

                        <button
                            onClick={handleDownloadCsvTemplateM18}
                            className="px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <Download className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span className="truncate">Template CSV</span>
                        </button>

                        <button
                            onClick={() => csvInputRef.current?.click()}
                            disabled={isSaving}
                            className="px-3 py-2 sm:py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{isSaving ? "Menyimpan..." : "Unggah CSV"}</span>
                        </button>
                        <input
                            type="file"
                            ref={csvInputRef}
                            onChange={handleUploadCsvM18}
                            accept=".csv"
                            className="hidden"
                        />

                        <button
                            onClick={() => setShowWordPasteModal(true)}
                            disabled={isSaving}
                            className="px-3 py-2 sm:py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                            <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Impor Word</span>
                        </button>

                        {questions.length > 0 && (
                            <button
                                onClick={handleClearAllQuestions}
                                disabled={isSaving}
                                className="col-span-2 sm:col-span-1 px-3 py-2 sm:py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
                                title="Kosongkan seluruh soal di Supabase"
                            >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Kosongkan</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* KONTEN UTAMA RESPONSIF */}
            <main className="max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
                {/* KARTU METRIK */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-1 text-left">
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] font-bold uppercase">
                            <span>TOTAL BANK SOAL CLOUD</span>
                            <FolderOpen className="w-4 h-4 text-slate-500 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{stats.total}</div>
                        <p className="text-[11px] text-slate-500">Tersinkron langsung ke perangkat siswa</p>
                    </div>

                    <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-1 text-left">
                        <div className="flex items-center justify-between text-blue-600 font-mono text-[10px] font-bold uppercase">
                            <span className="truncate pr-2">BAHASA INDONESIA (BINDO)</span>
                            <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">{stats.bindo}</div>
                        <p className="text-[11px] text-slate-500">Pemetaan Literasi Membaca SMP</p>
                    </div>

                    <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-1 text-left">
                        <div className="flex items-center justify-between text-emerald-600 font-mono text-[10px] font-bold uppercase">
                            <span className="truncate pr-2">MATEMATIKA (MTK)</span>
                            <Calculator className="w-4 h-4 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">{stats.mtk}</div>
                        <p className="text-[11px] text-slate-500">Pemetaan Numerasi & Aljabar SMP</p>
                    </div>
                </div>

                {/* PANEL DAFTAR BANK SOAL */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-4 text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm sm:text-base font-black text-slate-900">Daftar Naskah Soal TKA SMP</h2>
                            <p className="text-[11px] sm:text-xs text-slate-500">
                                Ketuk ikon mata (Pratinjau) untuk memeriksa tampilan soal & rumus KaTeX seperti di layar ujian siswa.
                            </p>
                        </div>

                        {/* Filter & Pencarian Responsif */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="relative flex-1 sm:w-56">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Cari kata kunci soal..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600"
                                />
                            </div>

                            <select
                                value={selectedSubtest}
                                onChange={(e) => setSelectedSubtest(e.target.value as any)}
                                className="px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none cursor-pointer"
                            >
                                <option value="ALL">Semua Mapel (BINDO & MTK)</option>
                                <option value="BINDO">Bahasa Indonesia (BINDO)</option>
                                <option value="MTK">Matematika (MTK)</option>
                            </select>
                        </div>
                    </div>

                    {/* Info Geser Tabel Khusus Layar HP */}
                    <div className="sm:hidden text-[10px] font-mono text-slate-400 flex items-center justify-end">
                        <span>← Geser tabel ke samping untuk melihat kunci & aksi →</span>
                    </div>

                    {/* Wrapper Tabel Horizontal Scroll Aman */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 -mx-1 sm:mx-0">
                        <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                            <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10.5px] sm:text-[11px] text-slate-600">
                                <tr>
                                    <th className="p-3 w-12 text-center">No</th>
                                    <th className="p-3 w-44">Mata Pelajaran</th>
                                    <th className="p-3 min-w-[240px]">Konten Wacana / Pertanyaan</th>
                                    <th className="p-3 w-16 sm:w-20 text-center">Kunci</th>
                                    <th className="p-3 w-24 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-slate-400 font-mono text-xs">
                                            Memuat bank soal dari Supabase...
                                        </td>
                                    </tr>
                                ) : (
                                    filteredQuestions.map((q, idx) => {
                                        const code = normalizeSubtestCode(q.subtes_code);
                                        const isMath = code === "MTK";
                                        return (
                                            <tr key={q.id || idx} className="hover:bg-slate-50/80 transition">
                                                <td className="p-3 text-center font-mono font-bold text-blue-700 align-top">
                                                    #{q.no_soal || idx + 1}
                                                </td>
                                                <td className="p-3 align-top">
                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border inline-block whitespace-nowrap ${isMath
                                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                                : "bg-blue-50 text-blue-800 border-blue-200"
                                                            }`}
                                                    >
                                                        {isMath ? "MTK • Matematika" : "BINDO • B. Indonesia"}
                                                    </span>
                                                </td>
                                                <td className="p-3 space-y-1 align-top">
                                                    {q.stimulus && (
                                                        <div className="text-[11px] text-slate-500 italic line-clamp-1 bg-slate-50 p-1 px-2 rounded-lg border border-slate-100">
                                                            <strong>Wacana:</strong> {q.stimulus}
                                                        </div>
                                                    )}
                                                    <div className="font-semibold text-slate-900 leading-relaxed text-xs sm:text-[12.5px] line-clamp-3">
                                                        <RenderLatex content={q.pertanyaan} />
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center align-top">
                                                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black text-xs inline-flex items-center justify-center shadow-2xs">
                                                        {q.kunci}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right align-top">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedQuestionForPreview(q)}
                                                            className="p-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 transition cursor-pointer"
                                                            title="Buka Pratinjau Penuh"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOne(q.id)}
                                                            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 transition cursor-pointer"
                                                            title="Hapus Soal"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}

                                {!isLoading && filteredQuestions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 sm:py-12 text-slate-400 font-medium space-y-2 px-4">
                                            <FolderOpen className="w-8 h-8 mx-auto text-slate-300" />
                                            <p className="text-xs">
                                                Bank soal di Supabase masih kosong. Ketuk tombol <strong>Unggah CSV</strong> atau <strong>Impor Word</strong> untuk mengisi naskah.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* MODAL PRATINJAU SOAL RESPONSIF HP & TABLET */}
            {selectedQuestionForPreview && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl sm:rounded-3xl w-[96vw] sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
                        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl sm:rounded-t-3xl shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full font-mono text-[11px] sm:text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 truncate">
                                    SOAL NO. {selectedQuestionForPreview.no_soal} • {normalizeSubtestCode(selectedQuestionForPreview.subtes_code)}
                                </span>
                                <span className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:inline">
                                    Pratinjau Layar Siswa TKA SMP
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedQuestionForPreview(null)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-500 cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-left text-xs sm:text-sm leading-relaxed">
                            {/* Gambar Above */}
                            {selectedQuestionForPreview.image_url && selectedQuestionForPreview.image_position === "above" && (
                                <div className="p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
                                    <img
                                        src={selectedQuestionForPreview.image_url}
                                        alt="Gambar Soal"
                                        className="max-h-48 sm:max-h-60 object-contain rounded-xl max-w-full"
                                    />
                                </div>
                            )}

                            {/* Wacana Stimulus */}
                            {selectedQuestionForPreview.stimulus && (
                                <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line overflow-x-auto">
                                    <div className="text-[10px] font-mono font-bold text-blue-700 uppercase mb-1.5 flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 shrink-0" /> STIMULUS WACANA BACAAN / INFORMASI
                                    </div>
                                    <RenderLatex content={selectedQuestionForPreview.stimulus} />
                                </div>
                            )}

                            {/* Teks Pertanyaan */}
                            <div className="font-bold text-slate-900 text-sm sm:text-base leading-snug overflow-x-auto py-0.5">
                                <RenderLatex content={selectedQuestionForPreview.pertanyaan} />
                            </div>

                            {/* Gambar Below */}
                            {selectedQuestionForPreview.image_url && selectedQuestionForPreview.image_position === "below" && (
                                <div className="p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
                                    <img
                                        src={selectedQuestionForPreview.image_url}
                                        alt="Gambar Soal"
                                        className="max-h-48 sm:max-h-60 object-contain rounded-xl max-w-full"
                                    />
                                </div>
                            )}

                            {/* Daftar Pilihan A - E */}
                            <div className="space-y-2 pt-1">
                                {[
                                    { key: "A", text: selectedQuestionForPreview.opsi_a },
                                    { key: "B", text: selectedQuestionForPreview.opsi_b },
                                    { key: "C", text: selectedQuestionForPreview.opsi_c },
                                    { key: "D", text: selectedQuestionForPreview.opsi_d },
                                    { key: "E", text: selectedQuestionForPreview.opsi_e }
                                ]
                                    .filter((opt) => opt.text !== undefined && opt.text !== null && String(opt.text).trim().length > 0)
                                    .map((opt) => {
                                        const isKey = String(selectedQuestionForPreview.kunci || "").toUpperCase().trim() === opt.key;
                                        return (
                                            <div
                                                key={opt.key}
                                                className={`p-3 rounded-2xl border text-xs sm:text-sm flex items-start gap-2.5 sm:gap-3 transition ${isKey
                                                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold shadow-xs"
                                                        : "bg-white border-slate-200 text-slate-700"
                                                    }`}
                                            >
                                                <span
                                                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl font-mono font-bold flex items-center justify-center shrink-0 text-xs ${isKey ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                                                        }`}
                                                >
                                                    {opt.key}
                                                </span>
                                                <div className="flex-1 pt-0.5 leading-relaxed overflow-x-auto">
                                                    <RenderLatex content={String(opt.text ?? "")} />
                                                </div>
                                                {isKey && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[9.5px] sm:text-[10px] font-bold uppercase shrink-0">
                                                        KUNCI
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Box Pembahasan */}
                            {selectedQuestionForPreview.pembahasan && (
                                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1">
                                    <div className="font-mono font-bold text-[10px] text-amber-800 uppercase">
                                        PEMBAHASAN SOAL:
                                    </div>
                                    <div className="leading-relaxed overflow-x-auto">
                                        <RenderLatex content={String(selectedQuestionForPreview.pembahasan ?? "")} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3.5 sm:p-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-2xl sm:rounded-b-3xl shrink-0">
                            <button
                                onClick={() => setSelectedQuestionForPreview(null)}
                                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                            >
                                Tutup Pratinjau
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SALIN-TEMPEL DARI WORD RESPONSIF HP & TABLET */}
            {showWordPasteModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
                    <div className="bg-white rounded-2xl sm:rounded-3xl w-[96vw] sm:max-w-3xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col text-left">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold shrink-0">
                                    <ClipboardPaste className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                        Salin-Tempel Teks Naskah Word (TKA SMP)
                                    </h3>
                                    <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                                        Tempel teks naskah soal Bahasa Indonesia (BINDO) & Matematika (MTK) dari Word.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWordPasteModal(false)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[10.5px] sm:text-[11px] text-blue-900 space-y-1 leading-relaxed shrink-0">
                            <strong>Aturan Format Salin-Tempel:</strong>
                            <p>
                                Gunakan tag <code>[SUBTES: BINDO]</code> (atau <code>[SUBTES: BAHASA INDONESIA]</code>) dan{" "}
                                <code>[SUBTES: MTK]</code> (atau <code>[SUBTES: MATEMATIKA]</code>), tag wacana{" "}
                                <code>[STIMULUS]...[/STIMULUS]</code>, nomor soal <code>1. Pertanyaan</code>, opsi <code>A.</code>,{" "}
                                <code>B.</code>, dan baris <code>KUNCI: B</code>.
                            </p>
                        </div>

                        <textarea
                            rows={8}
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder={`[SUBTES: BINDO]\n[STIMULUS]\nHutan mangrove memiliki fungsi penting...\n[/STIMULUS]\n1. Fungsi utama mangrove adalah...\nA. Menahan intrusi\nB. Menyerap karbon 5x lebih tinggi\nC. Tempat bibit ikan\nD. Sumber kayu bakar\nKUNCI: B\nPEMBAHASAN: Karbon biru diserap secara masif oleh akar bakau.\n\n[SUBTES: MTK]\n2. Nilai $x$ dari $2x + 6 = 16$ adalah...\nA. 3\nB. 5\nC. 7\nD. 9\nKUNCI: B`}
                            className="w-full p-3 rounded-2xl border border-slate-200 font-mono text-xs outline-none focus:border-blue-600 flex-1 min-h-[150px]"
                        />

                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowWordPasteModal(false)}
                                className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer text-center"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleParseWordPaste}
                                disabled={isSaving}
                                className="px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                <Check className="w-4 h-4" />
                                <span>{isSaving ? "Menyimpan..." : "Simpan ke Supabase"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}