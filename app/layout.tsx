import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CBT Tryout TKA SMP • SMA Muhammadiyah 18 Jakarta",
  description:
    "Platform Simulasi Tes Kemampuan Akademik (TKA) SMP/MTs Standar Pusmendik — SMA Muhammadiyah 18 Jakarta.",
  icons: {
    icon: "/logo-timsim.jpg",
    shortcut: "/logo-timsim.jpg",
    apple: "/logo-timsim.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preload" href="/logo-timsim.jpg" as="image" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}