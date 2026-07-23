import { describe, expect, it } from "vitest";
import { resolveLegacyEffectMode } from "./legacyEffects";

describe("resolveLegacyEffectMode", () => {
  it("keeps the original automatic effect mapping", () => {
    expect(resolveLegacyEffectMode([true], "auto")).toBe("flip");
    expect(resolveLegacyEffectMode([false], "auto")).toBe("blur");
    expect(resolveLegacyEffectMode([true, false], "auto")).toBe("mosaic");
  });

  it("supports manual effect override", () => {
    expect(resolveLegacyEffectMode([false], "flip")).toBe("flip");
    expect(resolveLegacyEffectMode([true], "blur")).toBe("blur");
    expect(resolveLegacyEffectMode([true], "mosaic")).toBe("mosaic");
  });
});
