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
    FileText,
    Image as ImageIcon
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

function normalizeQuestionType(raw: string): "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI" {
    const upper = String(raw || "").toUpperCase().trim();
    if (upper.includes("MCMA") || upper.includes("MULTI")) return "PGK_MCMA";
    if (upper.includes("KATEGORI") || upper.includes("BENAR") || upper.includes("MATRIKS")) return "PGK_KATEGORI";
    return "PG_SEDERHANA";
}

// Konversi HTML hasil Mammoth menjadi teks terstruktur + menyisipkan tag [IMG_DATA:data:image/...]
function htmlToStructuredWordText(html: string): string {
    if (typeof window === "undefined") return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Ubah setiap elemen <img> di dalam dokumen Word menjadi penanda baris [IMG_DATA:...]
    doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (src) {
            const marker = doc.createTextNode(`\n[IMG_DATA:${src}]\n`);
            img.replaceWith(marker);
        }
    });

    // Ubah tag paragraf/baris menjadi newline bersih
    doc.querySelectorAll("p, div, tr, li, br, h1, h2, h3, h4").forEach((el) => {
        el.appendChild(doc.createTextNode("\n"));
    });

    return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// Parser Naskah Word: Memecah per blok [SUBTES: ...] agar PGK_KATEGORI (P1, P2, P3) & Gambar tidak terpotong
function parseStructuredWordBlocks(rawText: string) {
    const hasSubtesTags = /\[SUBTES:/i.test(rawText);
    const blocks = hasSubtesTags
        ? rawText.split(/(?=\[SUBTES:)/i).filter((b) => /\[SUBTES:/i.test(b))
        : rawText.split(/(?=\n\d+\.\s+)/g).filter((b) => b.trim().length > 0);

    const rowsToInsert: any[] = [];
    let bindoCounter = 0;
    let mtkCounter = 0;

    blocks.forEach((block) => {
        // 1. Subtes (BINDO / MTK)
        const subMatch = block.match(/\[SUBTES:\s*([^\]]+)\]/i);
        const currentSubCode = normalizeSubtestCode(subMatch ? subMatch[1] : "BINDO");

        if (currentSubCode === "MTK") mtkCounter++;
        else bindoCounter++;
        const noSoal = currentSubCode === "MTK" ? mtkCounter : bindoCounter;

        // 2. Gambar tertanam dari .docx atau tag [GAMBAR: ...]
        const imgDataMatch = block.match(/\[IMG_DATA:(data:image\/[^\]]+)\]/i);
        const imgUrlMatch = block.match(/\[GAMBAR:\s*([^\]]+)\]/i);
        const image_url = imgDataMatch
            ? imgDataMatch[1].trim()
            : imgUrlMatch
                ? imgUrlMatch[1].trim()
                : "";

        // Bersihkan marker gambar dari teks sebelum membaca stimulus/pertanyaan
        const cleanBlock = block
            .replace(/\[IMG_DATA:[^\]]+\]/gi, "")
            .replace(/\[GAMBAR:[^\]]+\]/gi, "");

        // 3. Elemen Materi
        const materiMatch = cleanBlock.match(/\[MATERI:\s*([^\]]+)\]/i);
        const materi = materiMatch
            ? materiMatch[1].trim()
            : currentSubCode === "MTK"
                ? "Bilangan"
                : "Pemahaman Tekstual";

        // 4. Tingkat Kesukaran
        const diffTagMatch = cleanBlock.match(/\[KESUKARAN:\s*([^\]]+)\]/i);
        const tingkat_kesukaran = diffTagMatch ? diffTagMatch[1].trim() : "Sedang";
        const diffMap: Record<string, number> = { mudah: 1, sedang: 2, sulit: 3, sukar: 3 };
        const difficulty = diffMap[tingkat_kesukaran.toLowerCase()] ?? 2;

        // 5. Tipe Soal
        const typeTagMatch = cleanBlock.match(/\[TIPE:\s*([^\]]+)\]/i);
        let qType: "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI" = typeTagMatch
            ? normalizeQuestionType(typeTagMatch[1])
            : "PG_SEDERHANA";

        // 6. Stimulus
        const stimMatch = cleanBlock.match(/\[STIMULUS\]([\s\S]*?)\[\/STIMULUS\]/i);
        const stimulus = stimMatch ? stimMatch[1].trim() : "";

        // Ambil bagian setelah [/STIMULUS] (atau setelah baris tag [SUBTES:...])
        let bodyAfterStimulus = cleanBlock;
        if (/\[\/STIMULUS\]/i.test(cleanBlock)) {
            bodyAfterStimulus = cleanBlock.split(/\[\/STIMULUS\]/i)[1] || "";
        } else {
            bodyAfterStimulus = cleanBlock.replace(/^\[SUBTES:[^\n]+\n?/i, "");
        }

        // 7. Pembahasan
        const expMatch = bodyAfterStimulus.match(/PEMBAHASAN:\s*([\s\S]*?)$/i);
        const pembahasan = expMatch ? expMatch[1].trim() : "";
        const questionAndOptionsPart = bodyAfterStimulus.replace(/PEMBAHASAN:\s*[\s\S]*$/i, "").trim();

        if (qType === "PGK_KATEGORI" || /(?:^|\n)P1\s*[:\.]/im.test(questionAndOptionsPart)) {
            qType = "PGK_KATEGORI";
            const qMatch = questionAndOptionsPart.match(/^(?:\d+\.\s*)?([\s\S]*?)(?=(?:^|\n)P1\s*[:\.])/im);
            const pertanyaan = qMatch ? qMatch[1].trim() : "";

            const statements: string[] = [];
            const keys: string[] = [];
            for (let p = 1; p <= 5; p++) {
                const regex = new RegExp(`(?:^|\\n)P${p}\\s*[:\\.]\\s*([^\\n]+)`, "i");
                const m = questionAndOptionsPart.match(regex);
                if (m && m[1]) {
                    const parts = m[1].split("|").map((s) => s.trim());
                    statements.push(parts[0] || "");
                    keys.push(parts[1] || "Benar");
                }
            }

            if (pertanyaan && statements.length >= 2) {
                rowsToInsert.push({
                    no_soal: noSoal,
                    subtes_code: currentSubCode,
                    subject: currentSubCode === "MTK" ? "Matematika" : "Bahasa Indonesia",
                    materi,
                    type: "PGK_KATEGORI",
                    stimulus,
                    image_url,
                    image_position: "above",
                    pertanyaan,
                    opsi_a: statements[0] || "",
                    opsi_b: statements[1] || "",
                    opsi_c: statements[2] || "",
                    opsi_d: statements[3] || "",
                    opsi_e: statements[4] || "",
                    kunci: keys.join("|"),
                    difficulty,
                    tingkat_kesukaran,
                    pembahasan
                });
            }
        } else {
            const qMatch = questionAndOptionsPart.match(
                /^(?:\d+\.\s*)?([\s\S]*?)(?=(?:^|\n)A\.\s*)/m
            );
            const pertanyaan = qMatch ? qMatch[1].trim() : "";

            const opsi_a =
                questionAndOptionsPart.match(/(?:^|\n)A\.\s*([\s\S]*?)(?=(?:\n[B-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
            const opsi_b =
                questionAndOptionsPart.match(/(?:^|\n)B\.\s*([\s\S]*?)(?=(?:\n[C-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
            const opsi_c =
                questionAndOptionsPart.match(/(?:^|\n)C\.\s*([\s\S]*?)(?=(?:\n[D-E]\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
            const opsi_d =
                questionAndOptionsPart.match(/(?:^|\n)D\.\s*([\s\S]*?)(?=(?:\nE\.|\nKUNCI:|$))/)?.[1]?.trim() || "";
            const opsi_e =
                questionAndOptionsPart.match(/(?:^|\n)E\.\s*([\s\S]*?)(?=(?:\nKUNCI:|$))/)?.[1]?.trim() || "";

            const keyMatch = questionAndOptionsPart.match(/KUNCI:\s*([A-E,\s]+)/i);
            const rawKunci = keyMatch ? keyMatch[1].toUpperCase().replace(/\s+/g, "") : "A";
            if (rawKunci.includes(",")) {
                qType = "PGK_MCMA";
            }

            if (pertanyaan && opsi_a && opsi_b) {
                rowsToInsert.push({
                    no_soal: noSoal,
                    subtes_code: currentSubCode,
                    subject: currentSubCode === "MTK" ? "Matematika" : "Bahasa Indonesia",
                    materi,
                    type: qType,
                    stimulus,
                    image_url,
                    image_position: "above",
                    pertanyaan,
                    opsi_a,
                    opsi_b,
                    opsi_c,
                    opsi_d,
                    opsi_e,
                    kunci: rawKunci,
                    difficulty,
                    tingkat_kesukaran,
                    pembahasan
                });
            }
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
                    materi: q.materi || (code === "MTK" ? "Bilangan" : "Pemahaman Tekstual"),
                    type: normalizeQuestionType(q.type),
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
      <head><meta charset='utf-8'><title>Template Naskah Soal TKA SMP</title></head>
      <body style="font-family: Calibri, sans-serif; font-size: 11pt;">
        <p><b>[SUBTES: BINDO] [MATERI: Pemahaman Tekstual] [TIPE: PG_SEDERHANA] [KESUKARAN: Mudah]</b></p>
        <p><b>[STIMULUS]</b></p>
        <p>Hutan mangrove menyerap karbon biru hingga lima kali lebih besar dibandingkan hutan hujan tropis daratan.</p>
        <p><b>[/STIMULUS]</b></p>
        <p>1. Keunggulan ekosistem hutan mangrove dalam menyerap karbon adalah...</p>
        <p>A. Dua kali lebih cepat</p>
        <p>B. Lima kali lebih besar dibandingkan hutan hujan tropis daratan</p>
        <p>C. Sama dengan hutan produksi</p>
        <p>D. Tiga kali lebih kecil</p>
        <p><b>KUNCI: B</b></p>
        <p>PEMBAHASAN: Sesuai kalimat pertama stimulus.</p>
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

    // Unggah .docx langsung mengekstrak teks + gambar tertanam (convertToHtml)
    const handleUploadDocxDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const structuredText = htmlToStructuredWordText(result.value || "");

            const rowsToInsert = parseStructuredWordBlocks(structuredText);
            if (rowsToInsert.length === 0) {
                alert("Tidak ada butir soal yang terdeteksi dari file .docx. Pastikan format tag sudah sesuai.");
                return;
            }

            // Simpan per batch 20 soal agar payload gambar tetap ringan dan cepat di Supabase
            const batchSize = 20;
            for (let i = 0; i < rowsToInsert.length; i += batchSize) {
                const chunk = rowsToInsert.slice(i, i + batchSize);
                const { error } = await supabase.from("tka_questions").insert(chunk);
                if (error) throw error;
            }

            await fetchQuestionsFromSupabase();
            setActiveTab("koleksi");
            const withImages = rowsToInsert.filter((r) => Boolean(r.image_url)).length;
            alert(
                `Berhasil mengimpor ${rowsToInsert.length} butir soal (${withImages} soal bergambar) dari ${file.name} ke Supabase!`
            );
        } catch (err: any) {
            alert("Gagal membaca file .docx: " + (err?.message || "Pastikan file berformat .docx"));
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
            const rowsToInsert = parseStructuredWordBlocks(pasteText);
            if (rowsToInsert.length === 0) {
                alert("Format teks tidak terdeteksi.");
                return;
            }

            const { error } = await supabase.from("tka_questions").insert(rowsToInsert);
            if (error) throw error;

            await fetchQuestionsFromSupabase();
            setPasteText("");
            setActiveTab("koleksi");
            alert(`Berhasil menyimpan ${rowsToInsert.length} butir soal TKA SMP ke Supabase!`);
        } catch (err: any) {
            alert("Gagal menyimpan naskah ke Supabase: " + (err?.message || "Kesalahan server"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadCsvTemplateM18 = () => {
        const headers =
            "No,Subtes,Elemen Materi,Tipe Soal,Wacana / Stimulus,Link Gambar,Posisi Gambar,Pertanyaan,Opsi A / P1,Opsi B / P2,Opsi C / P3,Opsi D / P4,Opsi E / P5,Kunci Jawaban,Tingkat Kesukaran,Pembahasan\n";
        const row1 = `1,"BINDO","Pemahaman Tekstual","PG_SEDERHANA","Kawasan ekosistem mangrove...","","above","Fungsi utama ekosistem mangrove adalah...","Mencegah abrasi","Menyerap karbon biru 5x lebih tinggi","Melindungi bibit ikan","Menahan intrusi air laut","","B","Mudah","Hutan bakau berfungsi sebagai penyerap karbon biru."\n`;

        const blob = new Blob(["\ufeff", headers + row1], { type: "text/csv;charset=utf-8;" });
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
            "No,Subtes,Elemen Materi,Tipe Soal,Wacana / Stimulus,Link Gambar,Posisi Gambar,Pertanyaan,Opsi A / P1,Opsi B / P2,Opsi C / P3,Opsi D / P4,Opsi E / P5,Kunci Jawaban,Tingkat Kesukaran,Pembahasan\n";
        const esc = (val?: string) => `"${String(val || "").replace(/"/g, '""')}"`;

        const body = questions
            .map((q, idx) =>
                [
                    q.no_soal || idx + 1,
                    esc(q.subtes_code),
                    esc(q.materi),
                    esc(q.type),
                    esc(q.stimulus),
                    esc(q.image_url?.startsWith("data:") ? "[EMBEDDED_IMAGE]" : q.image_url),
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
                    alert("File CSV kosong!");
                    return;
                }

                const rowsToInsert: any[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    if (row.length < 8) continue;

                    const no_soal = Number(row[0]) || i;
                    const subtes_code = normalizeSubtestCode(row[1]);
                    const subject = subtes_code === "MTK" ? "Matematika" : "Bahasa Indonesia";
                    const materi = row[2] || (subtes_code === "MTK" ? "Bilangan" : "Pemahaman Tekstual");
                    const type = normalizeQuestionType(row[3]);

                    const stimulus = row[4] || "";
                    const image_url = row[5] && row[5] !== "[EMBEDDED_IMAGE]" ? row[5] : "";
                    const image_position = row[6]?.toLowerCase() === "below" ? "below" : "above";
                    const pertanyaan = row[7] || "";

                    const opsi_a = row[8] || "";
                    const opsi_b = row[9] || "";
                    const opsi_c = row[10] || "";
                    const opsi_d = row[11] || "";
                    const opsi_e = row[12] || "";

                    const kunci = (row[13] || "A").trim();
                    const tingkat_kesukaran = row[14] || "Sedang";
                    const diffMap: Record<string, number> = { mudah: 1, sedang: 2, sulit: 3, sukar: 3 };
                    const difficulty = diffMap[tingkat_kesukaran.toLowerCase()] ?? 2;
                    const pembahasan = row[15] || "";

                    if (pertanyaan) {
                        rowsToInsert.push({
                            no_soal,
                            subtes_code,
                            subject,
                            materi,
                            type,
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
                }
            } catch (err: any) {
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
                (q.stimulus && q.stimulus.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (q.materi && q.materi.toLowerCase().includes(searchQuery.toLowerCase()));

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
                                Perkaban No. 047/H/AN/2025 • PG Biasa, PGK MCMA & PGK Kategori
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
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-xs sm:text-sm text-slate-900">
                                    Penyimpanan Cloud Supabase PostgreSQL (7 Elemen Kompetensi TKA SMP)
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-bold">
                                    Aktif • {stats.total} Butir Soal
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Otomatis mengekstrak <strong>3 bentuk soal</strong> dan <strong>gambar diagram tertanam</strong> langsung dari file Word (<code>.docx</code>).
                            </p>
                        </div>
                    </div>

                    <span className="px-3 py-1.5 rounded-xl bg-blue-700 text-white font-mono text-[11px] font-bold shadow-2xs self-start sm:self-auto">
                        PAKET 1 (BINDO & MTK)
                    </span>
                </div>

                {/* KARTU MAPEL */}
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
                        <div className="font-bold text-xs sm:text-sm text-slate-900">
                            Bahasa Indonesia (Tekstual, Inferensial & Evaluasi/Apresiasi)
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl sm:text-2xl font-black font-mono text-blue-700">{stats.bindo}</span>
                            <span className="text-[11px] font-mono text-slate-400">Butir Soal</span>
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
                        <div className="font-bold text-xs sm:text-sm text-slate-900">
                            Matematika (Bilangan, Aljabar, Geometri & Data Peluang)
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700">{stats.mtk}</span>
                            <span className="text-[11px] font-mono text-slate-400">Butir Soal</span>
                        </div>
                    </button>
                </div>

                {/* BAR 3 TAB */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300">
                    <button
                        type="button"
                        onClick={() => setActiveTab("koleksi")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "koleksi" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span>Koleksi Soal ({stats.total})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("word")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "word" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span>Import Naskah Word (.docx)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("csv")}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === "csv" ? "bg-white text-blue-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Import Massal CSV / Excel</span>
                    </button>
                </div>

                {/* TAB 1: KOLEKSI SOAL */}
                {activeTab === "koleksi" && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-7 shadow-2xs space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">
                                    Koleksi Soal Tryout TKA SMP ({filteredQuestions.length} Butir)
                                </h2>
                                <p className="text-[11px] text-slate-500">
                                    Menampilkan seluruh naskah soal, gambar ilustrasi, elemen materi, bentuk soal, dan kunci aktif.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 sm:w-48">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Cari soal / materi..."
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
                                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>Download CSV</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleClearAllQuestions}
                                            disabled={isSaving}
                                            className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
                                    Koleksi soal masih kosong. Pilih tab <strong>Import Naskah Word (.docx)</strong> untuk mengunggah file Word Bapak.
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

                                    const keyArray = String(q.kunci || "").split(",").map((k) => k.trim());
                                    const categoryKeys = String(q.kunci || "").split("|").map((k) => k.trim());

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
                                                        {code}
                                                    </span>
                                                    {q.materi && (
                                                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10.5px] font-bold">
                                                            {q.materi}
                                                        </span>
                                                    )}
                                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10.5px] font-bold">
                                                        {q.type}
                                                    </span>
                                                    {q.image_url && (
                                                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10.5px] font-bold inline-flex items-center gap-1">
                                                            <ImageIcon className="w-3 h-3" /> Bergambar
                                                        </span>
                                                    )}
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

                                            {q.image_url && (
                                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-center">
                                                    <img
                                                        src={q.image_url}
                                                        alt={`Ilustrasi Soal ${q.no_soal}`}
                                                        className="max-h-56 object-contain rounded-xl"
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

                                            {q.type === "PGK_KATEGORI" ? (
                                                <div className="space-y-2 pt-1">
                                                    {optionsList.map((opt, oIdx) => (
                                                        <div
                                                            key={opt.key}
                                                            className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex items-center justify-between gap-3"
                                                        >
                                                            <div className="flex-1">
                                                                <strong className="font-mono mr-2">P{oIdx + 1}.</strong>
                                                                <RenderLatex content={opt.text} />
                                                            </div>
                                                            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[10.5px] shrink-0">
                                                                {categoryKeys[oIdx] || "Benar"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                                    {optionsList.map((opt) => {
                                                        const isKey = keyArray.includes(opt.key);
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
                                            )}

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

                {/* TAB 2: IMPORT WORD (.DOCX) */}
                {activeTab === "word" && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-2xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">
                                    Import Naskah Soal dari Microsoft Word (.docx)
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Otomatis membaca seluruh <strong>PG Sederhana</strong>, <strong>PGK MCMA</strong>,{" "}
                                    <strong>PGK Kategori (P1/P2/P3)</strong>, beserta <strong>gambar diagram tertanam</strong> di dalam Word.
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
                                {isSaving ? "Sedang Membaca Soal & Gambar ke Supabase..." : "Klik untuk Unggah File Word (.docx)"}
                            </div>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Mendukung file <strong>.docx</strong> lengkap dengan gambar diagram dan 3 tipe soal Pusmendik.
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
                                placeholder={`[SUBTES: BINDO] [MATERI: Pemahaman Tekstual] [TIPE: PG_SEDERHANA]\n1. Contoh pertanyaan...\nA. Opsi A\nB. Opsi B\nC. Opsi C\nD. Opsi D\nKUNCI: B`}
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

                {/* TAB 3: IMPORT CSV */}
                {activeTab === "csv" && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-2xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">
                                    Import Massal Soal dari Spreadsheet CSV / Excel
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Format 16 kolom resmi mencakup <strong>Elemen Materi</strong> dan <strong>3 Tipe Soal</strong>.
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