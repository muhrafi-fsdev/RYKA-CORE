// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePersistedSetting } from "./usePersistedSetting";

beforeEach(() => {
  localStorage.clear();
});

describe("usePersistedSetting", () => {
  it("persists the initial value as JSON", () => {
    renderHook(() => usePersistedSetting(62, "ryka-core-motion-smoothing"));
    expect(localStorage.getItem("ryka-core-motion-smoothing")).toBe("62");
  });

  it("mirrors the value into the ref in the same effect", () => {
    const mirror = { current: 0 };
    renderHook(() => usePersistedSetting(80, "ryka-core-threshold", mirror));
    expect(mirror.current).toBe(80);
  });

  it("follows value changes for both the ref and storage", () => {
    const mirror = { current: "balanced" };
    const { rerender } = renderHook(
      ({ value }) => usePersistedSetting(value, "ryka-core-quality", mirror),
      { initialProps: { value: "balanced" } },
    );
    rerender({ value: "quality" });
    expect(mirror.current).toBe("quality");
    expect(localStorage.getItem("ryka-core-quality")).toBe('"quality"');
  });

  it("writes objects and booleans as JSON", () => {
    renderHook(() => usePersistedSetting({ Victory: "mute" }, "map"));
    renderHook(() => usePersistedSetting(false, "flag"));
    expect(localStorage.getItem("map")).toBe('{"Victory":"mute"}');
    expect(localStorage.getItem("flag")).toBe("false");
  });

  it("works without a ref", () => {
    expect(() =>
      renderHook(() => usePersistedSetting("command", "ryka-core-view")),
    ).not.toThrow();
    expect(localStorage.getItem("ryka-core-view")).toBe('"command"');
  });
});
