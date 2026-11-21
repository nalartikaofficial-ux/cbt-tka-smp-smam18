"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Wifi,
  BarChart3,
  Lock,
  Building2,
  Cpu,
  EyeOff,
  Play,
  Award
} from "lucide-react";

export default function CBTEngineLandingPage() {
  // 1. Countdown Timer Mockup Hero
  const [secondsLeft] = useState(895);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `00:${m}:${s}`;
  };

  // State opsi interaktif di Hero
  const [selectedOption, setSelectedOption] = useState<string>("B");

  // 2. Animasi Hitung Metrik Hero (0 ke 100)
  const metricsRef = useRef<HTMLDivElement | null>(null);
  const [metricCount, setMetricCount] = useState(100);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let delayTimer: NodeJS.Timeout | null = null;

    const startCounting = () => {
      setMetricCount(0);
      delayTimer = setTimeout(() => {
        const target = 100;
        const totalDuration = 1200;
        const frameRate = 30;
        const totalFrames = totalDuration / frameRate;
        let frame = 0;

        if (timer) clearInterval(timer);

        timer = setInterval(() => {
          frame++;
          const progress = frame / totalFrames;
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          const current = Math.min(target, Math.round(target * easedProgress));

          setMetricCount(current);

          if (frame >= totalFrames && timer) {
            clearInterval(timer);
          }
        }, frameRate);
      }, 100);
    };

    const target = metricsRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startCounting();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      if (timer) clearInterval(timer);
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, []);

  // 3. Splash Screen Cepat (300ms pada kunjungan pertama, 0ms jika sudah di-cache sesi)
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("m18_boot_done")) {
      setIsLoading(false);
      setLoadProgress(100);
      return;
    }

    const totalDuration = 300;
    const updateInterval = 25;
    const totalTicks = totalDuration / updateInterval;
    let currentTick = 0;

    const progressTimer = setInterval(() => {
      currentTick++;
      const currentPercent = Math.min(100, (currentTick / totalTicks) * 100);
      setLoadProgress(currentPercent);

      if (currentTick >= totalTicks) {
        clearInterval(progressTimer);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("m18_boot_done", "1");
        }
        setIsLoading(false);
      }
    }, updateInterval);

    return () => clearInterval(progressTimer);
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans selection:bg-blue-700 selection:text-white relative overflow-x-hidden">
      {/* ============================================================== */}
      {/* A. ENTERPRISE BOOTLOADER SPLASH SCREEN (FAST 300MS)            */}
      {/* ============================================================== */}
      {isLoading && (
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-300">
          <div className="absolute w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col items-center text-center space-y-4 px-4 max-w-lg">
            <div className="relative flex items-center justify-center">
              <div className="relative w-16 h-16 rounded-2xl bg-white p-1.5 shadow-xl shadow-blue-900/10 border border-slate-200 flex items-center justify-center overflow-hidden">
                <img
                  src="/logo-timsim.jpg"
                  alt="Logo SMA Muhammadiyah 18"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-[11px] font-bold text-blue-600 tracking-widest uppercase">
                CBT ENGINE • TKA SMP
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                TIM SISTEM INFORMASI & MANAJEMEN
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold">
                SMA Muhammadiyah 18 Jakarta
              </p>
            </div>

            <div className="w-56 sm:w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-full transition-[width] duration-75 ease-linear"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* B. MAIN PORTAL WRAPPER                                         */}
      {/* ============================================================== */}
      <div>
        {/* NAVBAR BERSIH (1 TOMBOL KHUSUS GURU & ADMIN) */}
        <header className="relative z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs sticky top-0">
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
            {/* Branding & Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 text-left min-w-0">
              <div className="relative shrink-0">
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white p-1 shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                  <img
                    src="/logo-timsim.jpg"
                    alt="Logo SMA Muhammadiyah 18 Jakarta"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs sm:text-base font-black tracking-tight text-[#1e3a8a] uppercase truncate">
                    TIM SISTEM INFORMASI & MANAJEMEN
                  </span>
                  <div className="relative inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.2 sm:px-2 sm:py-0.5 text-[9px] sm:text-[10px] font-black tracking-wider text-white shadow-xs">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                    </span>
                    <span>TKA SMP</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-slate-600 truncate">
                  <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50/90 px-1.5 py-0.2 font-mono text-[9px] sm:text-[10px] font-bold text-amber-800">
                    PPDB 2026/2027
                  </span>
                  <span className="font-semibold text-slate-700 truncate">
                    SMA Muhammadiyah 18 Jakarta
                  </span>
                </div>
              </div>
            </div>

            {/* 1 Tombol Sekunder Khusus Guru & Admin */}
            <Link
              href="/admin"
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 transition shadow-xs flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700 shrink-0" />
              <span className="hidden sm:inline">Portal Guru & Admin</span>
              <span className="sm:hidden">Portal Guru</span>
            </Link>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="relative z-10 bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0]/40 border-b border-slate-200/90 pt-6 sm:pt-8 pb-6 sm:pb-7">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-stretch">
              {/* Kolom Kiri */}
              <div className="lg:col-span-6 flex flex-col justify-between text-left py-1">
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white text-[10px] sm:text-xs font-bold tracking-wider uppercase shadow-sm border border-blue-500/30">
                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                    <span className="tracking-wide">KEPMENDIKDASMEN NO. 56 TAHUN 2026</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl lg:text-[48px] font-black tracking-tight leading-none pt-0.5">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900">
                      SIMULASI TKA SMP
                    </span>
                  </h1>

                  <p className="text-slate-600 text-xs sm:text-[15px] leading-relaxed max-w-xl font-normal">
                    Uji kesiapan akademikmu menghadapi evaluasi standar nasional jenjang SMP/MTs (total <strong>55 soal</strong>):{" "}
                    <strong className="font-bold text-slate-900">Bahasa Indonesia (30 Soal)</strong> &{" "}
                    <strong className="font-bold text-slate-900">Matematika (25 Soal)</strong>. Terbitkan{" "}
                    <strong className="font-bold text-blue-900">Sertifikat Hasil Tryout (SHTKA)</strong> & klaim{" "}
                    <strong className="font-bold text-blue-900">Voucher Beasiswa PPDB SMA Muhammadiyah 18 Jakarta</strong>.
                  </p>

                  {/* 1 TOMBOL UTAMA LANGSUNG KE /LOGIN */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                    <Link
                      href="/login"
                      className="h-11 sm:h-12 px-5 sm:px-7 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-black text-xs sm:text-sm transition shadow-md shadow-blue-700/25 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Ikuti Try Out Sekarang</span>
                    </Link>

                    <a
                      href="#silabus"
                      className="h-11 sm:h-12 px-4 sm:px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs sm:text-sm transition shadow-2xs flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4 text-blue-700" />
                      <span>Struktur 55 Soal</span>
                    </a>
                  </div>
                </div>

                {/* 3 Kotak Metrik Hero */}
                <div ref={metricsRef} className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 sm:pt-6">
                  <div className="group relative p-2.5 sm:p-3.5 rounded-2xl bg-white border border-slate-200 text-center transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-blue-300 overflow-hidden cursor-default flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-1 font-mono text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">
                      <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 animate-pulse shrink-0" />
                      <span>KAPASITAS</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                      500<span className="text-blue-600">+</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">Uji serentak stabil</div>
                  </div>

                  <div className="group relative p-2.5 sm:p-3.5 rounded-2xl bg-white border border-slate-200 text-center transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-indigo-300 overflow-hidden cursor-default flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-1 font-mono text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">
                      <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 shrink-0" />
                      <span>STANDARISASI</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                      SKALA <span className="text-blue-600">100</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">Skor 0,00 – 100,00</div>
                  </div>

                  <div className="group relative p-2.5 sm:p-3.5 rounded-2xl bg-white border border-slate-200 text-center transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-emerald-300 overflow-hidden cursor-default flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-1 font-mono text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">
                      <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 animate-pulse shrink-0" />
                      <span>INTEGRITAS</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                      {metricCount}<span className="text-emerald-600">%</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">Ramah siswa SMP</div>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Mockup Soal TKA SMP Interaktif */}
              <div className="lg:col-span-6 flex flex-col justify-between mt-2 lg:mt-0">
                <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/60 p-2 sm:p-3 transition duration-300">
                  <div className="h-9 px-2.5 sm:px-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>

                    <div className="flex-1 max-w-xs mx-auto h-6 px-2 bg-white border border-slate-200/90 rounded-lg flex items-center justify-center gap-1.5 shadow-2xs">
                      <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[9px] sm:text-[10px] text-slate-600 font-medium truncate select-none">
                        cbt-m18.id/tka-smp/live
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-blue-800 font-bold text-[8.5px] sm:text-[9px] bg-blue-50/90 px-1.5 sm:px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                      <ShieldCheck className="w-3 h-3 text-blue-700 animate-pulse" />
                      <span className="tracking-wide">TERPROTEKSI</span>
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 bg-slate-50/70 rounded-2xl mt-2 border border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-700 text-white font-mono font-bold text-[9.5px] sm:text-[10px]">
                          CONTOH SOAL
                        </span>
                        <span className="text-slate-700 font-semibold text-[10px] sm:text-[11px] truncate">
                          Matematika (MTK)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded font-mono text-[10px] sm:text-[11px] font-bold border border-amber-200 shrink-0">
                        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                        <span>{formatTimer(secondsLeft)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <p className="text-[11.5px] sm:text-[12px] text-slate-700 leading-snug font-normal">
                        Sebuah toko buku memberikan diskon bertingkat: paket buku pelajaran didiskon 20%, dan jika memiliki kartu anggota pelajar, diberikan tambahan diskon 10% dari harga setelah diskon pertama.
                      </p>
                      <div className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono text-[10px] sm:text-[11px] font-semibold text-center shadow-2xs tracking-tight">
                        Harga Label: Rp 250.000 • Diskon Bertingkat: 20% + 10%
                      </div>
                      <p className="text-[11.5px] sm:text-[12px] text-slate-900 font-semibold">
                        Berapakah harga final yang harus dibayar pelajar tersebut?
                      </p>
                    </div>

                    {/* Opsi Jawaban Interaktif */}
                    <div className="space-y-1.5 text-left">
                      {[
                        { key: "A", text: "A. Rp 175.000", isCorrect: false },
                        { key: "B", text: "B. Rp 180.000", isCorrect: true },
                        { key: "C", text: "C. Rp 185.000", isCorrect: false },
                        { key: "D", text: "D. Rp 200.000", isCorrect: false },
                      ].map((item) => {
                        const isSelected = selectedOption === item.key;
                        let styleClass =
                          "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50/70";

                        if (isSelected) {
                          styleClass = item.isCorrect
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold shadow-xs"
                            : "bg-rose-50 border-rose-400 text-rose-950 font-semibold shadow-xs";
                        }

                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setSelectedOption(item.key)}
                            className={`w-full p-2 sm:p-2.5 rounded-xl text-[11px] sm:text-xs flex items-center justify-between border transition-all duration-200 cursor-pointer text-left ${styleClass}`}
                          >
                            <span className="leading-snug">{item.text}</span>
                            {isSelected && item.isCorrect && (
                              <div className="flex items-center gap-1 text-emerald-600 shrink-0 ml-2">
                                <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">BENAR</span>
                                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </div>
                            )}
                            {isSelected && !item.isCorrect && (
                              <div className="flex items-center gap-1 text-rose-600 shrink-0 ml-2">
                                <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">SALAH</span>
                                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Sensor Bawah */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[9.5px] sm:text-[10.5px] font-mono text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span>Mode: <strong className="text-emerald-600 font-bold">Soft-Warning</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3 text-emerald-600 animate-pulse" />
                        <span>Anti-Blur: <strong className="text-slate-800 font-bold">Aktif</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-amber-600 animate-pulse" />
                        <span>Sync: <strong className="text-amber-700 font-bold">Siap</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Strip */}
            <div className="mt-3 sm:mt-2 pt-3 sm:pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-xs text-slate-500 text-center sm:text-left">
              <div className="flex items-center gap-1.5 sm:gap-2 font-medium justify-center sm:justify-start">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-slate-700 font-semibold">Kompatibilitas Perangkat:</span>
                <span>Lancar di Ponsel Android/iOS, Tablet & Laptop</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-mono text-slate-400 flex-wrap justify-center">
                <span>55 BUTIR SOAL</span>
                <span>•</span>
                <span>KEPMENDIKDASMEN 56/2026</span>
                <span>•</span>
                <span>SHTKA DIGITAL</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: 4 PILAR TEKNOLOGI */}
        <section className="relative z-10 bg-slate-50/60 border-b border-slate-200/90 py-10 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto space-y-2.5 sm:space-y-3 mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shadow-sm border border-blue-500/30">
                <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                <span>ARSITEKTUR CBT ENGINE</span>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-[40px] font-black text-slate-900 tracking-tight leading-tight">
                Standar Kenyamanan &{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900">
                  Presisi Asesmen
                </span>
              </h2>
              <p className="text-slate-600 text-xs sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
                Dirancang khusus agar mudah digunakan siswa SMP/MTs di berbagai perangkat dengan perhitungan nilai akurat sesuai regulasi pemerintah.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {/* Pilar 1 */}
              <div className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-150 flex items-center justify-center text-blue-700 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700" />
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9.5px] font-bold uppercase tracking-wider font-mono">
                      Soft-Warning
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight mb-1.5">
                    Pengawasan Ramah Siswa
                  </h3>
                  <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed">
                    Mendeteksi perpindahan tab atau layar penuh dengan peringatan lembut tanpa memblokir ujian, sehingga siswa tidak panik saat notifikasi muncul.
                  </p>
                </div>
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-slate-500">
                  <span>ANTI-PANIK</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    AKTIF
                  </span>
                </div>
              </div>

              {/* Pilar 2 */}
              <div className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-150 flex items-center justify-center text-blue-700 group-hover:scale-105 transition-transform">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700" />
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/60 text-[9.5px] font-bold uppercase tracking-wider font-mono">
                      Skala 0,00–100,00
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight mb-1.5">
                    Evaluasi Diagnostik SHTKA
                  </h3>
                  <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed">
                    Perhitungan skor terpisah per mata uji (Istimewa, Baik, Memadai, Kurang) lengkap dengan review kunci jawaban dan pembahasan.
                  </p>
                </div>
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-slate-500">
                  <span>REGULASI</span>
                  <span className="text-blue-700 font-bold">NO. 56 TAHUN 2026</span>
                </div>
              </div>

              {/* Pilar 3 */}
              <div className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-700 group-hover:scale-105 transition-transform">
                      <Award className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-700" />
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9.5px] font-bold uppercase tracking-wider font-mono">
                      Beasiswa PPDB
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight mb-1.5">
                    Voucher Jalur Prestasi
                  </h3>
                  <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed">
                    Peserta langsung memperoleh kode voucher beasiswa pendaftaran di SMA Muhammadiyah 18 Jakarta sesuai capaian hasil ujian.
                  </p>
                </div>
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-slate-500">
                  <span>BENEFIT SISWA</span>
                  <span className="text-indigo-700 font-bold">KLAIM OTOMATIS</span>
                </div>
              </div>

              {/* Pilar 4 */}
              <div className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform">
                      <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9.5px] font-bold uppercase tracking-wider font-mono">
                      Ketahanan Sesi
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight mb-1.5">
                    Zero-Loss Sync Engine
                  </h3>
                  <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed">
                    Pencadangan lembar jawaban berjenjang di perangkat siswa sehingga pengerjaan tetap stabil dan aman hingga 500 peserta serentak.
                  </p>
                </div>
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-slate-500">
                  <span>INTEGRITAS DATA</span>
                  <span className="text-emerald-600 font-bold">100% UTUH</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SILABUS & CAKUPAN SUBTES (55 SOAL TKA SMP) */}
        <section id="silabus" className="relative z-10 bg-slate-50/70 border-b border-slate-200/90 py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 sm:pb-7 mb-6 sm:mb-8 border-b border-slate-200/80">
              <div className="space-y-2 text-left">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase shadow-sm border border-blue-500/30">
                  <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                  <span>STANDARISASI PUSMENDIK & AKM</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-slate-900 tracking-tight leading-tight">
                  Cakupan Materi &{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900">
                    2 Mata Uji Resmi TKA SMP
                  </span>
                </h2>
                <p className="text-slate-600 text-xs sm:text-sm max-w-2xl font-normal leading-relaxed">
                  Struktur instrumen berbasis <strong>Stimulus Wacana & Numerasi Kontekstual</strong> dengan 3 bentuk evaluasi: Pilihan Ganda Sederhana, PGK MCMA (Multi-Jawaban), dan PGK Kategori (Benar/Salah).
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white border border-slate-200 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-2xs shrink-0 self-start md:self-auto">
                <div className="text-left md:text-right">
                  <div className="text-[9px] sm:text-[9.5px] font-bold font-mono text-slate-400 uppercase tracking-wider">Total Paket</div>
                  <div className="text-xs font-black text-slate-900 font-mono">55 Soal • 30 Menit</div>
                </div>
                <div className="h-7 w-[1px] bg-slate-200" />
                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 font-mono font-bold text-[11px] sm:text-xs">
                  2 Mata Uji
                </div>
              </div>
            </div>

            {/* Grid 3 Kartu Subtes TKA SMP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
              {/* 1. Bahasa Indonesia */}
              <div className="group h-full p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between text-left">
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[9.5px] sm:text-[10px]">
                      BINDO • 01
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[10.5px] sm:text-[11px] text-blue-900 font-semibold bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100">
                      <Clock className="w-3 h-3 text-blue-600" /> 15 Menit
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors">
                      Bahasa Indonesia
                    </h4>
                    <p className="text-[10.5px] sm:text-[11px] text-blue-700 font-bold mt-0.5">
                      Fokus: Literasi Membaca Wacana
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Stimulus teks <strong>Informasi & Sastra</strong> yang menguji 3 ranah kompetensi asesmen:
                  </p>

                  <ul className="text-[11px] text-slate-600 space-y-1.5 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 font-medium">
                    <li>• <strong>Pemahaman Tekstual:</strong> Fakta eksplisit teks.</li>
                    <li>• <strong>Pemahaman Inferensial:</strong> Ide pokok & makna tersirat.</li>
                    <li>• <strong>Evaluasi & Apresiasi:</strong> Menilai kredibilitas & pesan teks.</li>
                  </ul>
                </div>

                <div className="pt-3.5 sm:pt-4 mt-4 sm:mt-5 border-t border-slate-150 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">JUMLAH BUTIR</span>
                  <span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200">30 Butir Soal</span>
                </div>
              </div>

              {/* 2. Matematika */}
              <div className="group h-full p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between text-left">
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-250 font-mono font-bold text-[9.5px] sm:text-[10px]">
                      MTK • 02
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[10.5px] sm:text-[11px] text-emerald-950 font-semibold bg-emerald-50/90 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Clock className="w-3 h-3 text-emerald-600" /> 15 Menit
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                      Matematika
                    </h4>
                    <p className="text-[10.5px] sm:text-[11px] text-emerald-700 font-bold mt-0.5">
                      Fokus: 4 Elemen Numerasi Fase D
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pengujian nalar logis, representasi visual, dan pemecahan masalah kontekstual nyata:
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:text-[10.5px] font-mono text-slate-700 bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-100">
                    <span className="bg-white p-1.5 rounded border border-slate-200 font-bold">• Bilangan</span>
                    <span className="bg-white p-1.5 rounded border border-slate-200 font-bold">• Aljabar</span>
                    <span className="bg-white p-1.5 rounded border border-slate-200 font-bold">• Geometri</span>
                    <span className="bg-white p-1.5 rounded border border-slate-200 font-bold">• Data & Peluang</span>
                  </div>
                </div>

                <div className="pt-3.5 sm:pt-4 mt-4 sm:mt-5 border-t border-slate-150 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">JUMLAH BUTIR</span>
                  <span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200">25 Butir Soal</span>
                </div>
              </div>

              {/* 3. Model Asesmen Pusmendik */}
              <div className="group h-full p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-blue-950 to-slate-950 text-white shadow-md border border-blue-600/40 flex flex-col justify-between text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-300/40 text-[9.5px] sm:text-[10px] font-mono font-bold">
                      SKOR DIAGNOSTIK
                    </span>
                    <div className="flex items-center gap-1 text-blue-200 font-mono text-[10.5px] sm:text-[11px] bg-white/10 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 0,00–100,00
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                      3 Bentuk Soal Interaktif
                    </h4>
                    <p className="text-[10.5px] sm:text-[11px] text-amber-300 font-mono mt-0.5">
                      Standar Pusmendik / AKM
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    Format pengerjaan di bilik ujian menyesuaikan tipe butir soal secara dinamis:
                  </p>

                  <ul className="text-[10.5px] sm:text-[11px] text-slate-300 space-y-1 bg-white/5 p-2.5 sm:p-3 rounded-xl border border-white/10 font-mono">
                    <li>1. <strong>PG Sederhana:</strong> 1 Opsi Pilihan Tunggal.</li>
                    <li>2. <strong>PGK MCMA:</strong> Multi-Jawaban Kotak Centang.</li>
                    <li>3. <strong>PGK Kategori:</strong> Matriks Tabel Benar/Salah.</li>
                  </ul>
                </div>

                <div className="relative z-10 pt-3.5 sm:pt-4 mt-4 sm:mt-5 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">STANDAR ASESMEN</span>
                  <span className="font-bold text-amber-400 tracking-wide">100% TERSTANDARISASI</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: KOMITMEN ARSITEKTUR & LEAD ARCHITECT */}
        <section className="relative z-10 bg-slate-50/70 border-b border-slate-200/90 py-10 sm:py-16 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-to-tr from-blue-400/15 via-indigo-300/10 to-transparent blur-3xl pointer-events-none rounded-full" />

            <div className="relative rounded-3xl bg-gradient-to-br from-white via-slate-50/80 to-blue-50/50 border border-blue-200/60 shadow-xl shadow-blue-900/5 p-5 sm:p-10 text-left overflow-hidden backdrop-blur-xs">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-900" />

              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 sm:pb-5 border-b border-blue-150/60">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900 text-white text-[9.5px] sm:text-[10px] font-mono font-bold tracking-wider uppercase shadow-xs">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                  <span>KOMITMEN STANDARISASI SISTEM</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-[10.5px] font-mono font-bold text-slate-500">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs">FULL-CLIENT RESILIENT</span>
                  <span className="text-slate-300">•</span>
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs text-blue-800">PUSMENDIK VERIFIED</span>
                </div>
              </div>

              <blockquote className="relative py-4 sm:py-7">
                <p className="text-sm sm:text-lg lg:text-[18.5px] font-normal text-slate-800 leading-relaxed tracking-tight">
                  “CBT Engine ini dikembangkan untuk menghadirkan pengalaman asesmen otentik bagi calon siswa jenjang SMA. Kami memastikan instrumen pengujian ini <strong className="font-semibold text-slate-950">ramah bagi semua perangkat siswa</strong>, berbobot saintifik, dan terintegrasi langsung dengan kemudahan pendaftaran di SMA Muhammadiyah 18 Jakarta.”
                </p>
              </blockquote>

              <div className="pt-4 sm:pt-6 border-t border-blue-150/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-3.5">
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 text-white flex items-center justify-center font-mono font-black text-xs sm:text-sm shadow-md shadow-blue-900/20 shrink-0 border border-blue-400/40">
                      FU
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        Fadhillah Umar, S.Pd.
                      </h3>
                      <span className="px-2 py-0.2 sm:py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-250 font-mono text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider">
                        Lead Architect
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                      SMA Muhammadiyah 18 Jakarta • <span className="text-blue-800 font-semibold">School of Champions</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-white border border-blue-200/80 shadow-2xs text-[10px] sm:text-[11px] font-mono">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-bold text-blue-900">TIM S.I.M.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER RESPONSIF */}
        <footer className="relative z-10 bg-white border-t border-slate-200/90 py-6 sm:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-5">
              <div className="flex items-center gap-3 sm:gap-3.5 text-left w-full sm:w-auto">
                <div className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl bg-white border border-slate-200 p-1 shadow-2xs flex items-center justify-center overflow-hidden">
                  <img
                    src="/logo-timsim.jpg"
                    alt="Logo SMA Muhammadiyah 18"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs sm:text-sm text-slate-900 tracking-tight">
                      CBT ENGINE • TO TKA SMP
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-mono text-[9px] font-bold">
                      v2.0
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-[11.5px] text-slate-500 font-normal">
                    <strong className="font-semibold text-slate-700">© 2026</strong>{" "}
                    <strong className="font-semibold text-slate-700">TIM S.I.M.</strong>{" "}
                    <strong className="font-semibold text-slate-700">SMA Muhammadiyah 18 Jakarta</strong>.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50/90 border border-slate-250/90 p-2 sm:p-2.5 px-3 sm:px-4 text-center shadow-2xs w-full sm:w-auto">
                <div className="flex items-center justify-center gap-2 mb-0.5 sm:mb-1">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-tight text-slate-800">
                    SISTEM AKTIF & TERKALIBRASI
                  </span>
                </div>
                <div className="font-mono text-[9px] sm:text-[9.5px] text-slate-400 font-medium tracking-tight flex items-center justify-center flex-wrap">
                  <span>ENKRIPSI TLS 1.3</span>
                  <span className="mx-1.5 text-slate-300">•</span>
                  <span>KEPMENDIKDASMEN 56/2026</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}