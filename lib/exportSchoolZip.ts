import JSZip from "jszip";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import * as XLSX from "xlsx";

export interface ZipStudentPayload {
    rankParallelOverall: number;
    rankParallelBindo: number;
    rankParallelMtk: number;
    totalParallelFinished: number;
    rankInSchool: number;
    totalInSchool: number;
    rankBindo: number;
    rankMtk: number;
    phone: string;
    name: string;
    school: string;
    grade: string;
    bindoScore: number;
    mtkScore: number;
    overallScore: number;
    bindoCategory: string;
    mtkCategory: string;
    schoolAvgBindo: number;
    schoolAvgMtk: number;
    schoolAvgOverall: number;
    hexagonPoints: Array<{
        key: string;
        short: string;
        studentPct: number;
        schoolPct: number;
    }>;
    strongestAxis: string;
    weakestAxis: string;
    sevenCompetencies: Array<{
        code: string;
        subject: string;
        rawCorrect: number;
        totalQ: number;
        pct: number;
        category: string;
    }>;
    itemRows: Array<{
        no_soal: number;
        subtes_code: "BINDO" | "MTK";
        element: string;
        studentAnsLabel: string;
        keyLabel: string;
        status: string;
    }>;
}

export interface ZipOfficialsPayload {
    kepalaSekolahNama: string;
    kepalaSekolahNbm: string;
    kepsekSignatureUrl?: string;
}

function fmtID(n: number): string {
    return (Number(n) || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function renderSignatureBlockHtml(officials: ZipOfficialsPayload, dateStr: string): string {
    const sigImg =
        officials.kepsekSignatureUrl && officials.kepsekSignatureUrl.trim().length > 10
            ? `<img src="${officials.kepsekSignatureUrl}" alt="TTD" style="height:74px;max-width:190px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
            : `<div style="height:64px;"></div>`;

    return `
        <div style="display:flex;justify-content:flex-end;margin-top:14px;font-size:10.5px;">
            <div style="width:265px;text-align:center;line-height:1.35;">
                <div>Jakarta, ${dateStr}</div>
                <div style="font-weight:bold;">Kepala SMA Muhammadiyah 18 Jakarta</div>
                <div style="height:76px;display:flex;align-items:center;justify-content:center;margin:2px 0;">
                    ${sigImg}
                </div>
                <div style="font-weight:bold;text-decoration:underline;">${officials.kepalaSekolahNama}</div>
                <div style="font-size:9.5px;font-family:monospace;">NBM. ${officials.kepalaSekolahNbm}</div>
            </div>
        </div>
    `;
}

// ============================================================================
// 1. GENERATOR EXCEL ASLI (.XLSX)
// ============================================================================
export function exportRankingToExcelXlsx(
    mode: "PARALLEL" | "SCHOOL",
    scopeTitle: string,
    studentsList: ZipStudentPayload[]
) {
    const sorted = [...studentsList].sort((a, b) =>
        mode === "SCHOOL" ? a.rankInSchool - b.rankInSchool : a.rankParallelOverall - b.rankParallelOverall
    );

    const rows = sorted.map((s) =>
        mode === "SCHOOL"
            ? {
                "Rank Sekolah": s.rankInSchool,
                "Rank Paralel": s.rankParallelOverall,
                "Nama Peserta": s.name,
                Kelas: s.grade,
                "Nilai B. Indonesia": Number(s.bindoScore.toFixed(2)),
                "Kategori BINDO": s.bindoCategory,
                "Nilai Matematika": Number(s.mtkScore.toFixed(2)),
                "Kategori MTK": s.mtkCategory,
                "Rata-Rata Nilai": Number(s.overallScore.toFixed(2))
            }
            : {
                "Rank Paralel": s.rankParallelOverall,
                "Nama Peserta": s.name,
                "Asal Sekolah (SMP/MTs)": s.school,
                Kelas: s.grade,
                "Rank di Sekolahnya": `#${s.rankInSchool} dari ${s.totalInSchool}`,
                "Nilai B. Indonesia": Number(s.bindoScore.toFixed(2)),
                "Kategori BINDO": s.bindoCategory,
                "Nilai Matematika": Number(s.mtkScore.toFixed(2)),
                "Kategori MTK": s.mtkCategory,
                "Rata-Rata Nilai": Number(s.overallScore.toFixed(2))
            }
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] =
        mode === "SCHOOL"
            ? [
                { wch: 14 },
                { wch: 14 },
                { wch: 30 },
                { wch: 8 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 }
            ]
            : [
                { wch: 14 },
                { wch: 30 },
                { wch: 32 },
                { wch: 8 },
                { wch: 20 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 }
            ];

    const wb = XLSX.utils.book_new();
    const sheetName = mode === "SCHOOL" ? "Peringkat Sekolah" : "Peringkat Paralel";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const slug = scopeTitle.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    const prefix = mode === "SCHOOL" ? `Tabel_Peringkat_${slug}` : "Tabel_Peringkat_Paralel_Semua_Sekolah";
    XLSX.writeFile(wb, `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 2. GENERATOR PDF REKAP TABEL PERINGKAT (MULTI-HALAMAN UNTUK RATUSAN/RIBUAN)
// ============================================================================
export async function buildRankingTablePdfBlob(
    mode: "PARALLEL" | "SCHOOL",
    scopeTitle: string,
    studentsList: ZipStudentPayload[],
    officials: ZipOfficialsPayload
): Promise<Blob> {
    const sorted = [...studentsList].sort((a, b) =>
        mode === "SCHOOL" ? a.rankInSchool - b.rankInSchool : a.rankParallelOverall - b.rankParallelOverall
    );

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const dateStr = new Date().toLocaleDateString("id-ID", { dateStyle: "long" });

    const pages: ZipStudentPayload[][] = [];
    if (sorted.length === 0) {
        pages.push([]);
    } else {
        pages.push(sorted.slice(0, 26));
        for (let idx = 26; idx < sorted.length; idx += 34) {
            pages.push(sorted.slice(idx, idx + 34));
        }
    }

    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0";
    host.style.width = "794px";
    host.style.background = "#ffffff";
    host.style.color = "#0f172a";
    host.style.fontFamily = "Arial, Helvetica, sans-serif";
    document.body.appendChild(host);

    try {
        for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            const chunk = pages[pIdx];
            const isFirst = pIdx === 0;
            const isLast = pIdx === pages.length - 1;

            const headerHtml = isFirst
                ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <img src="/logo-timsim.jpg" style="width:62px;height:62px;object-fit:contain;" />
                        <div style="flex:1;text-align:center;">
                            <div style="font-size:10px;font-weight:bold;text-transform:uppercase;">MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL</div>
                            <div style="font-size:9.5px;font-weight:bold;text-transform:uppercase;">PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN</div>
                            <div style="font-size:18px;font-weight:900;color:#1e3a8a;text-transform:uppercase;margin:2px 0;">SMA MUHAMMADIYAH 18 JAKARTA</div>
                            <div style="font-size:9px;color:#475569;">Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp. (021) 7235544</div>
                        </div>
                        <div style="width:62px;"></div>
                    </div>
                    <div style="border-bottom:2.5px solid #000;margin-top:6px;"></div>
                    <div style="border-bottom:1px solid #000;margin-top:2px;margin-bottom:10px;"></div>

                    <div style="text-align:center;margin-bottom:10px;">
                        <div style="font-size:12.5px;font-weight:900;text-decoration:underline;text-transform:uppercase;">
                            ${mode === "SCHOOL"
                    ? `DAFTAR PERINGKAT HASIL TRYOUT TKA SMP/MTs - ${scopeTitle}`
                    : "DAFTAR PERINGKAT PARALEL LINTAS SEKOLAH TRYOUT TKA SMP/MTs"
                }
                        </div>
                        <div style="font-size:9.5px;font-family:monospace;color:#334155;margin-top:2px;">
                            Total Peserta: ${sorted.length} Siswa • Skala Nilai 0,00 - 100,00 Berbobot Tingkat Kesulitan Soal
                        </div>
                    </div>
                `
                : `
                    <div style="display:flex;justify-content:space-between;font-size:9px;font-family:monospace;color:#475569;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;">
                        <span>${mode === "SCHOOL"
                    ? `DAFTAR PERINGKAT TRYOUT TKA SMP - ${scopeTitle}`
                    : "DAFTAR PERINGKAT PARALEL LINTAS SEKOLAH TRYOUT TKA SMP"
                }</span>
                        <span>Halaman ${pIdx + 1} dari ${pages.length}</span>
                    </div>
                `;

            const tableHeadHtml =
                mode === "SCHOOL"
                    ? `
                        <tr style="background:#f1f5f9;font-family:monospace;font-size:9.5px;">
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:72px;white-space:nowrap;">RANK SMP</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:86px;white-space:nowrap;">PARALEL</th>
                            <th style="border:1px solid #000;padding:6px;text-align:left;">NAMA PESERTA</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:54px;">KELAS</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:92px;">NILAI BINDO</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:92px;">NILAI MTK</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:92px;">RATA-RATA</th>
                        </tr>
                    `
                    : `
                        <tr style="background:#f1f5f9;font-family:monospace;font-size:9.5px;">
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:62px;">RANK</th>
                            <th style="border:1px solid #000;padding:6px;text-align:left;">NAMA PESERTA</th>
                            <th style="border:1px solid #000;padding:6px;text-align:left;width:205px;">ASAL SEKOLAH (SMP/MTs)</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:78px;white-space:nowrap;">RANK SMP</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:85px;">NILAI BINDO</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:85px;">NILAI MTK</th>
                            <th style="border:1px solid #000;padding:6px;text-align:center;width:85px;">RATA-RATA</th>
                        </tr>
                    `;

            const tableRowsHtml = chunk
                .map((s) =>
                    mode === "SCHOOL"
                        ? `
                            <tr>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:900;white-space:nowrap;">#${s.rankInSchool}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;color:#1e3a8a;white-space:nowrap;">#${s.rankParallelOverall}/${s.totalParallelFinished}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;font-weight:bold;">${s.name}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;">${s.grade}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:bold;color:#1e3a8a;">${fmtID(s.bindoScore)}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:bold;color:#065f46;">${fmtID(s.mtkScore)}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:900;background:#f8fafc;">${fmtID(s.overallScore)}</td>
                            </tr>
                        `
                        : `
                            <tr>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:900;white-space:nowrap;">#${s.rankParallelOverall}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;font-weight:bold;">${s.name}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;font-size:9px;">${s.school}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;white-space:nowrap;">#${s.rankInSchool}/${s.totalInSchool}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:bold;color:#1e3a8a;">${fmtID(s.bindoScore)}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:bold;color:#065f46;">${fmtID(s.mtkScore)}</td>
                                <td style="border:1px solid #94a3b8;padding:5px;text-align:center;font-family:monospace;font-weight:900;background:#f8fafc;">${fmtID(s.overallScore)}</td>
                            </tr>
                        `
                )
                .join("");

            const footerHtml = isLast ? renderSignatureBlockHtml(officials, dateStr) : "";

            host.innerHTML = `
                <div style="width:794px;padding:24px 36px;box-sizing:border-box;background:#ffffff;color:#0f172a;">
                    ${headerHtml}
                    <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:10px;">
                        <thead>${tableHeadHtml}</thead>
                        <tbody>${tableRowsHtml}</tbody>
                    </table>
                    ${footerHtml}
                </div>
            `;

            await new Promise((r) => setTimeout(r, 40));
            const canvas = await html2canvas(host, { scale: 2, allowTaint: true, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL("image/jpeg", 0.94);
            const imgHeight = (canvas.height * 210) / canvas.width;

            if (pIdx > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, 0, 210, Math.min(297, imgHeight));
        }

        return pdf.output("blob");
    } finally {
        document.body.removeChild(host);
    }
}

export async function downloadOfficialRankingPdf(
    mode: "PARALLEL" | "SCHOOL",
    scopeTitle: string,
    studentsList: ZipStudentPayload[],
    officials: ZipOfficialsPayload
) {
    const blob = await buildRankingTablePdfBlob(mode, scopeTitle, studentsList, officials);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = scopeTitle.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    a.href = url;
    a.download =
        mode === "SCHOOL"
            ? `Rekap_Peringkat_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`
            : `Rekap_Peringkat_Paralel_Lintas_Sekolah_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// 3. GENERATOR PAKET .ZIP RAPOR LENGKAP + REKAP PERINGKAT SEKOLAH
// ============================================================================
function buildHexagonSvgString(axes: ZipStudentPayload["hexagonPoints"]): string {
    const cx = 135;
    const cy = 118;
    const maxR = 72;

    const getPt = (idx: number, val: number) => {
        const angle = (Math.PI * 2 * idx) / 6 - Math.PI / 2;
        const norm = Math.min(1, Math.max(0.08, val / 100));
        const r = norm * maxR;
        return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            lx: cx + (maxR + 22) * Math.cos(angle),
            ly: cy + (maxR + 17) * Math.sin(angle)
        };
    };

    const rings = [25, 50, 75, 100]
        .map((rVal) => {
            const pts = axes
                .map((_, i) => {
                    const p = getPt(i, rVal);
                    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ");
            return `<polygon points="${pts}" fill="none" stroke="#cbd5e1" stroke-width="0.9" />`;
        })
        .join("");

    const axisLines = axes
        .map((ax, i) => {
            const out = getPt(i, 100);
            return `
                <line x1="${cx}" y1="${cy}" x2="${out.x.toFixed(1)}" y2="${out.y.toFixed(1)}" stroke="#cbd5e1" stroke-width="0.9" />
                <text x="${out.lx.toFixed(1)}" y="${(out.ly - 4).toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="8.5" font-weight="bold" fill="#1e293b">${ax.short}</text>
                <text x="${out.lx.toFixed(1)}" y="${(out.ly + 6).toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="8" font-weight="bold" fill="#1e3a8a">(${fmtID(ax.studentPct)})</text>
            `;
        })
        .join("");

    const schoolPoly = axes
        .map((ax, i) => {
            const p = getPt(i, ax.schoolPct);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" ");

    const studentPoly = axes
        .map((ax, i) => {
            const p = getPt(i, ax.studentPct);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" ");

    const dots = axes
        .map((ax, i) => {
            const p = getPt(i, ax.studentPct);
            return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#1e3a8a" stroke="#ffffff" stroke-width="1" />`;
        })
        .join("");

    return `<svg viewBox="0 0 270 235" width="225" height="196" xmlns="http://www.w3.org/2000/svg">
        ${rings}
        ${axisLines}
        <polygon points="${schoolPoly}" fill="rgba(245,158,11,0.1)" stroke="#d97706" stroke-width="1.2" stroke-dasharray="3 2" />
        <polygon points="${studentPoly}" fill="rgba(29,78,216,0.25)" stroke="#1d4ed8" stroke-width="2" />
        ${dots}
    </svg>`;
}

export async function generateSchoolReportsZip(
    scopeLabel: string,
    studentsList: ZipStudentPayload[],
    officials: ZipOfficialsPayload,
    onProgress?: (current: number, total: number, studentName: string) => void,
    groupBySchoolFolders: boolean = false
) {
    const zip = new JSZip();
    const cleanScopeSlug = scopeLabel.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    const dateStr = new Date().toLocaleDateString("id-ID", { dateStyle: "long" });

    if (!groupBySchoolFolders) {
        const recapBlob = await buildRankingTablePdfBlob("SCHOOL", scopeLabel, studentsList, officials);
        zip.file(`00_REKAP_PERINGKAT_${cleanScopeSlug}.pdf`, recapBlob);
    } else {
        const parallelRecapBlob = await buildRankingTablePdfBlob("PARALLEL", "Semua Sekolah Mitra", studentsList, officials);
        zip.file(`00_REKAP_PERINGKAT_PARALEL_SEMUA_SEKOLAH.pdf`, parallelRecapBlob);

        const bySch: Record<string, ZipStudentPayload[]> = {};
        studentsList.forEach((s) => {
            if (!bySch[s.school]) bySch[s.school] = [];
            bySch[s.school].push(s);
        });
        for (const [schName, schStudents] of Object.entries(bySch)) {
            const schSlug = schName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
            const schRecapBlob = await buildRankingTablePdfBlob("SCHOOL", schName, schStudents, officials);
            zip.folder(schSlug)?.file(`00_REKAP_PERINGKAT_${schSlug}.pdf`, schRecapBlob);
        }
    }

    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0";
    host.style.width = "794px";
    host.style.background = "#ffffff";
    host.style.color = "#0f172a";
    host.style.fontFamily = "Arial, Helvetica, sans-serif";
    document.body.appendChild(host);

    try {
        for (let i = 0; i < studentsList.length; i++) {
            const stu = studentsList[i];
            if (onProgress) onProgress(i + 1, studentsList.length, stu.name);

            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            const barsHtml = stu.sevenCompetencies
                .map((c) => {
                    const isMtk = c.subject === "MTK";
                    const color =
                        c.pct >= (isMtk ? 56.67 : 76.67)
                            ? "#059669"
                            : c.pct >= (isMtk ? 33.33 : 50.0)
                                ? "#2563eb"
                                : "#e11d48";
                    return `
                        <div style="margin-bottom:5px;">
                            <div style="display:flex;justify-content:space-between;font-size:8.5px;font-family:monospace;margin-bottom:2px;">
                                <span><strong>[${c.subject}]</strong> ${c.code}</span>
                                <span><strong>${c.rawCorrect}/${c.totalQ}</strong> • ${fmtID(c.pct)} (${c.category})</span>
                            </div>
                            <div style="width:100%;height:6px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                                <div style="width:${Math.max(3, Math.min(100, c.pct))}%;height:100%;background:${color};"></div>
                            </div>
                        </div>
                    `;
                })
                .join("");

            host.innerHTML = `
                <div style="width:794px;padding:22px 34px;box-sizing:border-box;background:#ffffff;color:#0f172a;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <img src="/logo-timsim.jpg" style="width:60px;height:60px;object-fit:contain;" />
                        <div style="flex:1;text-align:center;">
                            <div style="font-size:9.5px;font-weight:bold;text-transform:uppercase;">MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL</div>
                            <div style="font-size:9px;font-weight:bold;text-transform:uppercase;">PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN</div>
                            <div style="font-size:17px;font-weight:900;color:#1e3a8a;text-transform:uppercase;margin:2px 0;">SMA MUHAMMADIYAH 18 JAKARTA</div>
                            <div style="font-size:8.5px;color:#475569;">Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp. (021) 7235544</div>
                        </div>
                        <div style="width:60px;"></div>
                    </div>
                    <div style="border-bottom:2.5px solid #000;margin-top:5px;"></div>
                    <div style="border-bottom:1px solid #000;margin-top:2px;margin-bottom:8px;"></div>

                    <div style="text-align:center;margin-bottom:7px;">
                        <div style="font-size:12.5px;font-weight:900;text-decoration:underline;text-transform:uppercase;">
                            SERTIFIKAT HASIL & LAPORAN DIAGNOSTIK TRYOUT TKA SMP/MTs (SHTKA)
                        </div>
                        <div style="font-size:9px;font-family:monospace;color:#334155;margin-top:2px;">
                            Skala 0,00 - 100,00 Berbobot Tingkat Kesulitan Soal (Tanpa Batas Kelulusan Sekolah)
                        </div>
                    </div>

                    <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:10px;margin-bottom:7px;background:#f8fafc;">
                        <tr>
                            <td style="padding:4px 8px;width:17%;color:#475569;">Nama Peserta</td>
                            <td style="padding:4px 8px;width:36%;font-weight:bold;">: ${stu.name}</td>
                            <td style="padding:4px 8px;width:21%;color:#475569;">Peringkat Paralel</td>
                            <td style="padding:4px 8px;font-family:monospace;font-weight:900;color:#1e3a8a;white-space:nowrap;">: Rank #${stu.rankParallelOverall} dari ${stu.totalParallelFinished} Peserta</td>
                        </tr>
                        <tr>
                            <td style="padding:4px 8px;color:#475569;">Asal Sekolah</td>
                            <td style="padding:4px 8px;font-weight:bold;">: ${stu.school} (Kelas ${stu.grade})</td>
                            <td style="padding:4px 8px;color:#475569;">Peringkat Sekolah</td>
                            <td style="padding:4px 8px;font-family:monospace;font-weight:bold;color:#0f172a;white-space:nowrap;">: Rank #${stu.rankInSchool} dari ${stu.totalInSchool} Siswa</td>
                        </tr>
                    </table>

                    <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:9.5px;margin-bottom:4px;">
                        <thead>
                            <tr style="background:#f1f5f9;font-family:monospace;font-size:8.5px;">
                                <th style="border:1px solid #000;padding:5px;text-align:left;">MATA UJI TKA SMP/MTs</th>
                                <th style="border:1px solid #000;padding:5px;text-align:center;width:68px;">NILAI ANAK</th>
                                <th style="border:1px solid #000;padding:5px;text-align:center;width:68px;">RERATA SMP</th>
                                <th style="border:1px solid #000;padding:5px;text-align:center;width:72px;">KATEGORI</th>
                                <th style="border:1px solid #000;padding:5px;text-align:center;width:96px;white-space:nowrap;">RANK SEKOLAH</th>
                                <th style="border:1px solid #000;padding:5px;text-align:center;width:96px;white-space:nowrap;">RANK PARALEL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border:1px solid #000;padding:5px;">
                                    <strong>1. Bahasa Indonesia (BINDO)</strong>
                                    <div style="font-size:8px;color:#475569;">Pemahaman Tekstual, Inferensial & Evaluasi/Apresiasi</div>
                                </td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:900;color:#1e3a8a;">${fmtID(stu.bindoScore)}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;">${fmtID(stu.schoolAvgBindo)}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">${stu.bindoCategory}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:bold;white-space:nowrap;">#${stu.rankBindo} / ${stu.totalInSchool}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:bold;color:#1e3a8a;white-space:nowrap;">#${stu.rankParallelBindo} / ${stu.totalParallelFinished}</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:5px;">
                                    <strong>2. Matematika (MTK)</strong>
                                    <div style="font-size:8px;color:#475569;">Bilangan, Aljabar, Geometri & Pengukuran, Data & Peluang</div>
                                </td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:900;color:#065f46;">${fmtID(stu.mtkScore)}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;">${fmtID(stu.schoolAvgMtk)}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">${stu.mtkCategory}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:bold;white-space:nowrap;">#${stu.rankMtk} / ${stu.totalInSchool}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:bold;color:#065f46;white-space:nowrap;">#${stu.rankParallelMtk} / ${stu.totalParallelFinished}</td>
                            </tr>
                            <tr style="background:#f8fafc;font-weight:bold;">
                                <td style="border:1px solid #000;padding:5px;">RATA-RATA GABUNGAN (INDEKS PEMERINGKATAN)</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-size:10.5px;">${fmtID(stu.overallScore)}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;">${fmtID(stu.schoolAvgOverall)}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-size:8px;color:#64748b;">Per Mata Uji</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:900;color:#92400e;white-space:nowrap;">#${stu.rankInSchool} / ${stu.totalInSchool}</td>
                                <td style="border:1px solid #000;padding:5px;text-align:center;font-family:monospace;font-weight:900;color:#1e3a8a;white-space:nowrap;">#${stu.rankParallelOverall} / ${stu.totalParallelFinished}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="font-size:8px;color:#475569;font-family:monospace;font-style:italic;margin-bottom:7px;">
                        *Keterangan: <strong>Rerata SMP</strong> dihitung dari rata-rata skor peserta selesai asal <strong>${stu.school}</strong> (${stu.totalInSchool} siswa), sedangkan <strong>Rank Paralel</strong> membandingkan seluruh ${stu.totalParallelFinished} peserta lintas sekolah.
                    </div>

                    <div style="display:flex;gap:10px;border:1px solid #cbd5e1;border-radius:10px;padding:8px;background:#f8fafc;margin-bottom:7px;">
                        <div style="width:42%;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:7px;text-align:center;">
                            <div style="font-size:8.5px;font-weight:bold;font-family:monospace;margin-bottom:2px;">GRAFIK HEKSAGONAL TREN KOMPETENSI</div>
                            <div style="font-size:7.5px;color:#64748b;margin-bottom:3px;">Biru = Skor Anak • Oranye = Rerata Sekolah</div>
                            <div style="display:flex;justify-content:center;">${buildHexagonSvgString(stu.hexagonPoints)}</div>
                            <div style="text-align:left;font-size:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:4px;margin-top:3px;">
                                <div>• Keunggulan Utama: <strong>${stu.strongestAxis}</strong></div>
                                <div>• Prioritas Perbaikan: <strong>${stu.weakestAxis}</strong></div>
                            </div>
                        </div>
                        <div style="width:58%;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:7px;display:flex;flex-direction:column;justify-content:space-between;">
                            <div style="font-size:8.5px;font-weight:bold;font-family:monospace;border-bottom:1px solid #f1f5f9;padding-bottom:3px;margin-bottom:5px;">
                                GRAFIK CAPAIAN PER KISI-KISI & SUB-ELEMEN SOAL
                            </div>
                            <div>${barsHtml}</div>
                            <div style="font-size:7.5px;color:#64748b;font-family:monospace;border-top:1px solid #f1f5f9;padding-top:3px;">
                                *Setiap kisi-kisi dihitung terpisah berdasarkan bobot kesulitan butir soal pada elemen terkait.
                            </div>
                        </div>
                    </div>

                    <div style="border:1px solid #000;padding:6px 9px;font-size:8.5px;margin-bottom:4px;background:#ffffff;">
                        <div style="font-weight:bold;font-family:monospace;font-size:8px;text-transform:uppercase;">KETERANGAN ACUAN PENILAIAN RESMI TKA JENJANG SMP/MTs:</div>
                        <div style="font-size:7.8px;color:#334155;margin-top:2px;line-height:1.3;">
                            Hasil Tryout Tes Kemampuan Akademik (TKA) SMP/MTs dilaporkan dalam rentang nilai <strong>0,00 - 100,00</strong> menggunakan pembobotan tingkat kesulitan butir soal (tidak menggunakan batas kelulusan/KKM). Kategori capaian ditetapkan secara terpisah per mata uji:
                            <strong>Bahasa Indonesia:</strong> Istimewa (≥95,00), Baik (76,67-94,99), Memadai (50,00-76,66), Kurang (<50,00) •
                            <strong>Matematika:</strong> Istimewa (≥95,00), Baik (56,67-94,99), Memadai (33,33-56,66), Kurang (<33,33).
                        </div>
                    </div>

                    ${renderSignatureBlockHtml(officials, dateStr)}
                </div>
            `;

            await new Promise((r) => setTimeout(r, 40));
            const canvasPage1 = await html2canvas(host, { scale: 2, allowTaint: true, backgroundColor: "#ffffff" });
            const imgData1 = canvasPage1.toDataURL("image/jpeg", 0.94);
            const imgHeight1 = (canvasPage1.height * 210) / canvasPage1.width;
            pdf.addImage(imgData1, "JPEG", 0, 0, 210, Math.min(297, imgHeight1));

            // ==================== HALAMAN 2: LAMPIRAN ANALISIS 60 BUTIR SOAL ====================
            if (stu.itemRows.length > 0) {
                const renderTableRows = (subCode: "BINDO" | "MTK") =>
                    stu.itemRows
                        .filter((r) => r.subtes_code === subCode)
                        .map(
                            (r) => `
                            <tr>
                                <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-family:monospace;font-weight:bold;">${r.no_soal}</td>
                                <td style="border:1px solid #cbd5e1;padding:3px;">${r.element}</td>
                                <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-family:monospace;font-weight:bold;">${r.studentAnsLabel}</td>
                                <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-family:monospace;font-weight:bold;color:#065f46;">${r.keyLabel}</td>
                                <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-family:monospace;font-weight:bold;color:${r.status === "BENAR" ? "#047857" : r.status === "KOSONG" ? "#64748b" : "#be123c"
                                };">${r.status}</td>
                            </tr>
                        `
                        )
                        .join("");

                host.innerHTML = `
                    <div style="width:794px;padding:26px 36px;box-sizing:border-box;background:#ffffff;color:#0f172a;">
                        <div style="border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <div style="font-size:12px;font-weight:900;text-transform:uppercase;">LAMPIRAN DIAGNOSTIK RINCIAN BUTIR SOAL PESERTA</div>
                                <div style="font-size:9.5px;font-family:monospace;color:#475569;">Peserta: <strong>${stu.name}</strong> • ${stu.school}</div>
                            </div>
                            <div style="font-size:9px;font-family:monospace;font-weight:bold;padding:4px 8px;border:1px solid #000;">Total ${stu.itemRows.length} Butir</div>
                        </div>

                        <div style="display:flex;gap:12px;align-items:flex-start;">
                            <div style="width:50%;">
                                <div style="background:#f1f5f9;border:1px solid #000;border-bottom:none;padding:5px 8px;font-size:9.5px;font-weight:bold;font-family:monospace;">
                                    1. BAHASA INDONESIA (BINDO)
                                </div>
                                <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:8.5px;">
                                    <thead>
                                        <tr style="background:#f8fafc;font-family:monospace;">
                                            <th style="border:1px solid #000;padding:3px;width:26px;">No</th>
                                            <th style="border:1px solid #000;padding:3px;text-align:left;">Kisi-Kisi</th>
                                            <th style="border:1px solid #000;padding:3px;width:34px;">Jwb</th>
                                            <th style="border:1px solid #000;padding:3px;width:34px;">Kunci</th>
                                            <th style="border:1px solid #000;padding:3px;width:48px;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>${renderTableRows("BINDO")}</tbody>
                                </table>
                            </div>

                            <div style="width:50%;">
                                <div style="background:#f1f5f9;border:1px solid #000;border-bottom:none;padding:5px 8px;font-size:9.5px;font-weight:bold;font-family:monospace;">
                                    2. MATEMATIKA (MTK)
                                </div>
                                <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:8.5px;">
                                    <thead>
                                        <tr style="background:#f8fafc;font-family:monospace;">
                                            <th style="border:1px solid #000;padding:3px;width:26px;">No</th>
                                            <th style="border:1px solid #000;padding:3px;text-align:left;">Kisi-Kisi</th>
                                            <th style="border:1px solid #000;padding:3px;width:34px;">Jwb</th>
                                            <th style="border:1px solid #000;padding:3px;width:34px;">Kunci</th>
                                            <th style="border:1px solid #000;padding:3px;width:48px;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>${renderTableRows("MTK")}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                await new Promise((r) => setTimeout(r, 40));
                const canvasPage2 = await html2canvas(host, { scale: 2, allowTaint: true, backgroundColor: "#ffffff" });
                const imgData2 = canvasPage2.toDataURL("image/jpeg", 0.94);
                const imgHeight2 = (canvasPage2.height * 210) / canvasPage2.width;
                pdf.addPage();
                pdf.addImage(imgData2, "JPEG", 0, 0, 210, Math.min(297, imgHeight2));
            }

            const pdfBlob = pdf.output("blob");
            const safeStudentName = stu.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
            const rankPrefix = String(stu.rankInSchool).padStart(2, "0");
            const schoolFolderSlug = stu.school.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
            const fileName = `Rank_${rankPrefix}_${safeStudentName}_SHTKA.pdf`;

            if (groupBySchoolFolders) {
                zip.folder(schoolFolderSlug)?.file(fileName, pdfBlob);
            } else {
                zip.file(fileName, pdfBlob);
            }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `Paket_Rapor_SHTKA_${cleanScopeSlug || "Semua_Sekolah"}_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    } finally {
        document.body.removeChild(host);
    }
}