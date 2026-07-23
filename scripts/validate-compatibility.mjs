import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const handTrackerPath = resolve(root, "src/components/HandTracker.tsx");
const packagePath = resolve(root, "package.json");
const bridgePath = resolve(root, "scripts/windows-bridge.mjs");
const accessPath = resolve(root, "src/components/RykaAccess.tsx");

const failures = [];
const expectFile = (relativePath) => {
  const fullPath = resolve(root, relativePath);
  if (!existsSync(fullPath)) failures.push(`Missing file: ${relativePath}`);
};
const expectText = (text, value, label) => {
  if (!text.includes(value)) failures.push(`Missing feature marker: ${label}`);
};

[
  "src/lib/oneEuroFilter.ts",
  "src/lib/legacyEffects.ts",
  "src/lib/gestureEngine.ts",
  "src/lib/dynamicGesture.ts",
  "src/lib/desktopBridge.ts",
  "src/lib/orbScene.ts",
  "src/lib/accessibility.ts",
  "src/components/RykaAccess.tsx",
  "src/routes/demo.tsx",
  "scripts/security-self-check.mjs",
  ".github/workflows/codeql.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/security-baseline.yml",
  ".github/workflows/gitleaks.yml",
  "START_DESKTOP.bat",
  "START_WEB.bat",
  "START_SECURITY_CHECK.bat",
  "START_ACCESS.bat",
  "README.md",
  "MODIFIKASI.md",
  "SECURITY.md",
  "SECURITY_HARDENING.md",
  "THREAT_MODEL.md",
  "ACCESSIBILITY.md",
].forEach(expectFile);

const handTracker = readFileSync(handTrackerPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const bridge = readFileSync(bridgePath, "utf8");
const access = readFileSync(accessPath, "utf8");

if (packageJson.name !== "ryka-core") failures.push("Package name must remain ryka-core");
if (packageJson.version !== "4.4.0") failures.push("Package version must be 4.4.0");

expectText(handTracker, "MAXIMUM HANDS", "1–4 hand selector");
expectText(handTracker, "SKELETON CONNECTIONS", "skeleton toggle");
expectText(handTracker, "LANDMARK POINTS", "landmark toggle");
expectText(handTracker, "LEGACY VISUAL EFFECTS", "visual effect toggle");
expectText(handTracker, "BLUR STRENGTH", "blur control");
expectText(handTracker, "MOSAIC BLOCK SIZE", "mosaic control");
expectText(handTracker, "FLIP 180°", "flip effect");
expectText(handTracker, "SKELETON ONLY", "skeleton-only camera view");
expectText(handTracker, "CLEAN CAMERA", "clean camera view");
expectText(handTracker, "MIRROR CAMERA", "mirror toggle");
expectText(handTracker, "OneEuroFilter", "One Euro motion smoothing");
expectText(handTracker, "DynamicGestureDetector", "dynamic swipe engine");
expectText(handTracker, "GestureStabilizer", "gesture stabilizer");
expectText(handTracker, "sendDesktopAction", "Windows desktop bridge action");
expectText(handTracker, "PROFILE_MAPS", "profile action maps");
expectText(handTracker, "exportLogs", "JSON/CSV action log export");
expectText(handTracker, "MUHAMMAD RAFI PRIYO", "developer branding");
expectText(handTracker, "SECURITY CENTER", "security center UI");
expectText(handTracker, "RYKA ACCESS", "accessibility suite launcher");
expectText(handTracker, "RykaAccess", "accessibility component integration");
expectText(handTracker, "EMERGENCY STOP", "emergency stop UI");
expectText(bridge, "createHmac", "HMAC request signing");
expectText(bridge, "Replay request rejected", "replay protection");
expectText(bridge, "RATE_LIMIT_MAX", "rate limiting");
expectText(bridge, "security-audit.jsonl", "security audit log");
expectText(access, "QUICK PHRASE BOARD", "quick phrase communication board");
expectText(access, "GESTURE-TO-TEXT PROFILE", "gesture-to-text personal profile");
expectText(access, "LIVE CAPTION", "live caption mode");
expectText(access, "CONVERSATION MODE", "two-way conversation mode");
expectText(access, "VISUAL SOUND ALERT", "visual sound alert");
expectText(access, "KOMUNIKASI DARURAT", "emergency communication mode");
expectText(access, "TEXT-TO-SPEECH", "text-to-speech controls");
expectText(access, "PERSONAL ACCESS & PARTNER COMMUNICATION // TANPA NUSAMIND AI", "standalone local accessibility mode");

if (failures.length > 0) {
  console.error("RYKA CORE compatibility validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RYKA CORE 4.4 compatibility, security, and accessibility validation passed.");
console.log("Legacy Rafi HandMotion features, hardened desktop controls, and RYKA Access systems are present.");
