"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    GraduationCap,
    ArrowRight,
    Sparkles,
    ChevronLeft,
    ShieldCheck,
    UserCheck,
    Phone,
    School,
    Lock
} from "lucide-react";

// Webhook Google Sheets Khusus Data Leads PPDB TO TKA SMP
const LEADS_SHEET_API_URL =
    "https://script.google.com/macros/s/AKfycbwqhjrwgEsTgA9_Aop9RFBu3Mrht9w4N2SPayyB3z6AtzuP7gmiSpZEioBKwmd7PHaFfw/exec";

export default function StudentLoginPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: "",
        school: "",
        grade: "9",
        phone: "",
        interest: "Sains, Kedokteran & Rekayasa STEM",
        token: ""
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        const cleanPhone = formData.phone.replace(/\D/g, "");
        if (cleanPhone.length < 10) {
            setErrorMsg("Nomor WhatsApp tidak valid (minimal 10 digit angka)!");
            return;
        }

        if (!formData.name.trim() || !formData.school.trim()) {
            setErrorMsg("Nama Lengkap dan Asal SMP wajib diisi!");
            return;
        }

        setIsSubmitting(true);

        const studentPayload = {
            action: "register_lead_student",
            nisn: cleanPhone, // Menggunakan nomor WA sebagai identifier unik siswa
            name: formData.name.trim(),
            school: formData.school.trim(),
            grade: formData.grade,
            phone: cleanPhone,
            interest: formData.interest,
            token: formData.token.toUpperCase().trim(),
            timestamp: new Date().toISOString()
        };

        // 1. Simpan ke LocalStorage agar langsung terbaca di bilik ujian & rapor
        localStorage.setItem("tka_student", JSON.stringify(studentPayload));

        // 2. Kirim data prospek ke Google Sheets Panitia SPMB
        try {
            await fetch(LEADS_SHEET_API_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(studentPayload)
            });
        } catch (err) {
            console.warn("Gagal mengirim leads ke server, melanjutkan sesi lokal:", err);
        }

        setIsSubmitting(false);
        router.push("/exam");
    };

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white">
            {/* Top Navbar Responsif */}
            <header className="bg-white border-b border-slate-200 px-3.5 sm:px-8 py-3 flex items-center justify-between shadow-xs sticky top-0 z-30">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <Link
                        href="/"
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition border border-slate-200 shrink-0 cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src="/logo-timsim.jpg"
                                alt="Logo SMA Muhammadiyah 18 Jakarta"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                }}
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                                PORTAL TO TKA SMP
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                                SMA Muhammadiyah 18 Jakarta
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-mono text-[10px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                    <span>PORTAL TERVERIFIKASI</span>
                </div>
            </header>

            {/* Main Container Form Registrasi */}
            <main className="max-w-xl w-full mx-auto p-3.5 sm:p-6 my-auto">
                <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-8 md:p-9 shadow-lg space-y-5 sm:space-y-6">
                    <div className="text-center space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />
                            <span>SIMULASI DIAGNOSTIK TKA SMP</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Formulir Peserta Try Out
                        </h1>
                        <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                            Lengkapi identitas Anda untuk mengklaim <strong>Voucher Beasiswa PPDB</strong> dan membuka lembar soal simulasi.
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 text-xs text-left">
                        {/* Nama Siswa */}
                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                <UserCheck className="w-3.5 h-3.5 text-blue-700" /> NAMA LENGKAP SISWA:
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Contoh: Muhammad Rizki Pratama"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                            />
                        </div>

                        {/* Asal Sekolah & Tingkat Kelas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <School className="w-3.5 h-3.5 text-blue-700" /> ASAL SEKOLAH (SMP/MTs):
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: SMPN 161 Jakarta"
                                    value={formData.school}
                                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-600 outline-none text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <GraduationCap className="w-3.5 h-3.5 text-blue-700" /> TINGKAT KELAS:
                                </label>
                                <select
                                    value={formData.grade}
                                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs bg-white"
                                >
                                    <option value="9">Kelas 9 (Calon Siswa SMA)</option>
                                    <option value="8">Kelas 8 (Persiapan Awal)</option>
                                    <option value="7">Kelas 7</option>
                                </select>
                            </div>
                        </div>

                        {/* No WA & Token */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> NO. WHATSAPP (AKTIF):
                                </label>
                                <input
                                    type="text"
                                    required
                                    inputMode="numeric"
                                    placeholder="081234567890"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                                />
                                <span className="text-[9.5px] sm:text-[10px] text-slate-400 block">*Hasil Rapor &amp; voucher dikirim ke nomor ini</span>
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <Lock className="w-3.5 h-3.5 text-amber-500" /> TOKEN SESI (OPSIONAL):
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: TKA18"
                                    value={formData.token}
                                    onChange={(e) => setFormData({ ...formData, token: e.target.value.toUpperCase() })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-black text-slate-900 focus:border-blue-600 outline-none text-xs text-center uppercase"
                                />
                            </div>
                        </div>

                        {/* Peminatan Karir */}
                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 font-mono text-[10.5px] sm:text-xs">
                                PEMINATAN KARIR / JALUR KELAS SMA YANG DIMINATI:
                            </label>
                            <select
                                value={formData.interest}
                                onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                                className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-900 focus:border-blue-600 outline-none text-xs bg-white truncate"
                            >
                                <option value="Sains, Kedokteran & Rekayasa STEM">Sains, Kedokteran &amp; Rekayasa STEM</option>
                                <option value="Bisnis Digital, Akuntansi & Manajemen">Bisnis Digital, Akuntansi &amp; Manajemen</option>
                                <option value="Ilmu Hukum, Sosial & Komunikasi">Ilmu Hukum, Sosial &amp; Komunikasi</option>
                                <option value="Desain Kreatif, Multimedia & IT">Desain Kreatif, Multimedia &amp; IT</option>
                            </select>
                        </div>

                        {/* Tombol Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 sm:py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-700/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                        >
                            <span>{isSubmitting ? "Menyimpan Data..." : "Mulai Simulasi Ujian Sekarang"}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>

                    <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100 text-center">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Sistem Pelaksanaan Ujian Terstandarisasi Pusmendik</span>
                    </div>
                </div>
            </main>

            <footer className="py-3 sm:py-4 text-center text-[10px] sm:text-xs text-slate-400 font-medium px-4">
                &copy; 2026 SMA Muhammadiyah 18 Jakarta Selatan &bull; Jl. Panjang No. 19, Cipulir
            </footer>
        </div>
    );
}