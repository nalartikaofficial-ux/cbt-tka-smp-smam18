import JSZip from "jszip";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

export interface ZipStudentPayload {
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
    voucherText: string;
    voucherCode: string;
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

    return `<svg viewBox="0 0 270 235" width="230" height="200" xmlns="http://www.w3.org/2000/svg">
        ${rings}
        ${axisLines}
        <polygon points="${schoolPoly}" fill="rgba(245,158,11,0.1)" stroke="#d97706" stroke-width="1.2" stroke-dasharray="3 2" />
        <polygon points="${studentPoly}" fill="rgba(29,78,216,0.25)" stroke="#1d4ed8" stroke-width="2" />
        ${dots}
    </svg>`;
}

export async function generateSchoolReportsZip(
    schoolName: string,
    studentsList: ZipStudentPayload[],
    officials: ZipOfficialsPayload,
    onProgress?: (current: number, total: number, studentName: string) => void
) {
    const zip = new JSZip();
    const cleanSchoolSlug = schoolName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    const dateStr = new Date().toLocaleDateString("id-ID", { dateStyle: "long" });

    // Container tersembunyi ukuran A4 presisi (794px @96dpi)
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

            // ==================== HALAMAN 1: SHTKA & GRAFIK DIAGNOSTIK ====================
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
                        <div style="margin-bottom:6px;">
                            <div style="display:flex;justify-content:space-between;font-size:9px;font-family:monospace;margin-bottom:2px;">
                                <span><strong>[${c.subject}]</strong> ${c.code}</span>
                                <span><strong>${c.rawCorrect}/${c.totalQ}</strong> • ${fmtID(c.pct)} (${c.category})</span>
                            </div>
                            <div style="width:100%;height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                                <div style="width:${Math.max(3, Math.min(100, c.pct))}%;height:100%;background:${color};"></div>
                            </div>
                        </div>
                    `;
                })
                .join("");

            host.innerHTML = `
                <div style="width:794px;padding:26px 36px;box-sizing:border-box;background:#ffffff;color:#0f172a;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <img src="/logo-timsim.jpg" style="width:62px;height:62px;object-fit:contain;" crossorigin="anonymous" />
                        <div style="flex:1;text-align:center;">
                            <div style="font-size:10px;font-weight:bold;text-transform:uppercase;">MAJELIS PENDIDIKAN DASAR DAN MENENGAH DAN PENDIDIKAN NONFORMAL</div>
                            <div style="font-size:9.5px;font-weight:bold;text-transform:uppercase;">PIMPINAN DAERAH MUHAMMADIYAH JAKARTA SELATAN</div>
                            <div style="font-size:18px;font-weight:900;color:#1e3a8a;text-transform:uppercase;margin:2px 0;">SMA MUHAMMADIYAH 18 JAKARTA</div>
                            <div style="font-size:9px;color:#475569;">Jl. Panjang No.19, Cipulir, Kebayoran Lama, Jakarta Selatan 12230 | Telp. (021) 7235544</div>
                        </div>
                        <div style="width:62px;"></div>
                    </div>
                    <div style="border-bottom:2.5px solid #000;margin-top:6px;"></div>
                    <div style="border-bottom:1px solid #000;margin-top:2px;margin-bottom:12px;"></div>

                    <div style="text-align:center;margin-bottom:10px;">
                        <div style="font-size:13px;font-weight:900;text-decoration:underline;text-transform:uppercase;">
                            SERTIFIKAT HASIL & LAPORAN DIAGNOSTIK TRYOUT TKA SMP/MTs (SHTKA)
                        </div>
                        <div style="font-size:9.5px;font-family:monospace;color:#334155;margin-top:2px;">
                            Skala 0,00 – 100,00 Berbobot Tingkat Kesulitan Soal (Tanpa Batas Kelulusan Sekolah)
                        </div>
                    </div>

                    <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:10.5px;margin-bottom:10px;background:#f8fafc;">
                        <tr>
                            <td style="padding:5px 8px;width:18%;color:#475569;">Nama Peserta</td>
                            <td style="padding:5px 8px;width:37%;font-weight:bold;">: ${stu.name}</td>
                            <td style="padding:5px 8px;width:20%;color:#475569;">No. WhatsApp</td>
                            <td style="padding:5px 8px;font-family:monospace;font-weight:bold;">: ${stu.phone}</td>
                        </tr>
                        <tr>
                            <td style="padding:5px 8px;color:#475569;">Asal Sekolah</td>
                            <td style="padding:5px 8px;font-weight:bold;">: ${stu.school} (Kelas ${stu.grade})</td>
                            <td style="padding:5px 8px;color:#475569;">Status Dokumen</td>
                            <td style="padding:5px 8px;font-family:monospace;font-weight:bold;color:#0f172a;">: Resmi Terverifikasi Server</td>
                        </tr>
                    </table>

                    <table style="width:100%;border:1px solid #000;border-collapse:collapse;font-size:10.5px;margin-bottom:4px;">
                        <thead>
                            <tr style="background:#f1f5f9;font-family:monospace;font-size:9.5px;">
                                <th style="border:1px solid #000;padding:6px;text-align:left;">MATA UJI TKA SMP/MTs</th>
                                <th style="border:1px solid #000;padding:6px;text-align:center;width:85px;">NILAI ANAK</th>
                                <th style="border:1px solid #000;padding:6px;text-align:center;width:85px;">RERATA SMP</th>
                                <th style="border:1px solid #000;padding:6px;text-align:center;width:90px;">KATEGORI</th>
                                <th style="border:1px solid #000;padding:6px;text-align:center;width:135px;">PERINGKAT DI SEKOLAH</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border:1px solid #000;padding:6px;">
                                    <strong>1. Bahasa Indonesia (BINDO)</strong>
                                    <div style="font-size:8.5px;color:#475569;">Pemahaman Tekstual, Inferensial & Evaluasi/Apresiasi</div>
                                </td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:900;color:#1e3a8a;">${fmtID(stu.bindoScore)}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;">${fmtID(stu.schoolAvgBindo)}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;">${stu.bindoCategory}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:bold;">Rank #${stu.rankBindo} dari ${stu.totalInSchool}</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:6px;">
                                    <strong>2. Matematika (MTK)</strong>
                                    <div style="font-size:8.5px;color:#475569;">Bilangan, Aljabar, Geometri & Pengukuran, Data & Peluang</div>
                                </td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:900;color:#065f46;">${fmtID(stu.mtkScore)}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;">${fmtID(stu.schoolAvgMtk)}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;">${stu.mtkCategory}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:bold;">Rank #${stu.rankMtk} dari ${stu.totalInSchool}</td>
                            </tr>
                            <tr style="background:#f8fafc;font-weight:bold;">
                                <td style="border:1px solid #000;padding:6px;">RATA-RATA GABUNGAN (INDEKS PEMERINGKATAN)</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-size:11.5px;">${fmtID(stu.overallScore)}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;">${fmtID(stu.schoolAvgOverall)}</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-size:9px;color:#64748b;">Per Mata Uji</td>
                                <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:900;color:#92400e;">Rank #${stu.rankInSchool} dari ${stu.totalInSchool}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="font-size:8.5px;color:#475569;font-family:monospace;font-style:italic;margin-bottom:10px;">
                        *Keterangan Rerata SMP: Dihitung otomatis dari rata-rata skor seluruh peserta yang telah menyelesaikan ujian dari asal sekolah <strong>${stu.school}</strong> (${stu.totalInSchool} peserta selesai).
                    </div>

                    <div style="display:flex;gap:12px;border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;margin-bottom:10px;">
                        <div style="width:42%;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;text-align:center;">
                            <div style="font-size:9px;font-weight:bold;font-family:monospace;margin-bottom:2px;">GRAFIK HEKSAGONAL TREN KOMPETENSI</div>
                            <div style="font-size:8px;color:#64748b;margin-bottom:4px;">Biru = Skor Anak • Oranye = Rerata Sekolah</div>
                            <div style="display:flex;justify-content:center;">${buildHexagonSvgString(stu.hexagonPoints)}</div>
                            <div style="text-align:left;font-size:8.5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px;margin-top:4px;">
                                <div>• Keunggulan Utama: <strong>${stu.strongestAxis}</strong></div>
                                <div>• Prioritas Perbaikan: <strong>${stu.weakestAxis}</strong></div>
                            </div>
                        </div>
                        <div style="width:58%;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:flex;flex-direction:column;justify-content:space-between;">
                            <div style="font-size:9px;font-weight:bold;font-family:monospace;border-bottom:1px solid #f1f5f9;padding-bottom:4px;margin-bottom:6px;">
                                GRAFIK CAPAIAN PER KISI-KISI & SUB-ELEMEN SOAL
                            </div>
                            <div>${barsHtml}</div>
                            <div style="font-size:8px;color:#64748b;font-family:monospace;border-top:1px solid #f1f5f9;padding-top:4px;">
                                *Setiap kisi-kisi dihitung terpisah berdasarkan bobot kesulitan butir soal pada elemen terkait.
                            </div>
                        </div>
                    </div>

                    <div style="border:1px solid #000;padding:7px 10px;font-size:9px;margin-bottom:10px;background:#ffffff;">
                        <div style="font-weight:bold;font-family:monospace;font-size:8.5px;text-transform:uppercase;">KETERANGAN ACUAN PENILAIAN RESMI TKA JENJANG SMP/MTs:</div>
                        <div style="font-size:8px;color:#334155;margin-top:2px;line-height:1.35;">
                            Hasil Tryout Tes Kemampuan Akademik (TKA) SMP/MTs dilaporkan dalam rentang nilai <strong>0,00 – 100,00</strong> menggunakan pembobotan tingkat kesulitan butir soal (tidak menggunakan batas kelulusan/KKM). Kategori capaian ditetapkan secara terpisah per mata uji:
                            <strong>Bahasa Indonesia:</strong> Istimewa (≥95,00), Baik (76,67–94,99), Memadai (50,00–76,66), Kurang (<50,00) •
                            <strong>Matematika:</strong> Istimewa (≥95,00), Baik (56,67–94,99), Memadai (33,33–56,66), Kurang (<33,33).
                        </div>
                    </div>

                    <div style="display:flex;justify-content:flex-end;font-size:10.5px;">
                        <div style="width:280px;text-align:center;">
                            <div>Jakarta, ${dateStr}</div>
                            <div style="font-weight:bold;">Kepala SMA Muhammadiyah 18 Jakarta</div>
                            <div style="height:86px;display:flex;align-items:center;justify-content:center;margin:4px 0;">
                                ${officials.kepsekSignatureUrl ? `<img src="${officials.kepsekSignatureUrl}" style="max-height:84px;max-width:240px;object-fit:contain;" />` : ""}
                            </div>
                            <div style="font-weight:bold;text-decoration:underline;">${officials.kepalaSekolahNama}</div>
                            <div style="font-size:9.5px;font-family:monospace;">NBM. ${officials.kepalaSekolahNbm}</div>
                        </div>
                    </div>
                </div>
            `;

            const canvasPage1 = await html2canvas(host, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
            const imgData1 = canvasPage1.toDataURL("image/jpeg", 0.92);
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
                    <div style="width:794px;padding:28px 36px;box-sizing:border-box;background:#ffffff;color:#0f172a;">
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

                const canvasPage2 = await html2canvas(host, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
                const imgData2 = canvasPage2.toDataURL("image/jpeg", 0.92);
                const imgHeight2 = (canvasPage2.height * 210) / canvasPage2.width;
                pdf.addPage();
                pdf.addImage(imgData2, "JPEG", 0, 0, 210, Math.min(297, imgHeight2));
            }

            const pdfBlob = pdf.output("blob");
            const safeStudentName = stu.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
            const rankPrefix = String(stu.rankInSchool).padStart(2, "0");
            zip.file(`Rank_${rankPrefix}_${safeStudentName}_SHTKA.pdf`, pdfBlob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `Paket_Rapor_SHTKA_${cleanSchoolSlug || "Semua_Sekolah"}_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    } finally {
        document.body.removeChild(host);
    }
}