import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function note(message) {
  notes.push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".git", "dist", ".output", ".nitro"].includes(entry)) continue;
    const absolute = join(directory, entry);
    const info = statSync(absolute);
    if (info.isDirectory()) walk(absolute, output);
    else output.push(absolute);
  }
  return output;
}

const packageJson = JSON.parse(read("package.json"));
for (const section of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[section] ?? {})) {
    if (/^(\^|~|>|<|\*|latest$|next$)/i.test(String(version))) {
      fail(`${section}.${name} is not pinned exactly: ${version}`);
    }
  }
}

const bridge = read("scripts/windows-bridge.mjs");
const requiredBridgeControls = [
  "createHmac",
  "timingSafeEqual",
  "MAX_CLOCK_SKEW_MS",
  "RATE_LIMIT_MAX",
  "Replay request rejected",
  "Origin is not allowed",
  "Invalid Host header",
  "security-audit.jsonl",
  "emergencyLocked",
];
for (const marker of requiredBridgeControls) {
  if (!bridge.includes(marker)) fail(`Secure bridge control missing: ${marker}`);
}
if (/ExecutionPolicy["',\s]+Bypass/i.test(bridge)) {
  fail("PowerShell ExecutionPolicy Bypass is prohibited.");
}
if (/\bexec\s*\(/.test(bridge)) {
  fail("child_process.exec is prohibited; use fixed allowlisted execFile calls.");
}

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const files = walk(root).filter((path) => sourceExtensions.has(extname(path)));
const secretPatterns = [
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/gi,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel === "scripts/security-self-check.mjs") continue;
  if (/\beval\s*\(/.test(content)) fail(`eval() found in ${rel}`);
  if (/new\s+Function\s*\(/.test(content)) fail(`new Function() found in ${rel}`);
  if (/shell\s*:\s*true/.test(content)) fail(`shell:true found in ${rel}`);
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) fail(`Possible hardcoded secret found in ${rel}`);
  }
}

if (!read("src/routes/__root.tsx").includes("Content-Security-Policy")) {
  fail("Content Security Policy meta is missing.");
}
if (!read("vite.config.ts").includes("Permissions-Policy")) {
  fail("Development security headers are missing.");
}

note(`${files.length} source files scanned.`);
note("Direct dependency pinning checked.");
note("Desktop bridge hardening markers checked.");

for (const message of notes) console.log(`[SECURITY CHECK] ${message}`);
if (failures.length > 0) {
  for (const message of failures) console.error(`[SECURITY FAILURE] ${message}`);
  process.exit(1);
}
console.log("[SECURITY CHECK] PASS // RYKA CORE hardening baseline satisfied.");

