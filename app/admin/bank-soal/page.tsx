"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
    ChevronLeft,
    Search,
    BookOpen,
    Calculator,
    Trash2,
    FolderOpen,
    Download,
    FileSpreadsheet,
    ClipboardPaste,
    Check,
    RefreshCw,
    Database,
    Upload,
    FileUp,
    Layers,
    FileText
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import mammoth from "mammoth";
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
    kunci: string;
    difficulty: number;
    tingkat_kesukaran?: string;
    pembahasan?: string;
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

function parseRawWordBlocks(rawText: string) {
    const blocks = rawText.split(/(?=\d+\.\s+)/g).filter((b) => b.trim().length > 0);
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
        if (stimMatch) {
            currentStimulus = (stimMatch[1] || "").trim();
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

    return rowsToInsert;
}

export default function BankSoalAdminPage() {
    const csvInputRef = useRef<HTMLInputElement>(null);
    const docxInputRef = useRef<HTMLInputElement>(null);

    const [questions, setQuestions] = useState<QuestionCBT[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [activeTab, setActiveTab] = useState<"koleksi" | "word" | "csv">("koleksi");

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubtest, setSelectedSubtest] = useState<"ALL" | "BINDO" | "MTK">("ALL");
    const [pasteText, setPasteText] = useState("");

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

    const handleClearAllQuestions = async () => {
        if (
            !confirm(
                "Apakah Anda yakin ingin MENGHAPUS SEMUA SOAL di database Supabase? Tindakan ini tidak dapat dibatalkan."
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
            alert("Seluruh koleksi soal di Supabase berhasil dihapus.");
        } catch (err: any) {
            alert("Gagal menghapus semua soal: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteOne = async (id: string) => {
        if (!confirm("Hapus butir soal ini dari koleksi Supabase?")) return;

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

    const handleDownloadWordTemplateM18 = () => {
        const htmlDoc = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Template Naskah Soal TKA SMP</title>
      <style>
        body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
        .header { font-weight: bold; font-size: 13pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin-bottom: 10px; }
        .guide { background: #f1f5f9; padding: 10px; border-left: 4px solid #2563eb; margin-bottom: 16px; font-size: 10pt; }
        .tag { font-weight: bold; color: #0f172a; }
      </style>
      </head>
      <body>
        <div class="header">TEMPLATE NASKAH SOAL TRYOUT TKA SMP • SMA MUHAMMADIYAH 18 JAKARTA</div>
        <div class="guide">
          <b>Petunjuk Penyusunan Naskah:</b><br/>
          1. Tandai pergantian mata pelajaran dengan <b>[SUBTES: BINDO]</b> atau <b>[SUBTES: MTK]</b>.<br/>
          2. Jika soal memakai wacana bacaan, apit di antara <b>[STIMULUS]</b> dan <b>[/STIMULUS]</b>.<br/>
          3. Setelah selesai, simpan file sebagai <b>.docx</b> lalu unggah langsung di menu <i>Import Naskah Word (.docx)</i>.
        </div>

        <p class="tag">[SUBTES: BINDO]</p>
        <p class="tag">[STIMULUS]</p>
        <p>Kawasan ekosistem mangrove di pesisir utara Jakarta memegang peranan krusial dalam menahan laju intrusi air laut ke daratan. Selain sebagai benteng alami dari abrasi gelombang pasang, hutan bakau juga berfungsi sebagai penyerap karbon biru (blue carbon) dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan.</p>
        <p class="tag">[/STIMULUS]</p>
        <p>1. Berdasarkan teks wacana di atas, fungsi utama ekosistem mangrove yang terkait langsung dengan mitigasi perubahan iklim global adalah...</p>
        <p>A. Mencegah abrasi fisik tanah pesisir akibat gelombang laut tinggi.</p>
        <p>B. Menyerap karbon biru (blue carbon) dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan.</p>
        <p>C. Melindungi bibit bandeng dan kepiting bakau dari pencemaran sampah plastik.</p>
        <p>D. Menahan laju intrusi air laut yang dipicu penurunan muka tanah ibu kota.</p>
        <p>KUNCI: B</p>
        <p>PEMBAHASAN: Hutan bakau berfungsi sebagai penyerap karbon biru dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan.</p>

        <br/>
        <p class="tag">[SUBTES: MTK]</p>
        <p class="tag">[STIMULUS]</p>
        <p>Menjelang tahun ajaran baru, koperasi sekolah memberikan diskon bertingkat untuk paket perlengkapan belajar. Setiap pembelian diberi diskon pertama sebesar 20%, dan khusus anggota koperasi mendapatkan tambahan diskon kedua sebesar 10% dari harga setelah diskon pertama.</p>
        <p class="tag">[/STIMULUS]</p>
        <p>2. Jika harga label satu set paket perlengkapan sekolah adalah Rp300.000, berapakah nominal yang harus dibayarkan oleh siswa yang terdaftar sebagai anggota koperasi?</p>
        <p>A. Rp210.000</p>
        <p>B. Rp216.000</p>
        <p>C. Rp220.000</p>
        <p>D. Rp240.000</p>
        <p>KUNCI: B</p>
        <p>PEMBAHASAN: Harga setelah diskon pertama (20%) = $300.000 \\times 80\\% = \\text{Rp}240.000$. Harga setelah diskon kedua (10%) = $240.000 \\times 90\\% = \\text{Rp}216.000$.</p>
      </body>
      </html>
    `;

        const blob = new Blob(["\ufeff", htmlDoc], { type: "application/msword;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Template_Naskah_Word_TKA_SMP_M18.doc");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUploadDocxDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const extractedText = result.value || "";

            const rowsToInsert = parseRawWordBlocks(extractedText);
            if (rowsToInsert.length === 0) {
                alert(
                    "Tidak ada butir soal yang terdeteksi dari file .docx. Pastikan format penomoran (1. Pertanyaan, A. Opsi, KUNCI: B) sudah sesuai template."
                );
                return;
            }

            const { error } = await supabase.from("tka_questions").insert(rowsToInsert);
            if (error) throw error;

            await fetchQuestionsFromSupabase();
            setActiveTab("koleksi");
            alert(`Berhasil mengimpor ${rowsToInsert.length} butir soal dari file ${file.name} ke Supabase!`);
        } catch (err: any) {
            console.error(err);
            alert("Gagal membaca file .docx: " + (err?.message || "Pastikan file berformat .docx (Word 2007+)"));
        } finally {
            setIsSaving(false);
            e.target.value = "";
        }
    };

    const handleParseWordPaste = async () => {
        if (!pasteText.trim()) {
            alert("Kotak teks naskah masih kosong!");
            return;
        }

        setIsSaving(true);
        try {
            const rowsToInsert = parseRawWordBlocks(pasteText);
            if (rowsToInsert.length === 0) {
                alert("Format teks tidak terdeteksi. Gunakan format: 1. Pertanyaan, A. Opsi, B. Opsi, KUNCI: X");
                return;
            }

            const { error } = await supabase.from("tka_questions").insert(rowsToInsert);
            if (error) throw error;

            await fetchQuestionsFromSupabase();
            setPasteText("");
            setActiveTab("koleksi");
            alert(`Berhasil menyimpan ${rowsToInsert.length} butir soal TKA SMP ke Supabase!`);
        } catch (err: any) {
            alert("Gagal menyimpan naskah Word ke Supabase: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadCsvTemplateM18 = () => {
        const headers =
            "No,Subtes,Wacana / Stimulus,Link Gambar (Opsional),Posisi Gambar,Pertanyaan,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,Kunci Jawaban,Tingkat Kesukaran,Pembahasan\n";
        const row1 = `1,"BINDO","Kawasan ekosistem mangrove di pesisir utara Jakarta memegang peranan krusial dalam menahan laju intrusi air laut ke daratan...","","above","Berdasarkan teks wacana di atas, fungsi utama ekosistem mangrove yang terkait langsung dengan mitigasi perubahan iklim global adalah...","Mencegah abrasi fisik tanah pesisir akibat gelombang laut tinggi.","Menyerap karbon biru (blue carbon) dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan.","Melindungi bibit bandeng dan kepiting bakau dari pencemaran sampah plastik.","Menahan laju intrusi air laut yang dipicu penurunan muka tanah ibu kota.","","B","Mudah","Hutan bakau berfungsi sebagai penyerap karbon biru dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan."\n`;
        const row2 = `2,"MTK","Menjelang tahun ajaran baru, koperasi pendidikan memberikan promosi diskon bertingkat untuk paket seragam...","","above","Jika harga label satu set paket perlengkapan sekolah adalah Rp300.000, berapakah nominal rupiah yang harus dibayarkan oleh siswa anggota koperasi?","Rp 210.000","Rp 216.000","Rp 220.000","Rp 240.000","","B","Sedang","Diskon 1 (20%): Rp300.000 x 0.8 = Rp240.000. Diskon 2 (10%): Rp240.000 x 0.9 = Rp216.000."\n`;

        const blob = new Blob(["\ufeff", headers + row1 + row2], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Template_Bank_Soal_TKA_SMP_M18.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportCurrentCsv = () => {
        if (questions.length === 0) return;
        const headers =
            "No,Subtes,Wacana / Stimulus,Link Gambar (Opsional),Posisi Gambar,Pertanyaan,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,Kunci Jawaban,Tingkat Kesukaran,Pembahasan\n";
        const esc = (val?: string) => `"${String(val || "").replace(/"/g, '""')}"`;

        const body = questions
            .map((q, idx) =>
                [
                    q.no_soal || idx + 1,
                    esc(q.subtes_code),
                    esc(q.stimulus),
                    esc(q.image_url),
                    esc(q.image_position || "above"),
                    esc(q.pertanyaan),
                    esc(q.opsi_a),
                    esc(q.opsi_b),
                    esc(q.opsi_c),
                    esc(q.opsi_d),
                    esc(q.opsi_e),
                    esc(q.kunci),
                    esc(q.tingkat_kesukaran || "Sedang"),
                    esc(q.pembahasan)
                ].join(",")
            )
            .join("\n");

        const blob = new Blob(["\ufeff", headers + body], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Koleksi_Bank_Soal_TKA_SMP_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
                    setActiveTab("koleksi");
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
        <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans text-slate-800 overflow-x-hidden">
            {/* HEADER ATAS BERGAYA CBT SNBT */}
            <header className="bg-white border-b border-slate-200 py-3 px-4 sm:px-8 sticky top-0 z-30 shadow-2xs">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            href="/admin"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition shrink-0 cursor-pointer"
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
                        <div className="min-w-0">
                            <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight uppercase truncate">
                                BANK SOAL • SMA MUHAMMADIYAH 18
                            </h1>
                            <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                                Tryout Terstandarisasi TKA Jenjang SMP (BINDO & MTK)
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={fetchQuestionsFromSupabase}
                        disabled={isLoading || isSaving}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
                        <span>Refresh Data</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl w-full mx-auto p-3.5 sm:p-6 space-y-5 text-left">
                {/* 1. BANNER STATUS PENYIMPANAN CLOUD SUPABASE */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-xs sm:text-sm text-slate-900">
                                    Penyimpanan Cloud Supabase PostgreSQL (2 Mapel TKA SMP)
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-bold">
                                    Aktif • {stats.total} Butir Soal
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Paket Aktif: <strong className="text-blue-700 font-mono">PAKET 1</strong> • Tersinkron otomatis ke seluruh perangkat siswa
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <span className="px-3 py-1.5 rounded-xl bg-blue-700 text-white font-mono text-[11px] font-bold shadow-2xs">
                            PAKET 1 (BINDO & MTK)
                        </span>
                    </div>
                </div>

                {/* 2. KARTU RINGKASAN PER MATA PELAJARAN (BINDO & MTK) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedSubtest("BINDO");
                            setActiveTab("koleksi");
                        }}
                        className={`p-4 sm:p-5 rounded-3xl border text-left transition cursor-pointer bg-white shadow-2xs hover:border-blue-400 ${selectedSubtest === "BINDO" ? "border-blue-600 ring-2 ring-blue-600/15" : "border-slate-200"
                            }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10px] font-black">
                                BINDO
                            </span>
                            <BookOpen className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900">Bahasa Indonesia (Literasi Membaca)</div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl sm:text-2xl font-black font-mono text-blue-700">{stats.bindo}</span>
                            <span className="text-[11px] font-mono text-slate-400">Butir Soal</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                            <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${stats.total > 0 ? Math.round((stats.bindo / stats.total) * 100) : 0}%` }}
                            />
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedSubtest("MTK");
                            setActiveTab("koleksi");
                        }}
                        className={`p-4 sm:p-5 rounded-3xl border text-left transition cursor-pointer bg-white shadow-2xs hover:border-emerald-400 ${selectedSubtest === "MTK" ? "border-emerald-600 ring-2 ring-emerald-600/15" : "border-slate-200"
                            }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-black">
                                MTK
                            </span>
                            <Calculator className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900">Matematika (Numerasi & Aljabar SMP)</div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700">{stats.mtk}</span>
                            <span className="text-[11px] font-mono text-slate-400">Butir Soal</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                            <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${stats.total > 0 ? Math.round((stats.mtk / stats.total) * 100) : 0}%` }}
                            />
                        </div>
                    </button>
                </div>

                {/* 3. BAR NAVIGASI 3 TAB UTAMA (PERSIS CBT SNBT) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300">
                    <button
                        type="button"
                        onClick={() => setActiveTab("koleksi")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "koleksi"
                                ? "bg-white text-blue-800 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span>Koleksi Soal ({stats.total})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("word")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "word"
                                ? "bg-white text-blue-800 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span>Import Naskah Word (.docx)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("csv")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "csv"
                                ? "bg-white text-blue-800 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Import Massal CSV / Excel</span>
                    </button>
                </div>

                {/* TAB 1: KOLEKSI SOAL LENGKAP */}
                {activeTab === "koleksi" && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-7 shadow-2xs space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">
                                    Koleksi Soal Tryout TKA SMP ({filteredQuestions.length} Butir)
                                </h2>
                                <p className="text-[11px] text-slate-500">
                                    Menampilkan seluruh naskah soal, wacana, opsi jawaban, dan kunci aktif di server Supabase.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 sm:w-48">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Cari soal..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600"
                                    />
                                </div>

                                <select
                                    value={selectedSubtest}
                                    onChange={(e) => setSelectedSubtest(e.target.value as any)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none cursor-pointer"
                                >
                                    <option value="ALL">Semua Mapel ({stats.total})</option>
                                    <option value="BINDO">BINDO ({stats.bindo})</option>
                                    <option value="MTK">MTK ({stats.mtk})</option>
                                </select>

                                {questions.length > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleExportCurrentCsv}
                                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>Download CSV</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleClearAllQuestions}
                                            disabled={isSaving}
                                            className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Hapus Semua</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="py-12 text-center font-mono text-xs text-slate-400">
                                Memuat koleksi soal dari Supabase...
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="py-14 text-center space-y-3 border border-dashed border-slate-200 rounded-2xl px-4">
                                <FolderOpen className="w-9 h-9 mx-auto text-slate-300" />
                                <div className="text-xs text-slate-500">
                                    Koleksi soal masih kosong. Silakan pilih tab <strong>Import Naskah Word (.docx)</strong> atau{" "}
                                    <strong>Import Massal CSV / Excel</strong> untuk mengunggah soal.
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredQuestions.map((q, idx) => {
                                    const code = normalizeSubtestCode(q.subtes_code);
                                    const isMath = code === "MTK";
                                    const optionsList = [
                                        { key: "A", text: q.opsi_a },
                                        { key: "B", text: q.opsi_b },
                                        { key: "C", text: q.opsi_c },
                                        { key: "D", text: q.opsi_d },
                                        { key: "E", text: q.opsi_e }
                                    ].filter((opt) => opt.text !== undefined && opt.text !== null && String(opt.text).trim().length > 0);

                                    return (
                                        <div
                                            key={q.id || idx}
                                            className="p-4 sm:p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition space-y-4 shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="px-2.5 py-1 rounded-lg bg-[#1e3a8a] text-white font-mono text-[11px] font-black">
                                                        NO. {q.no_soal || idx + 1}
                                                    </span>
                                                    <span
                                                        className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border ${isMath
                                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                                : "bg-slate-100 text-slate-700 border-slate-200"
                                                            }`}
                                                    >
                                                        Subtes: {code}
                                                    </span>
                                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-black">
                                                        KUNCI: {q.kunci}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteOne(q.id)}
                                                    className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                                    title="Hapus butir soal ini"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {q.image_url && q.image_position === "above" && (
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                                                    <img
                                                        src={q.image_url}
                                                        alt="Gambar Soal"
                                                        className="max-h-56 object-contain rounded-lg max-w-full"
                                                    />
                                                </div>
                                            )}

                                            {q.stimulus && (
                                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line">
                                                    <RenderLatex content={q.stimulus} />
                                                </div>
                                            )}

                                            <div className="font-bold text-slate-900 text-xs sm:text-sm leading-relaxed">
                                                <RenderLatex content={q.pertanyaan} />
                                            </div>

                                            {q.image_url && q.image_position === "below" && (
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                                                    <img
                                                        src={q.image_url}
                                                        alt="Gambar Soal"
                                                        className="max-h-56 object-contain rounded-lg max-w-full"
                                                    />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                                {optionsList.map((opt) => {
                                                    const isKey = String(q.kunci || "").toUpperCase().trim() === opt.key;
                                                    return (
                                                        <div
                                                            key={opt.key}
                                                            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${isKey
                                                                    ? "bg-emerald-50/90 border-emerald-400 text-emerald-950 font-semibold"
                                                                    : "bg-slate-50/60 border-slate-200 text-slate-700"
                                                                }`}
                                                        >
                                                            <span className="font-mono font-black text-slate-600 shrink-0">{opt.key}.</span>
                                                            <div className="flex-1 leading-relaxed">
                                                                <RenderLatex content={opt.text} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {q.pembahasan && (
                                                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950">
                                                    <strong className="font-mono text-[10.5px] uppercase text-amber-800 mr-1.5">
                                                        Pembahasan:
                                                    </strong>
                                                    <RenderLatex content={q.pembahasan} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: IMPORT NASKAH WORD (.DOCX & COPY-PASTE) */}
                {activeTab === "word" && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-2xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">
                                    Import Naskah Soal dari Microsoft Word (.docx)
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Unduh template resmi, susun soal di MS Word, lalu unggah langsung file <strong>.docx</strong> atau tempel teksnya di bawah.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadWordTemplateM18}
                                className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download Template Word</span>
                            </button>
                        </div>

                        <div
                            onClick={() => docxInputRef.current?.click()}
                            className="border-2 border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                                <FileUp className="w-6 h-6" />
                            </div>
                            <div className="font-black text-sm text-slate-900">
                                {isSaving ? "Sedang Membaca & Menyimpan ke Supabase..." : "Klik untuk Unggah File Word (.docx)"}
                            </div>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Mendukung file <strong>.docx</strong> secara langsung tanpa perlu salin-tempel manual. Gunakan tag{" "}
                                <code>[SUBTES: BINDO]</code> atau <code>[SUBTES: MTK]</code> di dalam naskah.
                            </p>
                            <input
                                type="file"
                                ref={docxInputRef}
                                onChange={handleUploadDocxDirect}
                                accept=".docx"
                                className="hidden"
                            />
                        </div>

                        <div className="space-y-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <ClipboardPaste className="w-4 h-4 text-blue-700" />
                                <span>Atau Salin-Tempel Teks Naskah Word di Sini:</span>
                            </div>
                            <textarea
                                rows={8}
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder={`[SUBTES: BINDO]\n[STIMULUS]\nKawasan ekosistem mangrove di pesisir utara Jakarta...\n[/STIMULUS]\n1. Fungsi utama ekosistem mangrove adalah...\nA. Mencegah abrasi\nB. Menyerap karbon biru\nC. Melindungi bibit ikan\nD. Menahan intrusi\nKUNCI: B\nPEMBAHASAN: Hutan bakau menyerap karbon biru secara masif.\n\n[SUBTES: MTK]\n2. Nilai $x$ dari $2x + 6 = 16$ adalah...\nA. 3\nB. 5\nC. 7\nD. 9\nKUNCI: B`}
                                className="w-full p-3.5 rounded-2xl border border-slate-200 font-mono text-xs outline-none focus:border-blue-600"
                            />
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleParseWordPaste}
                                    disabled={isSaving}
                                    className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{isSaving ? "Menyimpan..." : "Proses & Simpan ke Supabase"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: IMPORT MASSAL CSV / EXCEL */}
                {activeTab === "csv" && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-2xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">
                                    Import Massal Soal dari Spreadsheet CSV / Excel
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Gunakan format 14 kolom resmi TKA SMP (<code>BINDO</code> & <code>MTK</code>) beserta dukungan link gambar dan rumus KaTeX.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadCsvTemplateM18}
                                className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download Template CSV</span>
                            </button>
                        </div>

                        <div
                            onClick={() => csvInputRef.current?.click()}
                            className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 rounded-2xl p-8 text-center space-y-2.5 cursor-pointer transition"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="font-black text-sm text-slate-900">
                                {isSaving ? "Menyimpan Data ke Supabase..." : "Klik untuk Memilih & Mengunggah File .CSV"}
                            </div>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Pastikan pemisah kolom menggunakan koma (<code>,</code>) atau simpan dari Excel sebagai{" "}
                                <strong>CSV UTF-8 (Comma delimited)</strong>.
                            </p>
                            <input
                                type="file"
                                ref={csvInputRef}
                                onChange={handleUploadCsvM18}
                                accept=".csv"
                                className="hidden"
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}