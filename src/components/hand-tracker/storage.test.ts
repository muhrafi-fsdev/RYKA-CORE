// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readCompatStorage, readStorage } from "./storage";

beforeEach(() => {
  localStorage.clear();
});

describe("readStorage", () => {
  it("returns the fallback when nothing is stored", () => {
    expect(readStorage("missing", 7)).toBe(7);
  });

  it("parses stored JSON", () => {
    localStorage.setItem("n", JSON.stringify(12));
    localStorage.setItem("o", JSON.stringify({ a: [1, 2] }));
    expect(readStorage("n", 0)).toBe(12);
    expect(readStorage("o", {})).toEqual({ a: [1, 2] });
  });

  it("keeps stored false and zero values", () => {
    localStorage.setItem("flag", JSON.stringify(false));
    localStorage.setItem("zero", JSON.stringify(0));
    expect(readStorage("flag", true)).toBe(false);
    expect(readStorage("zero", 5)).toBe(0);
  });

  it("falls back on corrupted JSON instead of throwing", () => {
    localStorage.setItem("bad", "{not json");
    expect(readStorage("bad", "safe")).toBe("safe");
  });
});

describe("readCompatStorage", () => {
  it("prefers the current key over the legacy one", () => {
    localStorage.setItem("ryka-core-quality", JSON.stringify("quality"));
    localStorage.setItem("rafi-ultron-quality", JSON.stringify("performance"));
    expect(readCompatStorage("ryka-core-quality", "rafi-ultron-quality", "balanced")).toBe(
      "quality",
    );
  });

  it("migrates from the legacy key when the new one is absent", () => {
    localStorage.setItem("rafi-ultron-quality", JSON.stringify("performance"));
    expect(readCompatStorage("ryka-core-quality", "rafi-ultron-quality", "balanced")).toBe(
      "performance",
    );
  });

  it("returns the fallback when neither key exists", () => {
    expect(readCompatStorage("a", "b", "fallback")).toBe("fallback");
  });

  it("does not consult the legacy key once the new key exists, even if corrupted", () => {
    localStorage.setItem("new", "{broken");
    localStorage.setItem("old", JSON.stringify("legacy"));
    expect(readCompatStorage("new", "old", "fallback")).toBe("fallback");
  });
});
