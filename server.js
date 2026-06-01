// ============================================================
//  Website Pacaran - Server
//  Express + Socket.IO
//  - Hosting file statis (frontend)
//  - Room "pacaran" untuk pasangan
//  - Sinkronisasi pemutar video (nonton bareng)
//  - Signaling WebRTC untuk share screen
//  - Chat real-time
// ============================================================

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 5e6, // 5MB — cukup untuk gambar terkompresi
});

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" })); // Saweria kirim form-encoded

// Sajikan file statis dari folder /public
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
//  Penyimpanan DURASI ROOM (persisten per kode room)
//  Total waktu yang dihabiskan di room — tersimpan walau kosong,
//  lanjut lagi saat ada yang masuk dengan kode room sama.
// ------------------------------------------------------------
// DATA_DIR bisa diarahkan ke Railway Volume lewat env (mis. /data) agar persisten
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DURATIONS_FILE = path.join(DATA_DIR, "durations.json");

let roomSeconds = {};
try { roomSeconds = JSON.parse(fs.readFileSync(DURATIONS_FILE, "utf8")) || {}; } catch { roomSeconds = {}; }
const roomActiveSince = {}; // roomId -> timestamp saat room mulai aktif (ada minimal 1 user)
function saveDurations() { try { fs.writeFileSync(DURATIONS_FILE, JSON.stringify(roomSeconds)); } catch (e) {} }
function currentRoomSeconds(roomId) {
  let s = roomSeconds[roomId] || 0;
  if (roomActiveSince[roomId]) s += (Date.now() - roomActiveSince[roomId]) / 1000;
  return Math.floor(s);
}

// ------------------------------------------------------------
//  SKOR GAME (persisten per kode room) — { roomId: { nama: menang } }
// ------------------------------------------------------------
const SCORES_FILE = path.join(DATA_DIR, "scores.json");
let roomScores = {};
try { roomScores = JSON.parse(fs.readFileSync(SCORES_FILE, "utf8")) || {}; } catch { roomScores = {}; }
function saveScores() { try { fs.writeFileSync(SCORES_FILE, JSON.stringify(roomScores)); } catch (e) {} }

// ------------------------------------------------------------
//  RIWAYAT CHAT (persisten) — { roomId: [{ name, text, ts, system? }] }
//  Gambar & audio tidak disimpan (terlalu besar), hanya ditandai.
// ------------------------------------------------------------
const CHATS_FILE = path.join(DATA_DIR, "chats.json");
let roomChats = {};
try { roomChats = JSON.parse(fs.readFileSync(CHATS_FILE, "utf8")) || {}; } catch { roomChats = {}; }
let chatSaveTimer = null;
function saveChats() {
  clearTimeout(chatSaveTimer);
  chatSaveTimer = setTimeout(() => {
    try { fs.writeFileSync(CHATS_FILE, JSON.stringify(roomChats)); } catch (e) {}
  }, 2000); // debounce agar tidak terlalu sering tulis file
}
const CHAT_LIMIT = 100; // simpan maks 100 pesan per room

// Helper: emit chat ke room DAN simpan ke riwayat
function emitRoomChat(roomId, msg) {
  // Beri ID unik pada setiap pesan (untuk fitur hapus)
  if (!msg.system && !msg.msgId) msg.msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  io.to(roomId).emit("chat", msg);
  if (!roomChats[roomId]) roomChats[roomId] = [];
  const record = { ts: msg.ts || Date.now() };
  if (msg.system) { record.system = true; record.text = msg.text; }
  else {
    record.msgId = msg.msgId;
    record.name = msg.name;
    if (msg.text) record.text = msg.text;
    else if (msg.img) record.text = "[📷 Gambar]";
  }
  if (roomChats[roomId].length >= CHAT_LIMIT) roomChats[roomId].shift();
  roomChats[roomId].push(record);
  saveChats();
}

// ------------------------------------------------------------
//  STREAK HARIAN — { roomId: { lastDate, streak, longest } }
// ------------------------------------------------------------
const STREAKS_FILE = path.join(DATA_DIR, "streaks.json");
let roomStreaks = {};
try { roomStreaks = JSON.parse(fs.readFileSync(STREAKS_FILE, "utf8")) || {}; } catch { roomStreaks = {}; }
function saveStreaks() { try { fs.writeFileSync(STREAKS_FILE, JSON.stringify(roomStreaks)); } catch (e) {} }

function updateStreak(roomId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const s = roomStreaks[roomId] || { lastDate: null, streak: 0, longest: 0 };
  if (s.lastDate === today) return s; // sudah dihitung hari ini
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.streak = (s.lastDate === yesterday) ? s.streak + 1 : 1;
  s.lastDate = today;
  s.longest = Math.max(s.streak, s.longest);
  roomStreaks[roomId] = s;
  saveStreaks();
  return s;
}

// ------------------------------------------------------------
//  QUOTES HARIAN
// ------------------------------------------------------------
const DAILY_QUOTES = [
  "Jarak bukan penghalang cinta — ia justru mengajarkan kita betapa berharganya setiap momen kebersamaan yang kita miliki. Cintai prosesnya, karena reuni kalian nanti akan terasa jauh lebih indah 💕",
  "Rindu itu seperti hujan yang turun tanpa permisi — membasahi setiap sudut hati dengan kenangan tentangmu. Tapi di balik rindu itu ada cinta yang tidak pernah pergi 🌙",
  "Cinta sejati tidak diukur dari seberapa dekat jarak kalian, tapi dari seberapa kuat kalian bertahan ketika semuanya terasa berat. Dan kamu masih di sini — itu sudah cukup membuktikan segalanya 🌹",
  "Setiap pesan yang kamu kirim adalah pelukan virtual yang melewati ribuan kilometer. Setiap 'selamat pagi' adalah bukti bahwa kamu selalu jadi hal pertama yang dipikirkan 🤗",
  "LDR mengajarkan hal yang tidak diajarkan hubungan biasa: bahwa cinta bukan soal kehadiran fisik, tapi soal komitmen yang terus dipilih setiap harinya 💪",
  "Waktu terasa lambat saat jauh darimu, tapi setiap detik yang berlalu adalah selangkah lebih dekat menuju hari di mana kita tidak perlu lagi mengucapkan selamat tinggal ⏰",
  "Yang terbaik dari hubungan jarak jauh adalah momen reuni — saat semua kerinduan, semua pesan, semua panggilan malam itu akhirnya terbayar hanya dengan satu pelukan 🥰",
  "Langit malam yang sama, bintang yang sama menerangi kita berdua dari dua tempat berbeda. Saat kamu memandang bintang, ingatlah bahwa seseorang di sana sedang memikirkanmu juga 🌟",
  "Percayalah — semua jarak akan terbayar lunas oleh pelukan pertama kalian setelah lama berpisah. Sabar itu bukan kelemahan, itu adalah bentuk cinta yang paling dewasa 🤍",
  "Tidak ada yang lebih kuat dari cinta yang mampu bertahan melawan jarak, waktu, dan kesepian. Kalau kamu masih di sini, berarti cinta itu nyata dan layak diperjuangkan ✨",
  "Selamat pagi, jiwa-jiwa yang sedang merindu! Semoga harimu seindah perasaanmu saat melihat nama dia muncul di notifikasi HP kamu 📱",
  "Cinta yang tulus tidak kenal jarak dan tidak kenal lelah. Ia terus tumbuh dalam setiap doa yang kamu panjatkan, dalam setiap senyum yang kamu simpan untuknya 💖",
  "Kamu jauh di mata, tapi selalu dekat di hati dan selalu ada di setiap pikiran. Rindu ini bukan beban — ia adalah bukti betapa berartinya kamu bagiku 🫶",
  "Menunggumu bukan siksaan, karena aku tahu setiap detik penantian ini akan terbayar dengan momen indah yang sudah menunggu kita di ujung jalan 🕊️",
  "Setiap hari tanpa kamu adalah latihan kesabaran dan rasa syukur — latihan untuk menghargai betapa berharganya waktu bersamamu ketika kita akhirnya bertemu 🌺",
  "Cinta jarak jauh itu seperti bunga yang tumbuh di musim dingin — butuh lebih banyak usaha, tapi ketika mekar, keindahannya jauh lebih memukau dari bunga biasa 🌸",
  "Jarak mengajarkan kita untuk mencintai lebih dalam kata-kata, lebih tulus dalam doa, dan lebih sabar dalam menunggu. Ini bukan hubungan biasa — ini luar biasa 💌",
  "Setiap 'good night' yang kamu kirim sebelum tidur adalah bukti bahwa aku ada di pikiranmu. Dan setiap pagi aku terbangun dengan senyum, karena tahu kamu ada di ujung pesan itu 🌙",
  "Hubungan jarak jauh bukan tentang siapa yang paling kuat menahan rindu — tapi tentang dua orang yang sama-sama memilih untuk tetap berjalan bersama meski terpisah jarak 💑",
  "Kamu tahu apa yang indah dari LDR? Setiap 'aku rindu kamu' terasa lebih jujur, setiap 'aku sayang kamu' terasa lebih dalam, dan setiap pertemuan terasa seperti hadiah terbesar 🎁",
  "Di antara semua jarak yang memisahkan kita, ada satu hal yang selalu menjembatani — yaitu cinta yang kita pilih untuk jaga setiap harinya 🌈",
  "Mungkin kita tidak bisa selalu ada secara fisik, tapi hati kita sudah lama belajar untuk hadir tanpa batas jarak. Itu namanya cinta sejati 💞",
  "Setiap kali kamu capek dengan jarak ini, ingatlah alasan kamu memulai — dan ingatlah betapa pantas orang itu untuk diperjuangkan 🔥",
  "Rindu itu mahal harganya, tapi cinta yang menang melawan jarak nilainya tidak ternilai. Terus bertahan, karena yang terbaik sedang dalam perjalanan menuju kamu 🚀",
  "Tidak semua orang kuat menjalani hubungan jarak jauh. Tapi kamu masih di sini, masih bertahan — dan itu adalah bentuk keberanian yang paling romantis 🦋",
  "Satu hari nanti, jarak ini akan jadi cerita indah yang kalian tertawakan bersama sambil duduk berdampingan. Sampai saat itu tiba, tetaplah kuat 🤝",
  "Cinta yang bertahan melewati jarak adalah cinta yang sudah diuji — dan yang bertahan dari ujian, itulah yang paling berharga 💎",
  "Setiap malam yang kamu lalui sendiri, ingatlah bahwa di tempat lain, ada seseorang yang juga merindukanmu dengan cara yang sama 🌍",
  "Jangan hitung jarak yang memisahkan kalian. Hitung saja berapa banyak momen indah yang masih menunggu untuk diciptakan bersama 📅",
  "Yang namanya cinta sejati tidak akan mati karena jarak. Ia mungkin terluka oleh rindu, tapi tidak akan pernah padam selama kalian sama-sama menjaganya 🕯️",
];
let lastQuoteDate = "";

// ------------------------------------------------------------
//  TEBAK LAGU
// ------------------------------------------------------------
const SONGS = [
  // ── Hits utama ──
  { title: "Hati-Hati di Jalan",              artist: "Tulus",                                          ytId: "9II3OGZETo4", start: 55 },
  { title: "Cinta Luar Biasa",                artist: "Andmesh Kamaleng",                              ytId: "FcOctsNXyjk", start: 48 },
  { title: "Tak Ingin Usai",                  artist: "Keisya Levronka",                               ytId: "_ZYvZ7XfQU4", start: 52 },
  { title: "Sial",                            artist: "Mahalini",                                      ytId: "QSWYyoF79oE", start: 45 },
  { title: "Lathi",                           artist: "Weird Genius feat. Sara Fajira",                 ytId: "8uy7G2JXVSA", start: 38 },
  { title: "Ruang Sendiri",                   artist: "Tulus",                                         ytId: "c0p-61mLUGw",  start: 60 },
  { title: "Yang Terdalam",                   artist: "Peterpan",                                      ytId: "igaeQ2fJRxE", start: 55 },
  { title: "Separuh Aku",                     artist: "Noah",                                          ytId: "b0ZBBjViV8Y", start: 50 },
  { title: "Sisa Rasa",                       artist: "Mahalini",                                      ytId: "Wh66ThpxvI4", start: 45 },
  { title: "Adu Rayu",                        artist: "Yovie, Tulus & Glenn Fredly",                   ytId: "zi2dYEIwSkA", start: 55 },
  { title: "Kisinan 2",                       artist: "Ndarboy Genk",                                  ytId: "vu-RRck8ThA", start: 40 },
  { title: "Mungkin Hari Ini Esok Atau Nanti",artist: "Anneth",                                        ytId: "fR4B5FDlNBA", start: 50 },
  { title: "Bohongi Hati",                    artist: "Mahalini",                                      ytId: "weG-sqHHCB8", start: 48 },
  { title: "Melawan Restu",                   artist: "Mahalini",                                      ytId: "Svz5F8J1Ap0", start: 42 },
  { title: "Bunga Terakhir",                  artist: "Afgan feat. Raisa",                             ytId: "hSaQwNMiW5A", start: 50 },
  // ── Pop Indie Viral 2023-2024 ──
  { title: "Satu Bulan",                      artist: "Bernadya",                                      ytId: "yjnSX_iUFVo", start: 40 },
  { title: "Untungnya, Hidup Harus Tetap Berjalan", artist: "Bernadya",                               ytId: "HB8vftGxsIc", start: 52 },
  { title: "Tak Segampang Itu",               artist: "Anggi Marito",                                  ytId: "6NsiA6GFAbU", start: 56 },
  { title: "Komang",                          artist: "Raim Laode",                                    ytId: "TbDUfz9OOp8", start: 35 },
  { title: "Gala Bunga Matahari",             artist: "Sal Priadi",                                    ytId: "AQpEIZ8dNcU", start: 60 },
  { title: "Amin Paling Serius",              artist: "Sal Priadi & Nadin Amizah",                     ytId: "tCE9U4D995s", start: 50 },
  { title: "Penjaga Hati",                    artist: "Nadhif Basalamah",                              ytId: "jia3fhBQ8qI", start: 55 },
  { title: "Sialan",                          artist: "Adrian Khalif & Juicy Luicy",                   ytId: "0i-D1eBVKUM", start: 48 },
  { title: "Niscaya",                         artist: "Bilal Indrajaya",                               ytId: "r1nBktuqKwk", start: 45 },
  { title: "Tertawan Hati",                   artist: "Awdella",                                       ytId: "XQzHF8DGYp8", start: 52 },
  // ── Indie Ballad & Folk ──
  { title: "Runtuh",                          artist: "Feby Putri feat. Fiersa Besari",                ytId: "YrtS8MESh0I", start: 44 },
  { title: "Bertaut",                         artist: "Nadin Amizah",                                  ytId: "HyhLsy6b0XI", start: 40 },
  { title: "Rumpang",                         artist: "Nadin Amizah",                                  ytId: "XshVws8BE3A", start: 38 },
  { title: "Jiwa yang Bersedih",              artist: "Ghea Indrawari",                                ytId: "t9VWICGOD90", start: 60 },
  { title: "Kau Rumahku",                     artist: "Raissa Anggiani",                               ytId: "PgF_LYwJsFQ", start: 42 },
  { title: "Merayu Tuhan",                    artist: "Tri Suaka feat. Dodhy Kangen",                  ytId: "sa8xP20A11g", start: 38 },
  { title: "Takut",                           artist: "Idgitaf",                                       ytId: "5TUUg9mU_V0", start: 45 },
  { title: "Waktu yang Salah",                artist: "Fiersa Besari ft. Tantri",                      ytId: "mgqab4qSwLM", start: 52 },
  { title: "Zona Nyaman",                     artist: "Fourtwnty",                                     ytId: "tb_RhafSifw", start: 52 },
  // ── Pop Idol & Mainstream ──
  { title: "Tak Dianggap",                    artist: "Lyodra",                                        ytId: "xVEKfg49Fb8", start: 52 },
  { title: "Sang Dewi",                       artist: "Lyodra feat. Andi Rianto",                      ytId: "jzxCaNGJcPE", start: 50 },
  { title: "Jadi Kekasihku Saja",             artist: "Keisya Levronka",                               ytId: "zt4NeGqnCOk", start: 45 },
  { title: "Maafkan Aku",                     artist: "Tiara Andini",                                  ytId: "bxEmsKYADl8", start: 48 },
  { title: "Janji Setia",                     artist: "Tiara Andini",                                  ytId: "PVIvHCX35hU", start: 42 },
  { title: "Bukan Untukku",                   artist: "Tiara Andini",                                  ytId: "G_qF1eVhLVQ", start: 46 },
  { title: "Tak Sanggup Melupa",              artist: "Ziva Magnolya",                                 ytId: "BuU5dZb9W7o", start: 50 },
  { title: "Menyesal",                        artist: "Yovie Widianto ft. Lyodra, Tiara Andini, Ziva", ytId: "eXQwG8zmPDw", start: 55 },
  { title: "Kesempurnaan Cinta",              artist: "Rizky Febian",                                  ytId: "XyHhr2XbaGc", start: 48 },
  { title: "Berpisah Itu Mudah",              artist: "Rizky Febian & Mikha Tambayong",                ytId: "XzbSff3NY3M", start: 40 },
  // ── Pop Era 2015-2020 ──
  { title: "Surat Cinta untuk Starla",        artist: "Virgoun",                                       ytId: "t0Bt3a-MLGs", start: 55 },
  { title: "Asal Kau Bahagia",               artist: "Armada",                                        ytId: "py6GDNgye6k", start: 42 },
  { title: "Pergi Pagi Pulang Pagi",          artist: "Armada",                                        ytId: "ur8K6XPwscY", start: 42 },
  { title: "Cinta Itu Buta",                  artist: "Armada",                                        ytId: "vXU_IaMrB7c", start: 44 },
  { title: "Tetap Dalam Jiwa",               artist: "Isyana Sarasvati",                               ytId: "anMYu17aZT4", start: 48 },
  { title: "Kau Adalah",                      artist: "Isyana Sarasvati feat. Rayi Putra",             ytId: "KnWUFpwkqRA", start: 44 },
  { title: "Berawal Dari Tatap",              artist: "Yura Yunita",                                   ytId: "mIbEJKUjV0s", start: 44 },
  { title: "Kali Kedua",                      artist: "Raisa",                                         ytId: "SHj2kJzVi_g", start: 46 },
  { title: "Usai di Sini",                    artist: "Raisa",                                         ytId: "nqHFCV_3PxU", start: 50 },
  // ── Pamungkas, Hindia, Kunto Aji, HIVI, Adera, MALIQ, Juicy Luicy ──
  { title: "To The Bone",                     artist: "Pamungkas",                                     ytId: "oIYWenB637c", start: 44 },
  { title: "I Love You But I'm Letting Go",   artist: "Pamungkas",                                     ytId: "NO_cVedXdmM", start: 38 },
  { title: "Secukupnya",                      artist: "Hindia",                                        ytId: "DydcU_2m6Vs", start: 55 },
  { title: "Rumah ke Rumah",                  artist: "Hindia",                                        ytId: "7U20i3bMX10", start: 48 },
  { title: "Terlalu Lama Sendiri",            artist: "Kunto Aji",                                     ytId: "DANYP9wXGi0", start: 50 },
  { title: "Pilu Membiru",                    artist: "Kunto Aji",                                     ytId: "1JskEYFuUpA", start: 55 },
  { title: "Siapkah Kau 'tuk Jatuh Cinta Lagi", artist: "HIVI!",                                     ytId: "xW6rC5BKo2I", start: 52 },
  { title: "Lebih Indah",                     artist: "Adera",                                         ytId: "OqsM5kQYjTc", start: 48 },
  { title: "Kita Bikin Romantis",             artist: "MALIQ & D'Essentials",                          ytId: "48C3VWfLadM", start: 50 },
  { title: "Tampar",                          artist: "Juicy Luicy",                                   ytId: "aN7LR5Yem-8", start: 45 },
  // ── Tulus & Pop Rock Klasik ──
  { title: "Monokrom",                        artist: "Tulus",                                         ytId: "QqJ-Vp8mvbk", start: 50 },
  { title: "Manusia Kuat",                    artist: "Tulus",                                         ytId: "f-fEeF12FH4", start: 58 },
  { title: "Gajah",                           artist: "Tulus",                                         ytId: "I-el8UadDc4", start: 45 },
  { title: "Interaksi",                       artist: "Tulus",                                         ytId: "fT5PiiQ0VXg", start: 48 },
  { title: "Semua Tentang Kita",              artist: "Peterpan",                                      ytId: "hhn-nGSuenM", start: 50 },
  { title: "Dan",                             artist: "Sheila On 7",                                   ytId: "dGcGbF4ex5o", start: 40 },
  { title: "Itu Aku",                         artist: "Sheila On 7",                                   ytId: "a4a_mhXgGSg", start: 45 },
  { title: "Penjaga Hati",                    artist: "Ari Lasso",                                     ytId: "9GTNdJikR-Q", start: 52 },
  { title: "Misteri Ilahi",                   artist: "Ari Lasso",                                     ytId: "x2BZoubxG0s", start: 46 },
  // ── Dangdut Pop & Jawa Viral ──
  { title: "Mendung Tanpo Udan",              artist: "Ndarboy Genk",                                  ytId: "jeccjxIgBJ0", start: 35 },
  { title: "Kartonyono Medot Janji",          artist: "Denny Caknan",                                  ytId: "WlmWXoP0C0s", start: 40 },
  { title: "Satru",                           artist: "Denny Caknan feat. Happy Asmara",               ytId: "sHI_ZV40qiE", start: 38 },
  { title: "Banyu Moto",                      artist: "Denny Caknan feat. Happy Asmara",               ytId: "9IkH9-3xkEY", start: 42 },
  { title: "Ngawi Nagih Janji",               artist: "Denny Caknan & Ndarboy Genk",                   ytId: "XoeKnjZTeDw", start: 38 },
  { title: "Sayang",                          artist: "Via Vallen",                                    ytId: "UtjFu8c_goE", start: 32 },
  { title: "Kelangan",                        artist: "GuyonWaton",                                    ytId: "tZHPXPKd2rM", start: 36 },
  { title: "Lagi Syantik",                    artist: "Siti Badriah",                                  ytId: "Tet6_BlStEM", start: 33 },
  { title: "Karna Su Sayang",                 artist: "Nella Kharisma feat. Near",                     ytId: "k1fg8A1y0lI", start: 30 },
  // ── Ballad Nostalgia & Lintas Era ──
  { title: "Hanya Rindu",                     artist: "Andmesh Kamaleng",                              ytId: "CJC5PY5erzI", start: 45 },
  { title: "Seluruh Nafas Ini",               artist: "Last Child feat. Giselle",                      ytId: "Ske9Nwk-TmA", start: 55 },
  { title: "Sedang Ingin Bercinta",           artist: "Dewa 19",                                       ytId: "G4zgBCfPpzE", start: 48 },
  { title: "Kangen",                          artist: "Dewa 19",                                       ytId: "RYGgSRtYxd0", start: 45 },
  { title: "Semua Tak Sama",                  artist: "Padi",                                          ytId: "MjnfbHsIz0c", start: 50 },
  { title: "Sang Penghibur",                  artist: "Padi",                                          ytId: "-Xn3_Zi7nxk", start: 45 },
  { title: "Mantan Terindah",                 artist: "Kahitna",                                       ytId: "79f6qfIQNbs", start: 48 },
  { title: "Indah Pada Waktunya",             artist: "Rizky Febian feat. Aisyah Aziz",                ytId: "CJp_2n-6jp4", start: 45 },
  { title: "Doaku Untukmu Sayang",            artist: "Wali Band",                                     ytId: "vCIpDmRvBcM", start: 42 },
  { title: "Surga Cinta",                     artist: "Ada Band",                                      ytId: "i8kX300sVwM", start: 50 },
  { title: "Setengah Hati",                   artist: "Ada Band",                                      ytId: "cNOVn9qRRcc", start: 44 },
  { title: "Separuh Jiwaku Pergi",            artist: "Anang & Ashanty",                               ytId: "AFFiRcX0FK4", start: 50 },
  { title: "Kesempatan Kedua",                artist: "Ungu",                                          ytId: "wJU3C1O7JNs", start: 48 },
  { title: "Demi Waktu",                      artist: "Ungu",                                          ytId: "gJolDKDV9YI", start: 44 },
  { title: "Surat Cinta",                     artist: "Vina Panduwinata",                              ytId: "1-S3R4r4jMQ", start: 38 },
];
let guessGame = { active: false, song: null, timer: null };

// ------------------------------------------------------------
//  BADGE / LEVEL CHAT
// ------------------------------------------------------------
const BADGES_FILE = path.join(DATA_DIR, "badges.json");
let userBadges = {};
try { userBadges = JSON.parse(fs.readFileSync(BADGES_FILE, "utf8")) || {}; } catch { userBadges = {}; }
function saveBadges() { try { fs.writeFileSync(BADGES_FILE, JSON.stringify(userBadges)); } catch(e) {} }
function getBadge(count) {
  if (count >= 200) return { emoji: "👑", label: "Legend"        };
  if (count >= 50)  return { emoji: "🌟", label: "Warga Tetap"   };
  if (count >= 10)  return { emoji: "💬", label: "Reguler"       };
  return               { emoji: "🌱", label: "Pendatang Baru" };
}

// ------------------------------------------------------------
//  DONASI (dari Saweria webhook)
// ------------------------------------------------------------
//  DINDING CINTA
// ------------------------------------------------------------
const DINDING_FILE = path.join(DATA_DIR, "dinding.json");
let dindingPosts = [];
try { dindingPosts = JSON.parse(fs.readFileSync(DINDING_FILE, "utf8")) || []; } catch { dindingPosts = []; }
function saveDinding() { try { fs.writeFileSync(DINDING_FILE, JSON.stringify(dindingPosts)); } catch(e) {} }
function cleanDinding() {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  const before = dindingPosts.length;
  dindingPosts = dindingPosts.filter(p => p.ts > cutoff);
  if (dindingPosts.length !== before) saveDinding();
}
cleanDinding();
setInterval(cleanDinding, 60 * 60 * 1000);

app.get("/api/dinding", (req, res) => res.json(dindingPosts.slice(0, 60).map(p => ({ ...p, likedBy: undefined }))));
app.post("/api/dinding", (req, res) => {
  const { name, to, message, image } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: "Nama dan pesan wajib diisi" });
  if (String(message).length > 300) return res.status(400).json({ error: "Pesan terlalu panjang" });
  if (image && String(image).length > 140000000) return res.status(400).json({ error: "Gambar terlalu besar (max 100MB)" });
  const post = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    name: String(name).slice(0,30).trim(),
    to:   to ? String(to).slice(0,30).trim() : null,
    message: String(message).slice(0,300).trim(),
    image: image || null,
    likes: 0, likedBy: [],
    ts: Date.now(),
  };
  dindingPosts.unshift(post);
  if (dindingPosts.length > 300) dindingPosts = dindingPosts.slice(0, 300);
  saveDinding();
  io.emit("dinding-new", { ...post, likedBy: undefined });
  res.json({ ...post, likedBy: undefined });
});
app.post("/api/dinding/:id/like", (req, res) => {
  const post = dindingPosts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post tidak ditemukan" });
  const ip = String(req.ip || req.headers["x-forwarded-for"] || "anon").slice(0,40);
  if (!post.likedBy.includes(ip)) { post.likes++; post.likedBy.push(ip); saveDinding(); }
  io.emit("dinding-like", { id: post.id, likes: post.likes });
  res.json({ likes: post.likes });
});


// ------------------------------------------------------------
//  LEADERBOARD MINGGUAN CHAT GLOBAL
// ------------------------------------------------------------
function getWeekKey() {
  const d = new Date(); const y = d.getFullYear();
  const start = new Date(y, 0, 1);
  const w = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${y}-W${w}`;
}
const WEEKLY_FILE = path.join(DATA_DIR, "weekly.json");
let weeklyData = { key: "", data: {} };
try { weeklyData = JSON.parse(fs.readFileSync(WEEKLY_FILE, "utf8")) || { key:"", data:{} }; } catch { weeklyData = { key:"", data:{} }; }
function saveWeekly() { try { fs.writeFileSync(WEEKLY_FILE, JSON.stringify(weeklyData)); } catch(e) {} }
function ensureWeek() { const k = getWeekKey(); if (weeklyData.key !== k) { weeklyData = { key: k, data: {} }; saveWeekly(); } }
ensureWeek();

app.get("/api/leaderboard", (req, res) => {
  ensureWeek();
  const top = Object.entries(weeklyData.data)
    .sort((a,b) => b[1]-a[1]).slice(0,10)
    .map(([name,count],i) => ({ rank:i+1, name, count }));
  res.json(top);
});

// ------------------------------------------------------------
const DONATIONS_FILE = path.join(DATA_DIR, "donations.json");
let donations = [];
try { donations = JSON.parse(fs.readFileSync(DONATIONS_FILE, "utf8")) || []; } catch { donations = []; }
function saveDonations() { try { fs.writeFileSync(DONATIONS_FILE, JSON.stringify(donations)); } catch (e) {} }

// ------------------------------------------------------------
//  SARAN / FITUR / BUG dari user
// ------------------------------------------------------------
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
let feedbacks = [];
try { feedbacks = JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf8")) || []; } catch { feedbacks = []; }
function saveFeedback() { try { fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks)); } catch (e) {} }

// ------------------------------------------------------------
//  RESET VOTES — harus di module scope agar votes antar user terkumpul
// ------------------------------------------------------------
const resetVotes = {}; // roomId -> Set<socketId>

// ------------------------------------------------------------
//  MATCHMAKING — antrian cari pacar online
// ------------------------------------------------------------
const matchQueue = []; // [{ id: socketId, name, joinedAt }]

function makeRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "L" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function broadcastQueueCount() {
  const count = matchQueue.length;
  // Beritahu semua yang sedang antri
  matchQueue.forEach(({ id }) => io.to(id).emit("match-count", count));
  // Broadcast ke semua (landing page bisa tampilkan)
  io.emit("match-online-count", count);
}
function removeFromQueue(socketId) {
  const idx = matchQueue.findIndex(q => q.id === socketId);
  if (idx !== -1) { matchQueue.splice(idx, 1); broadcastQueueCount(); }
}

// Route eksplisit (biar refresh di /room tetap jalan)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/room", (req, res) => res.sendFile(path.join(__dirname, "public", "room.html")));
app.get("/find",   (req, res) => res.sendFile(path.join(__dirname, "public", "find.html")));
app.get("/saran",  (req, res) => res.sendFile(path.join(__dirname, "public", "saran.html")));
app.get("/dinding",(req, res) => res.sendFile(path.join(__dirname, "public", "dinding.html")));

// ─────────────────────────────────────────────────────────────
//  API: SAWERIA WEBHOOK (terima notifikasi donasi)
//  Isi webhook URL di Saweria: https://domain-kamu/api/donation-webhook
// ─────────────────────────────────────────────────────────────
app.post("/api/donation-webhook", (req, res) => {
  // Log raw payload untuk debug
  console.log("[WEBHOOK] headers:", JSON.stringify(req.headers["content-type"]));
  console.log("[WEBHOOK] body:", JSON.stringify(req.body));

  // Verifikasi secret opsional (set env SAWERIA_SECRET di Railway)
  const secret = process.env.SAWERIA_SECRET;
  if (secret) {
    const incoming = req.headers["x-saweria-key"] || req.query.key || "";
    if (incoming !== secret) return res.status(401).json({ error: "Unauthorized" });
  }
  const body = req.body || {};
  const data = body.data || body;
  if (!data.donator_name) {
    console.log("[WEBHOOK] DITOLAK — donator_name tidak ada. data:", JSON.stringify(data));
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Saweria kirim amount di field "amount_raw", bukan "amount"
  const amountVal = data.amount_raw ?? data.amount ?? (data.etc && data.etc.amount_to_display) ?? 0;
  const rawAmount = String(amountVal).replace(/\./g, "").replace(/,/g, ".");
  const donation = {
    name:    String(data.donator_name).slice(0, 50).trim(),
    amount:  Math.max(0, parseFloat(rawAmount) || 0),
    message: String(data.message || "").slice(0, 300).trim(),
    ts:      Date.now(),
  };
  console.log("[WEBHOOK] donasi tersimpan:", JSON.stringify(donation));

  donations.unshift(donation);
  if (donations.length > 500) donations = donations.slice(0, 500);
  saveDonations();

  // Semua donasi → notif (besar = kembang api, kecil = toast saja)
  if (donation.amount >= 3000) {
    io.emit("new-donation", donation);
  } else {
    io.emit("new-donation-small", donation);
  }
  res.json({ ok: true });
});

// API: top donatur mingguan (7 hari terakhir, reset otomatis tiap minggu)
app.get("/api/top-donors", (req, res) => {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const map = {};
  donations
    .filter((d) => d.ts && d.ts >= oneWeekAgo)
    .forEach((d) => {
      const key = d.name.toLowerCase();
      if (!map[key]) map[key] = { name: d.name, total: 0, count: 0 };
      map[key].total += d.amount;
      map[key].count++;
    });
  const top = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  res.json(top);
});

// API: donasi terbaru
app.get("/api/recent-donations", (req, res) => res.json(donations.slice(0, 10)));

// API: test donasi — broadcast ke SEMUA user (hanya untuk testing)
app.post("/api/test-donation", (req, res) => {
  const donation = {
    name:    (req.body && req.body.name)    || "Test Donatur",
    amount:  (req.body && req.body.amount)  || 50000,
    message: (req.body && req.body.message) || "Semangat terus! 🎉",
  };
  io.emit("new-donation", donation);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
//  GLOBAL CHAT — semua pengunjung bisa chat bersama
// ─────────────────────────────────────────────────────────────
const GLOBAL_ROOM = "__global__";
let globalMessages = []; // simpan 100 pesan terakhir di memori
let globalOnline = 0;    // jumlah user di halaman chat global

app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "public", "chat.html")));

// ─────────────────────────────────────────────────────────────
//  API: SARAN / FITUR / BUG
// ─────────────────────────────────────────────────────────────
app.post("/api/feedback", (req, res) => {
  const { name, type, message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: "Pesan kosong" });
  const types = ["saran", "fitur", "bug"];
  const fb = {
    id:      Date.now(),
    name:    String(name || "Anonim").slice(0, 40).trim() || "Anonim",
    type:    types.includes(type) ? type : "saran",
    message: String(message).slice(0, 800).trim(),
    ts:      Date.now(),
    likes:   0,
  };
  feedbacks.unshift(fb);
  if (feedbacks.length > 300) feedbacks = feedbacks.slice(0, 300);
  saveFeedback();
  io.emit("new-feedback", fb);
  res.json({ ok: true, id: fb.id });
});

app.get("/api/feedback", (req, res) => res.json(feedbacks.slice(0, 100)));

// Like feedback
app.post("/api/feedback/:id/like", (req, res) => {
  const fb = feedbacks.find((f) => f.id === Number(req.params.id));
  if (!fb) return res.status(404).json({ error: "Not found" });
  fb.likes = (fb.likes || 0) + 1;
  saveFeedback();
  res.json({ ok: true, likes: fb.likes });
});

// ------------------------------------------------------------
//  State sederhana di memori: { roomId: { users: Map<socketId, name>, videoState } }
// ------------------------------------------------------------
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      videoState: { url: null, type: null, time: 0, playing: false, updatedAt: Date.now() },
      musicState: { url: null, time: 0, playing: false, updatedAt: Date.now() },
      playlist: { queue: [], lastAddedBy: null },
    });
  }
  return rooms.get(roomId);
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let myName = "Sayang";

  // --- Gabung room ---
  socket.on("join", ({ roomId, name }) => {
    roomId = (roomId || "").trim().toUpperCase();
    if (!roomId) return;

    currentRoom = roomId;
    myName = (name || "Sayang").trim().slice(0, 24) || "Sayang";

    const room = getRoom(roomId);

    // Maksimal 2 orang (pacaran = berdua) — tapi izinkan lebih kalau mau ramai
    socket.join(roomId);
    room.users.set(socket.id, myName);

    // Room jadi aktif → mulai/lanjutkan hitung durasi
    if (!roomActiveSince[roomId]) roomActiveSince[roomId] = Date.now();

    // Pastikan skor untuk nama ini ada (biar scoreboard tampil lengkap)
    if (!roomScores[roomId]) roomScores[roomId] = {};
    if (!(myName in roomScores[roomId])) { roomScores[roomId][myName] = 0; saveScores(); }

    // Kirim daftar user & state video saat ini ke yang baru masuk
    socket.emit("joined", {
      roomId,
      you: { id: socket.id, name: myName },
      users: Array.from(room.users, ([id, n]) => ({ id, name: n })),
      videoState: room.videoState,
      musicState: room.musicState,
      playlist: { queue: room.playlist.queue, lastAddedBy: room.playlist.lastAddedBy },
      durationSeconds: currentRoomSeconds(roomId),
      streak: roomStreaks[roomId] || { streak: 0, longest: 0, lastDate: null },
      chatHistory: roomChats[roomId] || [],
    });

    // Update streak ketika ada 2+ orang di room (kedua pasangan hadir)
    if (room.users.size >= 2) {
      const streak = updateStreak(roomId);
      io.to(roomId).emit("streak", streak);
    }

    // Beri tahu yang lain
    socket.to(roomId).emit("user-joined", { id: socket.id, name: myName });
    io.to(roomId).emit(
      "users",
      Array.from(room.users, ([id, n]) => ({ id, name: n }))
    );
    io.to(roomId).emit("scoreboard", roomScores[roomId]);

    // Pesan sistem
    emitRoomChat(roomId, { system: true, text: `${myName} masuk ke ruangan 💕`, ts: Date.now() });
  });

  // --- Chat ---
  socket.on("chat", ({ text, img }) => {
    if (!currentRoom) return;
    if (!text && !img) return;
    const msgId = `${socket.id}-${Date.now()}`;
    const msg = { id: socket.id, name: myName, ts: Date.now(), msgId };
    if (text) msg.text = String(text).slice(0, 500);
    if (img && typeof img === "string" && img.length < 5_000_000) msg.img = img;
    emitRoomChat(currentRoom, msg);
  });

  // --- Hapus pesan chat ---
  socket.on("chat-delete", ({ msgId }) => {
    if (!currentRoom || !msgId) return;
    // Hanya pemilik pesan yang bisa hapus (cek via socket.id + prefix)
    socket.to(currentRoom).emit("chat-delete", { msgId, by: myName });
    // Tandai di riwayat sebagai dihapus (ganti text)
    if (roomChats[currentRoom]) {
      const m = roomChats[currentRoom].find((r) => r.msgId === msgId);
      if (m) { m.text = "[🚫 Pesan dihapus]"; m.deleted = true; saveChats(); }
    }
  });

  // --- Typing indicator ---
  socket.on("typing", ({ on }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("typing", { id: socket.id, name: myName, on: !!on });
  });

  // --- Set sumber video (link) ---
  socket.on("video-source", ({ url, type }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.videoState = { url, type, time: 0, playing: false, updatedAt: Date.now() };
    io.to(currentRoom).emit("video-source", { url, type });
    emitRoomChat(currentRoom, { system: true, text: `${myName} memutar video baru 🎬`, ts: Date.now() });
  });

  // --- Stop nonton bareng (bersihkan video) ---
  socket.on("video-stop", () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.videoState = { url: null, type: null, time: 0, playing: false, updatedAt: Date.now() };
    socket.to(currentRoom).emit("video-stop");
    emitRoomChat(currentRoom, { system: true, text: `${myName} menghentikan nonton bareng ⏹️`, ts: Date.now() });
  });

  // --- Kontrol pemutar (play/pause/seek) ---
  socket.on("video-control", ({ action, time }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (action === "play") room.videoState.playing = true;
    if (action === "pause") room.videoState.playing = false;
    if (typeof time === "number") room.videoState.time = time;
    room.videoState.updatedAt = Date.now();
    // Teruskan ke pasangan (bukan ke diri sendiri)
    socket.to(currentRoom).emit("video-control", { action, time, by: myName });
  });

  // --- Sinkronisasi waktu berkala (host kirim posisi) ---
  socket.on("video-sync", ({ time, playing }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("video-sync", { time, playing });
  });

  // ----------------------------------------------------------
  //  MUSIK BARENG — event terpisah dari video, bisa jalan bersamaan
  // ----------------------------------------------------------
  socket.on("music-source", ({ url }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.musicState = { url, time: 0, playing: true, updatedAt: Date.now() };
    socket.to(currentRoom).emit("music-source", { url, by: myName });
    emitRoomChat(currentRoom, { system: true, text: `${myName} memutar musik bareng 🎵`, ts: Date.now() });
  });

  socket.on("music-control", ({ action, time }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (typeof time === "number") room.musicState.time = time;
    room.musicState.playing = action === "play";
    room.musicState.updatedAt = Date.now();
    socket.to(currentRoom).emit("music-control", { action, time, by: myName });
  });

  socket.on("music-sync", ({ time, playing }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.musicState.time = time;
    room.musicState.playing = playing;
    socket.to(currentRoom).emit("music-sync", { time, playing });
  });

  socket.on("music-stop", () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.musicState = { url: null, time: 0, playing: false, updatedAt: Date.now() };
    socket.to(currentRoom).emit("music-stop", { by: myName });
    emitRoomChat(currentRoom, { system: true, text: `${myName} menghentikan musik ⏹️`, ts: Date.now() });
  });

  // ----------------------------------------------------------
  //  PLAYLIST BARENG — antrian lagu bergantian
  // ----------------------------------------------------------
  socket.on("playlist-add", ({ url, title, ytId }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    const item = {
      url: String(url).slice(0, 300),
      title: String(title || "Lagu").slice(0, 100),
      ytId: ytId ? String(ytId).slice(0, 20) : null,
      addedBy: myName,
      addedById: socket.id,
      addedAt: Date.now(),
    };
    room.playlist.queue.push(item);
    room.playlist.lastAddedBy = socket.id;
    io.to(currentRoom).emit("playlist-update", { queue: room.playlist.queue, lastAddedBy: socket.id });
    emitRoomChat(currentRoom, { system: true, text: `${myName} menambahkan "${item.title}" ke playlist 🎶`, ts: Date.now() });
  });

  socket.on("playlist-remove", ({ index }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (index < 0 || index >= room.playlist.queue.length) return;
    room.playlist.queue.splice(index, 1);
    io.to(currentRoom).emit("playlist-update", { queue: room.playlist.queue, lastAddedBy: room.playlist.lastAddedBy });
  });

  socket.on("playlist-play-index", ({ index }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (index < 0 || index >= room.playlist.queue.length) return;
    const song = room.playlist.queue[index];
    room.playlist.queue.splice(0, index + 1);
    room.musicState = { url: song.url, time: 0, playing: true, updatedAt: Date.now() };
    io.to(currentRoom).emit("playlist-update", { queue: room.playlist.queue, lastAddedBy: room.playlist.lastAddedBy });
    socket.emit("playlist-play-song", { url: song.url, title: song.title, ytId: song.ytId, mine: true });
    socket.to(currentRoom).emit("playlist-play-song", { url: song.url, title: song.title, ytId: song.ytId, mine: false });
    emitRoomChat(currentRoom, { system: true, text: `${myName} memutar "${song.title}" dari playlist 🎶`, ts: Date.now() });
  });

  socket.on("playlist-clear", () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.playlist.queue = [];
    room.playlist.lastAddedBy = null;
    io.to(currentRoom).emit("playlist-update", { queue: [], lastAddedBy: null });
  });

  // ----------------------------------------------------------
  //  REAKSI CINTA (hati melayang) & info pasangan
  // ----------------------------------------------------------
  socket.on("reaction", ({ emoji }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("reaction", { emoji, name: myName });
  });

  socket.on("couple-info", (info) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("couple-info", info);
  });

  // ----------------------------------------------------------
  //  FITUR SERU (kangen, game, roda) — satu kanal relay
  // ----------------------------------------------------------
  socket.on("fun", (data) => {
    if (!currentRoom || !data) return;
    socket.to(currentRoom).emit("fun", { ...data, by: myName });
  });

  // ----------------------------------------------------------
  //  SKOR GAME — menang +1, tersimpan per room
  // ----------------------------------------------------------
  socket.on("score-win", () => {
    if (!currentRoom) return;
    if (!roomScores[currentRoom]) roomScores[currentRoom] = {};
    roomScores[currentRoom][myName] = (roomScores[currentRoom][myName] || 0) + 1;
    saveScores();
    io.to(currentRoom).emit("scoreboard", roomScores[currentRoom]);
  });
  // Reset skor: butuh SEMUA orang di room setuju
  socket.on("score-reset-vote", () => {
    if (!currentRoom) return;
    if (!resetVotes[currentRoom]) resetVotes[currentRoom] = new Set();
    resetVotes[currentRoom].add(socket.id);
    const room = getRoom(currentRoom);
    const needed = room.users.size;
    const got = resetVotes[currentRoom].size;
    if (got >= needed) {
      // Semua setuju — reset
      resetVotes[currentRoom] = new Set();
      if (roomScores[currentRoom]) {
        Object.keys(roomScores[currentRoom]).forEach((k) => (roomScores[currentRoom][k] = 0));
        saveScores();
      }
      io.to(currentRoom).emit("score-reset-done");
      io.to(currentRoom).emit("scoreboard", roomScores[currentRoom] || {});
    } else {
      // Belum semua — beritahu yang lain
      socket.to(currentRoom).emit("score-reset-requested", { by: myName, got, needed });
      socket.emit("score-reset-waiting", { got, needed });
    }
  });

  // ----------------------------------------------------------
  //  WebRTC signaling untuk VIDEO CALL (kamera + mikrofon)
  // ----------------------------------------------------------
  socket.on("call-offer", ({ to, sdp, mode }) => {
    io.to(to).emit("call-offer", { from: socket.id, name: myName, sdp, mode });
  });
  socket.on("call-answer", ({ to, sdp }) => {
    io.to(to).emit("call-answer", { from: socket.id, sdp });
  });
  socket.on("call-ice", ({ to, candidate }) => {
    io.to(to).emit("call-ice", { from: socket.id, candidate });
  });
  socket.on("call-start", ({ mode } = {}) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("call-start", { from: socket.id, name: myName, mode });
  });
  socket.on("call-media", ({ mic, cam } = {}) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("call-media", { from: socket.id, mic, cam });
  });
  // Kanal sinyal terpadu (perfect negotiation): offer/answer/ICE
  socket.on("call-signal", ({ to, description, candidate }) => {
    if (!to) return;
    io.to(to).emit("call-signal", { from: socket.id, description, candidate });
  });
  socket.on("call-stop", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("call-stop", { from: socket.id });
  });

  // ----------------------------------------------------------
  //  WebRTC signaling untuk SHARE SCREEN
  // ----------------------------------------------------------
  socket.on("screen-offer", ({ to, sdp }) => {
    io.to(to).emit("screen-offer", { from: socket.id, name: myName, sdp });
  });
  socket.on("screen-answer", ({ to, sdp }) => {
    io.to(to).emit("screen-answer", { from: socket.id, sdp });
  });
  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });
  socket.on("screen-start", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("screen-start", { from: socket.id, name: myName });
  });
  socket.on("screen-stop", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("screen-stop", { from: socket.id });
  });

  // --- Keluar ---
  socket.on("disconnect", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(socket.id);
      // Bersihkan vote reset skor milik socket ini
      if (resetVotes[currentRoom]) resetVotes[currentRoom].delete(socket.id);
      io.to(currentRoom).emit("user-left", { id: socket.id, name: myName });
      io.to(currentRoom).emit(
        "users",
        Array.from(room.users, ([id, n]) => ({ id, name: n }))
      );
      emitRoomChat(currentRoom, { system: true, text: `${myName} keluar dari ruangan 🥺`, ts: Date.now() });
      if (room.users.size === 0) {
        if (roomActiveSince[currentRoom]) {
          roomSeconds[currentRoom] = (roomSeconds[currentRoom] || 0) + (Date.now() - roomActiveSince[currentRoom]) / 1000;
          roomActiveSince[currentRoom] = null;
          saveDurations();
        }
        delete resetVotes[currentRoom];
        rooms.delete(currentRoom);
      }
    }
    // Keluarkan dari antrian matchmaking jika disconnect
    removeFromQueue(socket.id);
  });

  // ----------------------------------------------------------
  //  MATCHMAKING — cari pacar online
  // ----------------------------------------------------------
  socket.on("match-join", ({ name }) => {
    removeFromQueue(socket.id); // cegah duplikat
    const cleanName = (name || "Anonim").trim().slice(0, 24) || "Anonim";

    if (matchQueue.length > 0) {
      // Ada yang menunggu → cocokkan!
      const partner = matchQueue.shift();
      const roomId = makeRoomId();
      socket.emit("match-found", { roomId, partnerName: partner.name });
      io.to(partner.id).emit("match-found", { roomId, partnerName: cleanName });
      broadcastQueueCount();
    } else {
      // Masuk antrian
      matchQueue.push({ id: socket.id, name: cleanName, joinedAt: Date.now() });
      broadcastQueueCount();
      socket.emit("match-waiting", { count: matchQueue.length });
    }
  });

  socket.on("match-cancel", () => {
    removeFromQueue(socket.id);
    socket.emit("match-cancelled");
  });

  // ── GLOBAL CHAT ──
  let gcName = null;

  socket.on("gc-join", ({ name }) => {
    gcName = (name || "Anonim").trim().slice(0, 24) || "Anonim";
    socket.join(GLOBAL_ROOM);
    globalOnline++;
    socket.emit("gc-history", globalMessages);
    io.to(GLOBAL_ROOM).emit("gc-online", globalOnline);
    const msg = { system: true, text: `${gcName} bergabung 👋`, ts: Date.now() };
    io.to(GLOBAL_ROOM).emit("gc-msg", msg);
    globalMessages.push(msg);
    if (globalMessages.length > 100) globalMessages.shift();

    // Quote harian — kirim sekali per hari ke semua saat ada yang masuk
    const today = new Date().toDateString();
    if (lastQuoteDate !== today) {
      lastQuoteDate = today;
      const q = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
      const qmsg = { system: true, isQuote: true, text: `🌸 Quote Hari Ini: "${q}"`, ts: Date.now() };
      io.to(GLOBAL_ROOM).emit("gc-msg", qmsg);
      globalMessages.push(qmsg);
      if (globalMessages.length > 100) globalMessages.shift();
    }
  });

  socket.on("gc-chat", ({ text }) => {
    if (!gcName || !text) return;
    const clean = String(text).trim().slice(0, 300);
    if (!clean) return;

    // ── Mulai Tebak Lagu ──
    if (clean === "!tebak") {
      if (guessGame.active) {
        socket.emit("gc-msg", { system: true, text: "⚠️ Game Tebak Lagu sedang berlangsung!", ts: Date.now() });
        return;
      }
      const song = SONGS[Math.floor(Math.random() * SONGS.length)];
      guessGame = { active: true, song, timer: null };
      const hint = song.title.split(" ").map(w => w[0] + "_ ".repeat(w.length - 1).trim()).join("  ");
      const startMsg = { system: true, text: `🎵 TEBAK LAGU! Petunjuk: [ ${hint} ] — Artis: ${song.artist} | Ketik jawabanmu! ⏱️ 30 detik`, ts: Date.now() };
      io.to(GLOBAL_ROOM).emit("gc-msg", startMsg);
      io.to(GLOBAL_ROOM).emit("tebak-start", { ytId: song.ytId, start: song.start });
      globalMessages.push(startMsg);
      guessGame.timer = setTimeout(() => {
        if (guessGame.active) {
          guessGame.active = false;
          const reveal = { system: true, text: `⏰ Waktu habis! Jawaban: "${song.title}" — ${song.artist}`, ts: Date.now() };
          io.to(GLOBAL_ROOM).emit("gc-msg", reveal);
          io.to(GLOBAL_ROOM).emit("tebak-end");
          globalMessages.push(reveal);
        }
      }, 30000);
      return;
    }

    // ── Cek jawaban Tebak Lagu ──
    if (guessGame.active) {
      const guess = clean.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const title = guessGame.song.title.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const words = title.split(" ").filter(w => w.length > 2);
      const correct = guess.includes(title) || (words.length > 0 && words.every(w => guess.includes(w)));
      if (correct) {
        clearTimeout(guessGame.timer);
        guessGame.active = false;
        const winMsg = { system: true, text: `🏆 ${gcName} BENAR! Jawabannya: "${guessGame.song.title}" — ${guessGame.song.artist} 🎉`, ts: Date.now() };
        io.to(GLOBAL_ROOM).emit("gc-msg", winMsg);
        io.to(GLOBAL_ROOM).emit("tebak-end");
        globalMessages.push(winMsg);
        return;
      }
    }

    // ── Badge tracking ──
    const bKey = gcName.toLowerCase();
    userBadges[bKey] = (userBadges[bKey] || 0) + 1;
    saveBadges();
    const badge = getBadge(userBadges[bKey]);

    // ── Weekly leaderboard tracking ──
    ensureWeek();
    weeklyData.data[bKey] = (weeklyData.data[bKey] || 0) + 1;
    saveWeekly();
    // Broadcast leaderboard update setiap 10 pesan
    if (weeklyData.data[bKey] % 10 === 0) {
      const top3 = Object.entries(weeklyData.data).sort((a,b)=>b[1]-a[1]).slice(0,3)
        .map(([name,count],i) => ({ rank:i+1, name, count }));
      io.to(GLOBAL_ROOM).emit("gc-leaderboard", top3);
    }

    const msg = { id: socket.id, name: gcName, text: clean, ts: Date.now(), badge };
    io.to(GLOBAL_ROOM).emit("gc-msg", msg);
    globalMessages.push(msg);
    if (globalMessages.length > 100) globalMessages.shift();
  });

  socket.on("gc-typing", () => {
    if (!gcName) return;
    socket.to(GLOBAL_ROOM).emit("gc-typing", { name: gcName });
  });
  socket.on("gc-stop-typing", () => {
    socket.to(GLOBAL_ROOM).emit("gc-stop-typing");
  });

  socket.on("disconnecting", () => {
    if (socket.rooms.has(GLOBAL_ROOM) && gcName) {
      globalOnline = Math.max(0, globalOnline - 1);
      const msg = { system: true, text: `${gcName} meninggalkan chat 🌸`, ts: Date.now() };
      io.to(GLOBAL_ROOM).emit("gc-msg", msg);
      io.to(GLOBAL_ROOM).emit("gc-online", globalOnline);
      globalMessages.push(msg);
      if (globalMessages.length > 100) globalMessages.shift();
    }
  });

  // Skip: beri tahu pasangan di room bahwa kita pergi mencari yang lain
  socket.on("match-skip", () => {
    if (currentRoom) socket.to(currentRoom).emit("partner-skipped", { name: myName });
  });

  // Kirim jumlah pencari ke socket yang baru connect (untuk landing page)
  socket.emit("match-online-count", matchQueue.length);
});

server.listen(PORT, () => {
  console.log("\n💕  Website Pacaran berjalan!");
  console.log(`💻  Buka di komputer ini : http://localhost:${PORT}`);
  console.log(`📱  Buka di HP/jaringan  : http://<IP-komputer>:${PORT}`);
  console.log("    (cek IP dengan perintah: ipconfig)\n");
});
