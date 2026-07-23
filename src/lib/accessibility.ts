import type { GestureKey } from "@/lib/gestureEngine";

export type PhraseCategory = {
  id: string;
  label: string;
  icon: string;
  phrases: string[];
};

export type CommunicationEntry = {
  id: number;
  text: string;
  source: "gesture" | "phrase" | "typed" | "emergency" | "composer";
  timestamp: string;
  createdAt?: number;
};

export type AccessInputMode = "touch" | "keyboard" | "switch" | "dwell" | "gesture";
export type AccessRole = "user" | "caregiver" | "professional";
export type AccessNeed = "speech" | "hearing" | "motor" | "emergency" | "low-vision";

export type PersonalAccessProfile = {
  completed: boolean;
  displayName: string;
  role: AccessRole;
  needs: AccessNeed[];
  inputMode: AccessInputMode;
  language: string;
  dominantHand: "right" | "left" | "either";
  environment: "home" | "school" | "work" | "healthcare" | "mixed";
  readingSupport: "text" | "text-symbol" | "symbol";
};

export type CoreWord = {
  id: string;
  label: string;
  icon: string;
  group: "person" | "action" | "need" | "feeling" | "place" | "question";
};

export const DEFAULT_PERSONAL_PROFILE: PersonalAccessProfile = {
  completed: false,
  displayName: "",
  role: "user",
  needs: ["speech"],
  inputMode: "touch",
  language: "id-ID",
  dominantHand: "either",
  environment: "mixed",
  readingSupport: "text-symbol",
};

export const ACCESS_INPUT_LABELS: Record<AccessInputMode, string> = {
  touch: "Touch / Mouse",
  keyboard: "Keyboard",
  switch: "Single-switch scanning",
  dwell: "Dwell selection",
  gesture: "Gestur tangan",
};

export const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  user: "User Mode",
  caregiver: "Caregiver Mode",
  professional: "Professional Mode",
};

export const ACCESS_NEED_LABELS: Record<AccessNeed, string> = {
  speech: "Sulit berbicara / nonverbal",
  hearing: "Sulit mendengar",
  motor: "Keterbatasan gerak",
  emergency: "Komunikasi darurat",
  "low-vision": "Membutuhkan teks besar / visual jelas",
};

export const ACCESS_GESTURES: GestureKey[] = [
  "Closed_Fist",
  "Open_Palm",
  "Pointing_Up",
  "Thumb_Down",
  "Thumb_Up",
  "Victory",
  "ILoveYou",
  "Swipe_Left",
  "Swipe_Right",
  "Swipe_Up",
  "Swipe_Down",
];

export const ACCESS_GESTURE_LABELS: Record<GestureKey, string> = {
  Closed_Fist: "Kepalan tangan",
  Open_Palm: "Telapak terbuka",
  Pointing_Up: "Menunjuk ke atas",
  Thumb_Down: "Jempol ke bawah",
  Thumb_Up: "Jempol ke atas",
  Victory: "Victory",
  ILoveYou: "I Love You",
  Swipe_Left: "Geser kiri",
  Swipe_Right: "Geser kanan",
  Swipe_Up: "Geser atas",
  Swipe_Down: "Geser bawah",
};

export const DEFAULT_GESTURE_PHRASES: Record<GestureKey, string> = {
  Closed_Fist: "Saya perlu bantuan.",
  Open_Palm: "Halo.",
  Pointing_Up: "Tolong perhatikan saya.",
  Thumb_Down: "Tidak.",
  Thumb_Up: "Ya.",
  Victory: "Terima kasih.",
  ILoveYou: "Saya sayang kamu.",
  Swipe_Left: "Tolong ulangi.",
  Swipe_Right: "Saya mengerti.",
  Swipe_Up: "Tolong bicara lebih pelan.",
  Swipe_Down: "Saya ingin berhenti.",
};

export const CORE_VOCABULARY: CoreWord[] = [
  { id: "saya", label: "Saya", icon: "👤", group: "person" },
  { id: "kamu", label: "Kamu", icon: "🫵", group: "person" },
  { id: "ingin", label: "ingin", icon: "💭", group: "action" },
  { id: "butuh", label: "butuh", icon: "🤲", group: "action" },
  { id: "tolong", label: "tolong", icon: "🙏", group: "action" },
  { id: "tidak", label: "tidak", icon: "✋", group: "need" },
  { id: "ya", label: "ya", icon: "✅", group: "need" },
  { id: "lagi", label: "lagi", icon: "🔁", group: "need" },
  { id: "selesai", label: "selesai", icon: "🏁", group: "need" },
  { id: "makan", label: "makan", icon: "🍽️", group: "action" },
  { id: "minum", label: "minum", icon: "🥤", group: "action" },
  { id: "pergi", label: "pergi", icon: "➡️", group: "action" },
  { id: "pulang", label: "pulang", icon: "🏠", group: "place" },
  { id: "toilet", label: "ke toilet", icon: "🚻", group: "place" },
  { id: "dokter", label: "ke dokter", icon: "🩺", group: "place" },
  { id: "sakit", label: "sakit", icon: "🤕", group: "feeling" },
  { id: "senang", label: "senang", icon: "🙂", group: "feeling" },
  { id: "sedih", label: "sedih", icon: "😢", group: "feeling" },
  { id: "takut", label: "takut", icon: "😟", group: "feeling" },
  { id: "lelah", label: "lelah", icon: "😴", group: "feeling" },
  { id: "apa", label: "apa?", icon: "❓", group: "question" },
  { id: "dimana", label: "di mana?", icon: "📍", group: "question" },
  { id: "kapan", label: "kapan?", icon: "🕒", group: "question" },
  { id: "mengapa", label: "mengapa?", icon: "💡", group: "question" },
];

export const PHRASE_CATEGORIES: PhraseCategory[] = [
  {
    id: "basic",
    label: "Kebutuhan dasar",
    icon: "🥤",
    phrases: [
      "Saya ingin minum.",
      "Saya ingin makan.",
      "Saya ingin ke toilet.",
      "Saya ingin beristirahat.",
      "Saya merasa tidak nyaman.",
      "Saya membutuhkan obat.",
    ],
  },
  {
    id: "conversation",
    label: "Percakapan",
    icon: "💬",
    phrases: [
      "Halo.",
      "Ya.",
      "Tidak.",
      "Terima kasih.",
      "Tolong ulangi.",
      "Saya belum mengerti.",
      "Tolong tuliskan untuk saya.",
      "Tolong bicara lebih pelan.",
      "Mohon beri saya waktu untuk menjawab.",
    ],
  },
  {
    id: "feelings",
    label: "Perasaan",
    icon: "❤️",
    phrases: [
      "Saya senang.",
      "Saya sedih.",
      "Saya takut.",
      "Saya sedang sakit.",
      "Saya merasa lelah.",
      "Saya butuh waktu sendiri.",
    ],
  },
  {
    id: "places",
    label: "Tempat & aktivitas",
    icon: "📍",
    phrases: [
      "Saya ingin pulang.",
      "Saya ingin ke dokter.",
      "Saya ingin belajar.",
      "Saya ingin keluar sebentar.",
      "Tolong temani saya.",
      "Tolong antar saya ke sana.",
    ],
  },
  {
    id: "health",
    label: "Kesehatan",
    icon: "🩺",
    phrases: [
      "Saya kesakitan.",
      "Saya merasa pusing.",
      "Saya sulit bernapas.",
      "Saya memiliki alergi.",
      "Saya perlu obat saya.",
      "Tolong panggil petugas medis.",
      "Saya memahami pertanyaan Anda.",
      "Mohon beri saya waktu untuk menjawab.",
    ],
  },
  {
    id: "emergency",
    label: "Darurat",
    icon: "🆘",
    phrases: [
      "Tolong bantu saya sekarang.",
      "Saya kesulitan bernapas.",
      "Saya merasa sangat sakit.",
      "Tolong hubungi keluarga saya.",
      "Saya terjatuh.",
      "Tolong panggil petugas medis.",
    ],
  },
];

export const BODY_REGIONS = [
  "kepala",
  "leher",
  "dada",
  "perut",
  "punggung",
  "tangan kanan",
  "tangan kiri",
  "kaki kanan",
  "kaki kiri",
] as const;

export const PARTNER_GUIDE = [
  "Berikan waktu untuk menjawab.",
  "Lihat pengguna, bukan hanya perangkat.",
  "Ajukan pertanyaan yang jelas dan singkat.",
  "Konfirmasi arti pesan bila ragu.",
  "Jangan menyelesaikan kalimat tanpa izin.",
  "Gunakan tulisan atau visual bila diperlukan.",
];

export function normalizePhrase(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

export function appendPhrase(current: string, phrase: string) {
  const cleanCurrent = normalizePhrase(current);
  const cleanPhrase = normalizePhrase(phrase);
  if (!cleanPhrase) return cleanCurrent;
  if (!cleanCurrent) return cleanPhrase;
  return normalizePhrase(`${cleanCurrent} ${cleanPhrase}`);
}

export function removeLastWord(value: string) {
  const words = normalizePhrase(value).split(" ").filter(Boolean);
  words.pop();
  return words.join(" ");
}

export function buildPainPhrase(region: string) {
  return normalizePhrase(`Saya merasa sakit di bagian ${region}.`);
}

export function formatAccessTime(date = new Date()) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
