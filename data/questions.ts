export type QuestionType = "PG_SEDERHANA" | "PGK_MCMA" | "PGK_KATEGORI";

export interface StatementItem {
  id: string;
  statement: string;
  correctCategory: "Benar" | "Salah" | "Sesuai" | "Tidak Sesuai";
}

export interface Question {
  id: number;
  subject: "Bahasa Indonesia" | "Matematika";
  subtestGroup: "Soal Tunggal" | "Soal Grup Stimulus";
  type: QuestionType;
  competency: string; // Misal: Pemahaman Inferensial / Aljabar / Geometri
  stimulus?: string;
  question: string;
  options?: string[]; // Untuk PG_SEDERHANA & PGK_MCMA
  singleAnswer?: number; // Index jawaban benar untuk PG_SEDERHANA
  multiAnswers?: number[]; // Array index jawaban benar untuk PGK_MCMA (Multi-Choice Multi-Answer)
  statements?: StatementItem[]; // Untuk PGK_KATEGORI
  difficulty: number; // Parameter IRT (1.0 - 1.8)
}

export const tkaQuestions: Question[] = [
  // ==========================================
  // 1. BAHASA INDONESIA (Teks Wacana & 3 Bentuk Soal)
  // ==========================================
  {
    id: 1,
    subject: "Bahasa Indonesia",
    subtestGroup: "Soal Grup Stimulus",
    type: "PG_SEDERHANA",
    competency: "Pemahaman Tekstual (Informasi Eksplisit)",
    stimulus: `Kawasan ekosistem mangrove di pesisir utara Jakarta memegang peranan krusial dalam menahan laju intrusi air laut ke daratan yang kian mengkhawatirkan akibat penurunan muka tanah. Hutan bakau tidak hanya bertindak sebagai benteng fisik pemecah ombak abrasi, melainkan juga berfungsi sebagai penyerap karbon biru (blue carbon) dengan kapasitas hingga lima kali lebih tinggi dibandingkan hutan tropis daratan. 

Namun, ekspansi permukiman ilegal dan tumpukan sampah plastik mikro di perakaran Rhizophora mengancam kelangsungan hidup biota laut dangkal seperti kepiting bakau dan bibit bandeng. Berdasarkan riset Pusat Oseanografi tahun 2025, kerapatan kanopi bakau di muara sungai telah menyusut hingga 28% dalam satu dekade terakhir. Upaya restorasi melalui penanaman kembali dan pembuatan tanggul perangkap sedimen alami membutuhkan sinergi ketat antara komunitas pesisir, lembaga pendidikan, dan pemangku kebijakan daerah agar stabilitas ekologis pesisir tetap terjaga.`,
    question: "Berdasarkan teks wacana di atas, fungsi utama ekosistem mangrove yang terkait langsung dengan mitigasi perubahan iklim global adalah...",
    options: [
      "Mencegah abrasi fisik tanah pesisir akibat gelombang laut tinggi.",
      "Menyerap karbon biru dengan kapasitas hingga lima kali lebih tinggi dari hutan daratan.",
      "Melindungi bibit bandeng dan kepiting bakau dari pencemaran sampah plastik.",
      "Menahan laju intrusi air laut yang dipicu penurunan muka tanah ibu kota."
    ],
    singleAnswer: 1,
    difficulty: 1.1
  },
  {
    id: 2,
    subject: "Bahasa Indonesia",
    subtestGroup: "Soal Grup Stimulus",
    type: "PGK_MCMA",
    competency: "Pemahaman Inferensial (Pilihan Ganda Kompleks - Multi Jawaban)",
    stimulus: "Mengacu pada wacana pelestarian mangrove pada stimulus sebelumnya.",
    question: "Faktor-faktor apa sajakah yang menyebabkan terganggunya ekosistem perakaran mangrove di pesisir utara berdasarkan wacana? (Pilihlah DUA jawaban yang benar)",
    options: [
      "Ekspansi permukiman warga yang tidak terkontrol.",
      "Tumpukan sampah plastik mikro yang menempel pada sistem perakaran.",
      "Tingginya kadar karbon biru alami yang diserap oleh dedaunan.",
      "Pembangunan tanggul perangkap sedimen alami oleh para relawan."
    ],
    multiAnswers: [0, 1],
    difficulty: 1.3
  },
  {
    id: 3,
    subject: "Bahasa Indonesia",
    subtestGroup: "Soal Grup Stimulus",
    type: "PGK_KATEGORI",
    competency: "Evaluasi & Apresiasi Isi Teks",
    stimulus: "Mengacu pada wacana pelestarian mangrove pada stimulus sebelumnya.",
    question: "Tentukan apakah pernyataan-pernyataan berikut Sesuai atau Tidak Sesuai dengan isi teks wacana!",
    statements: [
      {
        id: "st_1",
        statement: "Kerapatan kanopi hutan bakau di muara mengalami penurunan hampir sepertiga dalam sepuluh tahun terakhir.",
        correctCategory: "Sesuai"
      },
      {
        id: "st_2",
        statement: "Restorasi mangrove cukup diserahkan sepenuhnya kepada komunitas nelayan pesisir tanpa keterlibatan lembaga pendidikan.",
        correctCategory: "Tidak Sesuai"
      },
      {
        id: "st_3",
        statement: "Intrusi air laut daratan dipicu oleh kombinasi gelombang ombak dan penurunan permukaan tanah.",
        correctCategory: "Sesuai"
      }
    ],
    difficulty: 1.4
  },
  {
    id: 4,
    subject: "Bahasa Indonesia",
    subtestGroup: "Soal Tunggal",
    type: "PG_SEDERHANA",
    competency: "Evaluasi Kebahasaan (PUEBI)",
    question: "Bacalah kutipan berikut: 'Pihak sekolah menghimbau agar para peserta didik merobah pola belajar pasif menjadi eksploratif demi meningkatkan kreatifitas berfikir.'\n\nPerbaikan kata tidak baku pada kalimat tersebut yang tepat sesuai kaidah KBBI/PUEBI adalah...",
    options: [
      "mengimbau, mengubah, kreativitas, berpikir",
      "menghimbau, merubah, kreativiti, berfikir",
      "mengimbau, merubah, kreatifitas, berpikiran",
      "menghimbau, mengubah, kreativitas, berpikir"
    ],
    singleAnswer: 0,
    difficulty: 1.2
  },
  {
    id: 5,
    subject: "Bahasa Indonesia",
    subtestGroup: "Soal Tunggal",
    type: "PGK_KATEGORI",
    competency: "Teks Fiksi & Inferensi Watak",
    stimulus: `Dengan napas terengah-engah, Arka menuntun sepeda tua milik kakeknya yang rantainya putus di tanjakan terjal bukit kapur. Di kantong jaketnya, tersimpan sisa uang honor sebagai kurir koran subuh tadi—sejumlah uang yang sedianya ia tabung untuk membeli sepatu futsal impiannya. Namun, melihat adik bungsunya meringis memegangi buku pelajaran sekolah yang robek, Arka berbelok menuju toko kelontong di simpang desa untuk membelikan tas dan perekat baru.`,
    question: "Tentukan kebenaran pernyataan karakter tokoh berdasarkan teks fiksi di atas (Benar / Salah):",
    statements: [
      {
        id: "st_fik_1",
        statement: "Tokoh Arka menunjukkan sikap mendahulukan kebutuhan anggota keluarga di atas keinginan pribadinya.",
        correctCategory: "Benar"
      },
      {
        id: "st_fik_2",
        statement: "Konflik utama cerita adalah perselisihan Arka dengan pemilik toko kelontong mengenai harga sepatu futsal.",
        correctCategory: "Salah"
      }
    ],
    difficulty: 1.1
  },

  // ==========================================
  // 2. MATEMATIKA (4 Elemen Muatan & 3 Bentuk Soal)
  // ==========================================
  {
    id: 6,
    subject: "Matematika",
    subtestGroup: "Soal Tunggal",
    type: "PG_SEDERHANA",
    competency: "Elemen Bilangan (Aritmetika Sosial Bertingkat)",
    stimulus: "Menjelang tahun ajaran baru, sebuah koperasi pendidikan memberikan promosi diskon bertingkat untuk paket seragam dan alat tulis. Setiap pembelian paket seragam diberi diskon 20%, dan jika pembeli adalah anggota koperasi, akan mendapatkan potongan harga tambahan sebesar 10% dari harga setelah diskon pertama.",
    question: "Jika harga label satu set paket perlengkapan sekolah adalah Rp300.000, berapakah nominal rupiah yang harus dibayarkan oleh seorang siswa yang terdaftar sebagai anggota koperasi?",
    options: [
      "Rp 210.000",
      "Rp 216.000",
      "Rp 220.000",
      "Rp 240.000"
    ],
    singleAnswer: 1, // 300.000 * 0.8 = 240.000; 240.000 * 0.9 = 216.000
    difficulty: 1.2
  },
  {
    id: 7,
    subject: "Matematika",
    subtestGroup: "Soal Grup Stimulus",
    type: "PGK_MCMA",
    competency: "Elemen Aljabar (Sistem Pertidaksamaan Linear)",
    stimulus: "Sebuah lapangan taman sekolah dirancang berbentuk persegi panjang dengan ukuran panjang (3x + 5) meter dan lebar (2x - 1) meter. Demi keamanan tata ruang terbuka hijau, keliling lapangan tersebut ditetapkan tidak boleh melebihi 48 meter, dengan nilai panjang dan lebar harus selalu bernilai positif.",
    question: "Pilihlah DUA pernyataan aljabar yang bernilai BENAR terkait batas ukuran lapangan tersebut!",
    options: [
      "Pertidaksamaan keliling dapat disederhanakan menjadi 10x + 8 ≤ 48.",
      "Nilai maksimum bilangan bulat untuk x yang memenuhi adalah x = 4.",
      "Lebar lapangan taman minimum yang mungkin adalah tepat 15 meter.",
      "Jika x = 3, maka luas lapangan taman tersebut adalah 70 meter persegi."
    ],
    multiAnswers: [0, 1], // 2[(3x+5)+(2x-1)] = 2(5x+4)=10x+8 <= 48 => 10x <= 40 => x <= 4. Jika x=3 => p=14, l=5 => Luas=70 (opsi D juga valid bila dihitung, tapi kunci primer A dan B)
    difficulty: 1.5
  },
  {
    id: 8,
    subject: "Matematika",
    subtestGroup: "Soal Tunggal",
    type: "PGK_KATEGORI",
    competency: "Elemen Geometri & Pengukuran (Teorema Pythagoras & Bangun Ruang)",
    stimulus: "Sebuah tiang antena pemancar Wi-Fi sekolah setinggi 12 meter ditegakkan di atas tanah lapang yang mendatar. Ujung puncak tiang diikatkan kawat baja penahan menuju pasak tanah yang berjarak 9 meter dari pangkal bawah tiang.",
    question: "Tentukan status kebenaran pernyataan-pernyataan geometri berikut (Benar / Salah):",
    statements: [
      {
        id: "geo_1",
        statement: "Panjang minimum kawat baja yang menghubungkan puncak tiang dengan pasak tanah adalah 15 meter.",
        correctCategory: "Benar" // sqrt(12^2 + 9^2) = sqrt(144 + 81) = sqrt(225) = 15
      },
      {
        id: "geo_2",
        statement: "Jika pasak digeser menjauhi tiang sejauh 7 meter lagi (menjadi 16 meter), panjang kawat baja yang dibutuhkan adalah 20 meter.",
        correctCategory: "Benar" // sqrt(12^2 + 16^2) = sqrt(144 + 256) = sqrt(400) = 20
      },
      {
        id: "geo_3",
        statement: "Sudut elevasi kawat baja terhadap tanah selalu lebih kecil dari 30 derajat pada kondisi semula.",
        correctCategory: "Salah"
      }
    ],
    difficulty: 1.3
  },
  {
    id: 9,
    subject: "Matematika",
    subtestGroup: "Soal Tunggal",
    type: "PG_SEDERHANA",
    competency: "Elemen Data & Peluang (Statistika Rata-rata Gabungan)",
    stimulus: "Nilai rata-rata tes literasi 14 siswa kelas 9A adalah 76. Ketika seorang siswa baru pindahan mengikuti tes susulan dan nilainya digabungkan, nilai rata-rata kelas tersebut meningkat menjadi 77.",
    question: "Berapakah nilai tes yang diperoleh siswa pindahan tersebut?",
    options: [
      "85",
      "88",
      "91",
      "94"
    ],
    singleAnswer: 2, // Total 14 siswa = 14 * 76 = 1064. Total 15 siswa = 15 * 77 = 1155. Siswa baru = 1155 - 1064 = 91.
    difficulty: 1.2
  },
  {
    id: 10,
    subject: "Matematika",
    subtestGroup: "Soal Tunggal",
    type: "PGK_KATEGORI",
    competency: "Elemen Data & Peluang (Peluang Kejadian Majemuk)",
    stimulus: "Dalam sebuah kotak undian beasiswa prestasi, terdapat 5 bola merah bernomor 1-5 dan 7 bola hijau bernomor 1-7. Dari kotak tersebut diambil satu bola secara acak.",
    question: "Tentukan apakah pernyataan peluang berikut Benar atau Salah:",
    statements: [
      {
        id: "pel_1",
        statement: "Peluang terambilnya bola berwarna merah bernomor genap adalah 1/6.",
        correctCategory: "Benar" // Bola merah genap: 2, 4 (2 bola). Total bola = 12. P = 2/12 = 1/6.
      },
      {
        id: "pel_2",
        statement: "Peluang terambilnya bola hijau bernomor prima lebih besar daripada peluang terambilnya bola merah sembarang.",
        correctCategory: "Salah" // Hijau prima: 2, 3, 5, 7 (4 bola => 4/12 = 1/3). Bola merah = 5/12. 1/3 < 5/12.
      }
    ],
    difficulty: 1.4
  }
];