import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./constants";
import {
  buildCommunicationCardHtml,
  buildCommunicationCardText,
  buildConfigurationSnapshot,
  buildTranscript,
} from "./exports";
import type { CaptionLine } from "./types";
import {
  ACCESS_INPUT_LABELS,
  ACCESS_NEED_LABELS,
  ACCESS_ROLE_LABELS,
  DEFAULT_PERSONAL_PROFILE,
  PHRASE_CATEGORIES,
} from "@/lib/accessibility";

const emergencyPhrases = PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases ?? [];

describe("buildTranscript", () => {
  const captions: Array<CaptionLine> = [
    { id: 3, text: "Terakhir", time: "10:00:03", speaker: "Dokter", confidence: 0.9 },
    { id: 2, text: "Kedua", time: "10:00:02", speaker: "Dokter", confidence: 0.9 },
    { id: 1, text: "Pertama", time: "10:00:01", speaker: "Saya", confidence: 0.8 },
  ];

  it("lists lines oldest first even though captions are stored newest first", () => {
    expect(buildTranscript(captions).split("\n")).toEqual([
      "[10:00:01] Saya: Pertama",
      "[10:00:02] Dokter: Kedua",
      "[10:00:03] Dokter: Terakhir",
    ]);
  });

  it("does not reorder the caller's array", () => {
    const copy = [...captions];
    buildTranscript(captions);
    expect(captions).toEqual(copy);
  });

  it("is empty when there are no captions", () => {
    expect(buildTranscript([])).toBe("");
  });
});

describe("buildConfigurationSnapshot", () => {
  const profile = {
    ...DEFAULT_PERSONAL_PROFILE,
    displayName: "Rafi",
    role: "caregiver" as const,
    needs: ["speech", "hearing"] as Array<"speech" | "hearing">,
  };
  const settings = { ...DEFAULT_SETTINGS, largeText: true, scanningIntervalMs: 1800, dwellMs: 900 };
  const lines = buildConfigurationSnapshot(profile, settings, "2026-01-01T10:00:00.000Z").split("\n");

  it("starts with the title and the generation time it was given", () => {
    expect(lines[0]).toBe("RYKA ACCESS 4.4 — CONFIGURATION SNAPSHOT");
    expect(lines[1]).toBe("Generated: 2026-01-01T10:00:00.000Z");
  });

  it("describes the profile and the settings with their human labels", () => {
    expect(lines).toContain("Display name: Rafi");
    expect(lines).toContain(`Role: ${ACCESS_ROLE_LABELS.caregiver}`);
    expect(lines).toContain(`Needs: ${ACCESS_NEED_LABELS.speech}, ${ACCESS_NEED_LABELS.hearing}`);
    expect(lines).toContain(`Input mode: ${ACCESS_INPUT_LABELS[settings.inputMode]}`);
    expect(lines).toContain("Large text: true");
    expect(lines).toContain("Switch interval: 1800 ms");
    expect(lines).toContain("Dwell time: 900 ms");
  });

  it("says when no name was given and always ends with the disclaimer", () => {
    const anonymous = buildConfigurationSnapshot(
      { ...profile, displayName: "" },
      settings,
      "now",
    ).split("\n");
    expect(anonymous).toContain("Display name: Not provided");
    expect(anonymous.at(-1)).toBe(
      "This file is a configuration snapshot, not a clinical assessment or diagnosis.",
    );
  });
});

describe("buildCommunicationCardText", () => {
  it("prints the name, the favourites and every emergency phrase", () => {
    const text = buildCommunicationCardText("Rafi", ["Saya haus.", "Tolong ulangi."]).split("\n");
    expect(text[0]).toBe("RYKA ACCESS — KARTU KOMUNIKASI");
    expect(text[1]).toBe("Nama: Rafi");
    expect(text).toContain("- Saya haus.");
    expect(text).toContain("DARURAT:");
    for (const phrase of emergencyPhrases) expect(text).toContain(`- ${phrase}`);
  });

  it("leaves a blank to write on when there is no name", () => {
    expect(buildCommunicationCardText("", ["Ya."])).toContain("Nama: ____________________");
  });

  it("falls back to Ya / Tidak / Tolong ulangi when there are no favourites", () => {
    const text = buildCommunicationCardText("Rafi", []);
    expect(text).toContain("- Ya.");
    expect(text).toContain("- Tidak.");
    expect(text).toContain("- Tolong ulangi.");
  });
});

describe("buildCommunicationCardHtml", () => {
  it("is a complete document with a print button", () => {
    const html = buildCommunicationCardHtml("Rafi", ["Ya."]);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Kartu Komunikasi RYKA</title>");
    expect(html).toContain('<button onclick="window.print()">');
    expect(html.endsWith("</html>")).toBe(true);
  });

  it("escapes markup in the name and in favourites", () => {
    const html = buildCommunicationCardHtml('<script>alert("x")</script>', [
      "<img src=x onerror=alert(1)>",
      "Tom & Jerry's",
    ]);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Tom &amp; Jerry&#039;s");
  });

  it("lists favourites and emergency phrases as list items", () => {
    const html = buildCommunicationCardHtml("Rafi", ["Saya haus."]);
    expect(html).toContain("<li>Saya haus.</li>");
    for (const phrase of emergencyPhrases) {
      expect(html).toContain(`<li>${phrase.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c] ?? c)}</li>`);
    }
  });

  it("uses the same fallbacks as the text card", () => {
    const html = buildCommunicationCardHtml("", []);
    expect(html).toContain("<li>Ya.</li><li>Tidak.</li><li>Tolong ulangi.</li>");
    expect(html).toContain("<strong>Nama:</strong> ____________________");
  });
});
