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
import { supabase } from "@/lib/supabase";

// Membersihkan input agar hanya menyimpan digit setelah +62 (contoh: 81234567890)
function sanitizeSuffixPhoneID(raw: string): string {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("62")) {
        digits = digits.slice(2);
    }
    digits = digits.replace(/^0+/, "");
    return digits.slice(0, 12);
}

export default function StudentLoginPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: "",
        school: "",
        grade: "9",
        phoneSuffix: "", // Digit setelah +62 (misal: 81234567890)
        token: ""
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        const suffix = sanitizeSuffixPhoneID(formData.phoneSuffix);
        if (!suffix) {
            setErrorMsg("Nomor WhatsApp wajib diisi untuk melanjutkan ujian!");
            return;
        }

        // Standar nomor seluler Indonesia: setelah +62 wajib diawali '8' dan panjang 9-12 digit (setara 08 + 8-11 digit = 10-13 digit)
        if (!suffix.startsWith("8") || suffix.length < 9 || suffix.length > 12) {
            setErrorMsg("Nomor WhatsApp tidak valid! Masukkan 9–12 digit nomor HP Indonesia setelah +62 (diawali angka 8).");
            return;
        }

        const cleanPhone = "0" + suffix; // Disimpan seragam sebagai 08xxxxxxxxxx di Supabase
        const cleanName = formData.name.toUpperCase().replace(/\s+/g, " ").trim();
        const cleanSchool = formData.school.toUpperCase().replace(/\s+/g, " ").trim();

        if (!cleanName || !cleanSchool) {
            setErrorMsg("Nama Lengkap Siswa dan Asal Sekolah (SMP/MTs) wajib diisi!");
            return;
        }

        const inputToken = formData.token.toUpperCase().trim();
        if (!inputToken) {
            setErrorMsg("Token Sesi wajib diisi sesuai arahan panitia / pengawas ujian!");
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Cek Status Sesi & Token Resmi di Supabase (tka_sessions)
            const { data: sessionData, error: sessionErr } = await supabase
                .from("tka_sessions")
                .select("*")
                .eq("id", 1)
                .single();

            if (!sessionErr && sessionData) {
                if (sessionData.status_akses && sessionData.status_akses !== "DIBUKA") {
                    setErrorMsg("Akses bilik ujian saat ini sedang DIKUNCI oleh Proktor. Silakan tunggu instruksi pembukaan sesi.");
                    setIsSubmitting(false);
                    return;
                }

                const officialToken = String(sessionData.token_resmi || "TKA18").toUpperCase().trim();
                if (inputToken !== officialToken) {
                    setErrorMsg("Token Sesi tidak sesuai! Silakan periksa kembali token aktif dari panitia.");
                    setIsSubmitting(false);
                    return;
                }
            }

            // 2. Cek apakah siswa sudah terdaftar / terkunci sebelumnya di tka_students
            const { data: existingStudent } = await supabase
                .from("tka_students")
                .select("*")
                .eq("phone", cleanPhone)
                .maybeSingle();

            if (existingStudent) {
                const stLower = String(existingStudent.status || "").toLowerCase();
                if (stLower.includes("kunci")) {
                    setErrorMsg("Akun ujian Anda berstatus TERKUNCI oleh sistem Kiosk. Silakan hubungi Proktor untuk membuka akses.");
                    setIsSubmitting(false);
                    return;
                }
            }

            const studentPayload = {
                nisn: cleanPhone,
                name: cleanName,
                school: cleanSchool,
                grade: formData.grade,
                phone: cleanPhone,
                interest: "Umum",
                token: inputToken,
                timestamp: new Date().toISOString()
            };

            // 3. Simpan / Perbarui Data Prospek Siswa Mandiri ke Supabase (tka_students)
            const { error: upsertErr } = await supabase.from("tka_students").upsert(
                {
                    phone: cleanPhone,
                    name: studentPayload.name,
                    school: studentPayload.school,
                    grade: studentPayload.grade,
                    interest: studentPayload.interest,
                    status: existingStudent?.status === "Selesai" ? "Selesai" : "Siap Ujian",
                    violations: existingStudent?.violations ?? 0,
                    score: existingStudent?.score ?? 0,
                    bindo_score: existingStudent?.bindo_score ?? 0,
                    mtk_score: existingStudent?.mtk_score ?? 0
                },
                { onConflict: "phone" }
            );

            if (upsertErr) {
                console.warn("Supabase upsert warning:", upsertErr.message);
            }

            // 4. Simpan ke LocalStorage agar langsung terbaca di bilik ujian & rapor
            localStorage.setItem("tka_student", JSON.stringify(studentPayload));

            router.push("/exam");
        } catch (err) {
            console.error("Gagal memproses registrasi siswa:", err);
            setErrorMsg("Terjadi gangguan koneksi ke server. Silakan coba beberapa saat lagi.");
        } finally {
            setIsSubmitting(false);
        }
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
                        {/* Nama Siswa (Otomatis Kapital) */}
                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                <UserCheck className="w-3.5 h-3.5 text-blue-700" /> NAMA LENGKAP SISWA:
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="CONTOH: MUHAMMAD RIZKI PRATAMA"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                            />
                        </div>

                        {/* Asal Sekolah (Otomatis Kapital) & Tingkat Kelas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <School className="w-3.5 h-3.5 text-blue-700" /> ASAL SEKOLAH (SMP/MTs):
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="CONTOH: SMPN 161 JAKARTA"
                                    value={formData.school}
                                    onChange={(e) => setFormData({ ...formData, school: e.target.value.toUpperCase() })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <GraduationCap className="w-3.5 h-3.5 text-blue-700" /> TINGKAT KELAS:
                                </label>
                                <select
                                    value={formData.grade}
                                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs bg-white cursor-pointer"
                                >
                                    <option value="9">Kelas 9</option>
                                    <option value="8">Kelas 8</option>
                                    <option value="7">Kelas 7</option>
                                </select>
                            </div>
                        </div>

                        {/* No WA (+62 Terkunci) & Token (Otomatis Kapital) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> NO. WHATSAPP (AKTIF):
                                </label>
                                <div className="flex items-stretch rounded-xl border border-slate-300 focus-within:border-blue-600 overflow-hidden bg-white">
                                    <span className="px-3 py-2.5 bg-slate-100 border-r border-slate-300 font-mono font-black text-slate-700 text-xs flex items-center select-none shrink-0">
                                        +62
                                    </span>
                                    <input
                                        type="text"
                                        required
                                        inputMode="numeric"
                                        maxLength={12}
                                        placeholder="81234567890"
                                        value={formData.phoneSuffix}
                                        onChange={(e) =>
                                            setFormData({ ...formData, phoneSuffix: sanitizeSuffixPhoneID(e.target.value) })
                                        }
                                        className="w-full px-3 py-2.5 font-mono font-bold text-slate-900 outline-none text-xs"
                                    />
                                </div>
                                <span className="text-[9.5px] sm:text-[10px] text-slate-400 block">
                                    *Langsung ketik mulai angka 8 (9–12 digit)
                                </span>
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 font-mono flex items-center gap-1.5 text-[10.5px] sm:text-xs">
                                    <Lock className="w-3.5 h-3.5 text-amber-500" /> TOKEN SESI:
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="CONTOH: TKA18"
                                    value={formData.token}
                                    onChange={(e) => setFormData({ ...formData, token: e.target.value.toUpperCase() })}
                                    className="w-full px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-black text-slate-900 focus:border-blue-600 outline-none text-xs text-center uppercase"
                                />
                            </div>
                        </div>

                        {/* Tombol Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 sm:py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-700/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                        >
                            <span>{isSubmitting ? "Memverifikasi & Menyimpan..." : "Mulai Simulasi Ujian Sekarang"}</span>
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
                © 2026 SMA Muhammadiyah 18 Jakarta
            </footer>
        </div>
    );
}