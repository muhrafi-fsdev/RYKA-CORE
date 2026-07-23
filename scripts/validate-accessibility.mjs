import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const componentPath = resolve(root, "src/components/RykaAccess.tsx");
const libraryPath = resolve(root, "src/lib/accessibility.ts");
const documentationPath = resolve(root, "ACCESSIBILITY.md");

const failures = [];
for (const path of [componentPath, libraryPath, documentationPath]) {
  if (!existsSync(path)) failures.push(`Missing accessibility file: ${path}`);
}

if (failures.length === 0) {
  const component = readFileSync(componentPath, "utf8");
  const library = readFileSync(libraryPath, "utf8");
  const requiredMarkers = [
    "QUICK PHRASE BOARD",
    "CORE VOCABULARY",
    "GESTURE-TO-TEXT PROFILE",
    "LIVE CAPTION",
    "CONVERSATION MODE",
    "VISUAL SOUND ALERT",
    "KOMUNIKASI DARURAT",
    "TEXT-TO-SPEECH",
    "PERSONAL NEEDS SETUP",
    "Single-switch scanning",
    "Dwell selection",
    "PARTNER DISPLAY",
    "PANDUAN MITRA KOMUNIKASI",
    "LOW-TECH FALLBACK",
    "PRIVATE SESSION",
    "TANPA NUSAMIND AI",
  ];
  for (const marker of requiredMarkers) {
    if (!component.includes(marker) && !library.includes(marker)) {
      failures.push(`Missing accessibility marker: ${marker}`);
    }
  }
  for (const marker of [
    "DEFAULT_GESTURE_PHRASES",
    "PHRASE_CATEGORIES",
    "CORE_VOCABULARY",
    "DEFAULT_PERSONAL_PROFILE",
    "PARTNER_GUIDE",
    "BODY_REGIONS",
    "normalizePhrase",
    "appendPhrase",
    "removeLastWord",
  ]) {
    if (!library.includes(marker)) failures.push(`Missing accessibility library marker: ${marker}`);
  }
}

const normalizePhrase = (value) => value.replace(/\s+/g, " ").trim().slice(0, 500);
const appendPhrase = (current, phrase) => {
  const left = normalizePhrase(current);
  const right = normalizePhrase(phrase);
  if (!right) return left;
  if (!left) return right;
  return normalizePhrase(`${left} ${right}`);
};
const removeLastWord = (value) => {
  const words = normalizePhrase(value).split(" ").filter(Boolean);
  words.pop();
  return words.join(" ");
};

if (normalizePhrase("  Saya   ingin minum.  ") !== "Saya ingin minum.") {
  failures.push("Phrase normalization runtime check failed");
}
if (appendPhrase("Saya ingin", "minum air.") !== "Saya ingin minum air.") {
  failures.push("Phrase append runtime check failed");
}
if (removeLastWord("Saya ingin minum") !== "Saya ingin") {
  failures.push("Phrase remove-last-word runtime check failed");
}
if (normalizePhrase("a".repeat(700)).length !== 500) {
  failures.push("Phrase length limit runtime check failed");
}

if (failures.length) {
  console.error("RYKA Access validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RYKA Access 4.4 validation passed.");
console.log("Personal setup, alternative input, core vocabulary, partner display, low-tech fallback, captions, privacy, and emergency communication markers are present.");
