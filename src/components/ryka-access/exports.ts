import type { PersonalAccessProfile } from "@/lib/accessibility";
import type { AccessSettings, CaptionLine } from "./types";
import {
  ACCESS_INPUT_LABELS,
  ACCESS_NEED_LABELS,
  ACCESS_ROLE_LABELS,
  PHRASE_CATEGORIES,
} from "@/lib/accessibility";

/** Caption lines are stored newest first; the transcript reads oldest first. */
export function buildTranscript(captions: Array<CaptionLine>) {
  return captions
    .slice()
    .reverse()
    .map((line) => `[${line.time}] ${line.speaker}: ${line.text}`)
    .join("\n");
}

export function buildConfigurationSnapshot(
  personalProfile: PersonalAccessProfile,
  settings: AccessSettings,
  generatedAt: string,
) {
  const lines = [
    "RYKA ACCESS 4.4 — CONFIGURATION SNAPSHOT",
    `Generated: ${generatedAt}`,
    `Display name: ${personalProfile.displayName || "Not provided"}`,
    `Role: ${ACCESS_ROLE_LABELS[personalProfile.role]}`,
    `Needs: ${personalProfile.needs.map((need) => ACCESS_NEED_LABELS[need]).join(", ")}`,
    `Input mode: ${ACCESS_INPUT_LABELS[settings.inputMode]}`,
    `Dominant hand: ${personalProfile.dominantHand}`,
    `Environment: ${personalProfile.environment}`,
    `Reading support: ${personalProfile.readingSupport}`,
    `Large text: ${settings.largeText}`,
    `High contrast: ${settings.highContrast}`,
    `Reduced motion: ${settings.reducedMotion}`,
    `Switch interval: ${settings.scanningIntervalMs} ms`,
    `Dwell time: ${settings.dwellMs} ms`,
    "",
    "This file is a configuration snapshot, not a clinical assessment or diagnosis.",
  ];
  return lines.join("\n");
}

export function buildCommunicationCardText(displayName: string, favorites: Array<string>) {
  const emergency = PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases ?? [];
  const lines = [
    "RYKA ACCESS — KARTU KOMUNIKASI",
    displayName ? `Nama: ${displayName}` : "Nama: ____________________",
    "",
    "Saya mungkin membutuhkan waktu untuk berkomunikasi.",
    "Silakan gunakan kalimat singkat, tulisan, atau pilihan YA/TIDAK.",
    "",
    "PESAN FAVORIT:",
    ...(favorites.length ? favorites : ["Ya.", "Tidak.", "Tolong ulangi."]).map((item) => `- ${item}`),
    "",
    "DARURAT:",
    ...emergency.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

/** Full HTML document for the printable card; every user string goes through `safe`. */
export function buildCommunicationCardHtml(displayName: string, favorites: Array<string>) {
  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
  const emergency = PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases ?? [];
  const favoriteMarkup = (favorites.length ? favorites : ["Ya.", "Tidak.", "Tolong ulangi."])
    .map((item) => `<li>${safe(item)}</li>`).join("");
  const emergencyMarkup = emergency.map((item) => `<li>${safe(item)}</li>`).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Kartu Komunikasi RYKA</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}h1{color:#0369a1}section{border:2px solid #0ea5e9;border-radius:16px;padding:18px;margin:16px 0}li{font-size:20px;margin:10px 0}.note{font-size:22px;font-weight:700;background:#e0f2fe;padding:18px;border-radius:14px}@media print{button{display:none}}</style></head><body><h1>RYKA ACCESS — KARTU KOMUNIKASI</h1><p><strong>Nama:</strong> ${safe(displayName || "____________________")}</p><p class="note">Saya mungkin membutuhkan waktu untuk berkomunikasi. Silakan gunakan kalimat singkat, tulisan, atau pertanyaan YA/TIDAK.</p><section><h2>Pesan favorit</h2><ul>${favoriteMarkup}</ul></section><section><h2>Darurat</h2><ul>${emergencyMarkup}</ul></section><button onclick="window.print()">Cetak / Simpan PDF</button></body></html>`;
}
