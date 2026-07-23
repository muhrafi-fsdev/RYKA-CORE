import { describe, expect, it } from "vitest";
import {
  CORE_VOCABULARY,
  appendPhrase,
  buildPainPhrase,
  normalizePhrase,
  removeLastWord,
} from "./accessibility";

describe("accessibility phrase helpers", () => {
  it("normalizes excessive whitespace", () => {
    expect(normalizePhrase("  Saya   ingin   minum.  ")).toBe("Saya ingin minum.");
  });

  it("appends phrases without duplicated whitespace", () => {
    expect(appendPhrase("Saya ingin", "  minum air. ")).toBe("Saya ingin minum air.");
  });

  it("removes the last word for accessible composer editing", () => {
    expect(removeLastWord("Saya ingin minum")).toBe("Saya ingin");
  });

  it("creates a health communication phrase", () => {
    expect(buildPainPhrase("dada")).toBe("Saya merasa sakit di bagian dada.");
  });

  it("keeps core vocabulary in a stable non-empty layout", () => {
    expect(CORE_VOCABULARY.length).toBeGreaterThanOrEqual(20);
    expect(CORE_VOCABULARY[0]?.id).toBe("saya");
  });

  it("limits phrase length for local UI safety", () => {
    expect(normalizePhrase("a".repeat(700))).toHaveLength(500);
  });
});
