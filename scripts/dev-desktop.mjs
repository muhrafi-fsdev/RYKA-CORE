import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const bridgeEntry = join(projectRoot, "scripts", "windows-bridge.mjs");
const viteEntry = join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const children = new Map();
const bootstrapToken = randomBytes(32).toString("base64url");
let shuttingDown = false;

const secureEnvironment = {
  ...process.env,
  RYKA_BRIDGE_BOOTSTRAP_TOKEN: bootstrapToken,
  VITE_RYKA_BRIDGE_BOOTSTRAP_TOKEN: bootstrapToken,
};

function ensureFile(path, label) {
  if (!existsSync(path)) {
    console.error(`[RYKA CORE] ${label} tidak ditemukan: ${path}`);
    if (label === "Vite") {
      console.error("[RYKA CORE] Jalankan npm install terlebih dahulu.");
    }
    process.exit(1);
  }
}

function startNodeProcess(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: secureEnvironment,
    windowsHide: false,
    shell: false,
  });

  children.set(name, child);

  child.once("error", (error) => {
    console.error(`[${name}] gagal dijalankan: ${error.message}`);
    shutdown(1);
  });

  child.once("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;

    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[${name}] berhenti dengan ${detail}.`);
    shutdown(code && code !== 0 ? code : 1);
  });

  return child;
}

function stopChild(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  try {
    child.kill("SIGTERM");
  } catch {
    // Child may already have exited.
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) stopChild(child);

  const timer = setTimeout(() => process.exit(exitCode), 700);
  timer.unref();
}

ensureFile(bridgeEntry, "Desktop Bridge");
ensureFile(viteEntry, "Vite");

console.log("[RYKA CORE] Generating isolated 256-bit bridge bootstrap token...");
console.log("[RYKA CORE] Starting Secure Windows Desktop Bridge...");
startNodeProcess("bridge", [bridgeEntry]);

console.log("[RYKA CORE] Starting Web UI at http://localhost:3200 ...");
startNodeProcess("vite", [viteEntry, "dev", "--host", "127.0.0.1", "--port", "3200"]);

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
process.once("SIGHUP", () => shutdown(0));
