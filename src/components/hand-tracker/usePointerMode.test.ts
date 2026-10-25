// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAND_LOST_MS, unavailableReason, usePointerMode } from "./usePointerMode";
import type { PointerAvailability } from "./usePointerMode";
import { sendPointer } from "@/lib/desktopBridge";

vi.mock("@/lib/desktopBridge", () => ({
  sendPointer: vi.fn(() => Promise.resolve()),
}));

const ready: PointerAvailability = {
  cameraOn: true,
  bridgeOnline: true,
  permitted: true,
  locked: false,
};

/** Landmarks with the points the pointer reads; `pinched` closes thumb and index. */
function hand(pinched = false, tipX = 0.5) {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  points[0] = { ...points[0], x: 0.5, y: 0.8 };
  points[9] = { ...points[9], x: 0.5, y: 0.6 };
  points[4] = { ...points[4], x: 0.4, y: 0.4 };
  points[8] = { ...points[8], x: pinched ? 0.41 : tipX, y: 0.4 };
  return [points];
}

const sent = () => vi.mocked(sendPointer).mock.calls.map(([operation]) => operation);

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(sendPointer).mockClear();
  vi.mocked(sendPointer).mockImplementation(() => Promise.resolve());
});
afterEach(() => {
  vi.useRealTimers();
});

describe("unavailableReason", () => {
  it("is null when everything needed is in place", () => {
    expect(unavailableReason(ready)).toBeNull();
  });

  it("names the first thing that is missing", () => {
    expect(unavailableReason({ ...ready, cameraOn: false })).toBe("TURN GESTURES ON FIRST");
    expect(unavailableReason({ ...ready, locked: true })).toBe("SECURITY LOCK ACTIVE");
    expect(unavailableReason({ ...ready, bridgeOnline: false })).toBe("DESKTOP BRIDGE OFFLINE");
    expect(unavailableReason({ ...ready, permitted: false })).toBe(
      "ENABLE POINTER CONTROL IN SECURITY CENTER",
    );
  });

  it("reports the camera before the lock, and the lock before the bridge", () => {
    expect(unavailableReason({ cameraOn: false, bridgeOnline: false, permitted: false, locked: true })).toBe(
      "TURN GESTURES ON FIRST",
    );
    expect(unavailableReason({ ...ready, locked: true, bridgeOnline: false })).toBe(
      "SECURITY LOCK ACTIVE",
    );
  });
});

describe("usePointerMode", () => {
  it("starts off and shows why it cannot start", () => {
    const { result } = renderHook(() => usePointerMode({ ...ready, permitted: false }));
    expect(result.current.active).toBe(false);
    expect(result.current.reason).toBe("ENABLE POINTER CONTROL IN SECURITY CENTER");
  });

  it("refuses to start while unavailable and sends nothing", async () => {
    const { result } = renderHook(() => usePointerMode({ ...ready, permitted: false }));
    act(() => result.current.toggle());
    expect(result.current.active).toBe(false);
    act(() => result.current.processFrame(hand(), 100));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(sendPointer).not.toHaveBeenCalled();
  });

  it("ignores hand frames until it is switched on", async () => {
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.processFrame(hand(), 100));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(sendPointer).not.toHaveBeenCalled();
  });

  it("steers the cursor from hand frames once switched on", async () => {
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());
    expect(result.current.active).toBe(true);
    expect(result.current.activeRef.current).toBe(true);

    act(() => result.current.processFrame(hand(), 100));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ op: "move" });
  });

  it("presses on a pinch and releases when the fingers open", async () => {
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());

    act(() => result.current.processFrame(hand(false), 100));
    await act(() => vi.advanceTimersByTimeAsync(60));
    act(() => result.current.processFrame(hand(true), 160));
    await act(() => vi.advanceTimersByTimeAsync(60));
    act(() => result.current.processFrame(hand(false), 220));
    await act(() => vi.advanceTimersByTimeAsync(100));

    const ops = sent().map((operation) => operation.op);
    expect(ops).toContain("down");
    expect(ops.indexOf("down")).toBeLessThan(ops.indexOf("up"));
    expect(ops.filter((op) => op === "down")).toHaveLength(1);
    expect(ops.filter((op) => op === "up")).toHaveLength(1);
  });

  it("lets go of a held button when the hand leaves the frame", async () => {
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());
    act(() => result.current.processFrame(hand(true), 100));
    await act(() => vi.advanceTimersByTimeAsync(60));

    act(() => result.current.processFrame([], 200));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(sent().at(-1)).toEqual({ op: "up" });
    expect(result.current.active).toBe(true);
  });

  it("switches itself off when no hand is seen for a while", () => {
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());
    const start = performance.now();

    act(() => result.current.processFrame([], start + HAND_LOST_MS - 100));
    expect(result.current.active).toBe(true);
    act(() => result.current.processFrame([], start + HAND_LOST_MS + 100));
    expect(result.current.active).toBe(false);
    expect(result.current.activeRef.current).toBe(false);
  });

  it("releases the button when switched off by hand", async () => {
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());
    act(() => result.current.processFrame(hand(true), 100));
    await act(() => vi.advanceTimersByTimeAsync(60));

    act(() => result.current.toggle());
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.active).toBe(false);
    expect(sent().at(-1)).toEqual({ op: "up" });
  });

  it.each([
    ["the camera stops", { cameraOn: false }],
    ["the bridge locks", { locked: true }],
    ["the bridge goes offline", { bridgeOnline: false }],
    ["the permission is withdrawn", { permitted: false }],
  ])("switches itself off when %s", (_label, change) => {
    const { result, rerender } = renderHook((props: PointerAvailability) => usePointerMode(props), {
      initialProps: ready,
    });
    act(() => result.current.toggle());
    expect(result.current.active).toBe(true);

    rerender({ ...ready, ...change });
    expect(result.current.active).toBe(false);
  });

  it("switches itself off when the bridge refuses a request", async () => {
    vi.mocked(sendPointer).mockRejectedValue(new Error("pointer permission is disabled."));
    const { result } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());

    act(() => result.current.processFrame(hand(), 100));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.active).toBe(false);
  });

  it("releases a held button when the component goes away", async () => {
    const { result, unmount } = renderHook(() => usePointerMode(ready));
    act(() => result.current.toggle());
    act(() => result.current.processFrame(hand(true), 100));
    await act(() => vi.advanceTimersByTimeAsync(60));

    unmount();
    await vi.advanceTimersByTimeAsync(100);
    expect(sent().at(-1)).toEqual({ op: "up" });
  });
});
