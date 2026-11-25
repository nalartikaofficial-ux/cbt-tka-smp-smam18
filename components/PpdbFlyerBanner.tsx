"use client";

import React, { useState } from "react";
import { Sparkles, ZoomIn, X, MessageCircle, ExternalLink } from "lucide-react";

export default function PpdbFlyerBanner() {
    const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

    const ppdbWaText = encodeURIComponent(
        "Assalamu'alaikum Admin PPDB SMA Muhammadiyah 18 Jakarta. Saya peserta Tryout TKA SMP ingin bertanya informasi pendaftaran peserta didik baru (SPMB/PPDB)."
    );

    return (
        <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-6 sm:py-8 font-sans">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
                {/* Header Promosi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px] font-bold uppercase">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>INFORMASI SPMB / PPDB 2026–2027</span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                            Penerimaan Peserta Didik Baru — SMA Muhammadiyah 18 Jakarta
                        </h3>
                        <p className="text-xs text-slate-500">
                            Klik gambar brosur di bawah untuk memperbesar detail program unggulan, beasiswa prestasi, dan alur pendaftaran.
                        </p>
                    </div>

                    <a
                        href={`https://wa.me/6281779951229?text=${ppdbWaText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Info PPDB via WA</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                </div>

                {/* Grid 2 Kolom Flyer Depan & Belakang */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    {/* FLYER DEPAN */}
                    <div
                        onClick={() =>
                            setPreviewImage({
                                src: "/flyer-ppdb-depan.jpg",
                                title: "Brosur PPDB SMA Muhammadiyah 18 Jakarta (Halaman Depan)"
                            })
                        }
                        className="group relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition"
                    >
                        <img
                            src="/flyer-ppdb-depan.jpg"
                            alt="Brosur PPDB SMA Muhammadiyah 18 Jakarta - Depan"
                            className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-300"
                        />
                        <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                            <span>Halaman 1 — Profil & Program Unggulan</span>
                            <span className="inline-flex items-center gap-1 text-blue-700 font-mono text-[10px]">
                                <ZoomIn className="w-3.5 h-3.5" /> Perbesar
                            </span>
                        </div>
                    </div>

                    {/* FLYER BELAKANG */}
                    <div
                        onClick={() =>
                            setPreviewImage({
                                src: "/flyer-ppdb-belakang.jpg",
                                title: "Brosur PPDB SMA Muhammadiyah 18 Jakarta (Halaman Belakang)"
                            })
                        }
                        className="group relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition"
                    >
                        <img
                            src="/flyer-ppdb-belakang.jpg"
                            alt="Brosur PPDB SMA Muhammadiyah 18 Jakarta - Belakang"
                            className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-300"
                        />
                        <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                            <span>Halaman 2 — Syarat, Biaya & Jalur Pendaftaran</span>
                            <span className="inline-flex items-center gap-1 text-blue-700 font-mono text-[10px]">
                                <ZoomIn className="w-3.5 h-3.5" /> Perbesar
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Zoom Gambar saat Diklik di HP/Laptop */}
            {previewImage && (
                <div
                    onClick={() => setPreviewImage(null)}
                    className="fixed inset-0 z-[999] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
                    >
                        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
                            <span className="text-xs font-bold truncate">{previewImage.title}</span>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="max-h-[82vh] overflow-y-auto bg-slate-100 flex justify-center">
                            <img
                                src={previewImage.src}
                                alt={previewImage.title}
                                className="w-full h-auto object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}