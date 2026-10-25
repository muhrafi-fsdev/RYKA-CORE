// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HandTracker from "./HandTracker";

vi.mock("@/lib/orbScene", () => ({
  createOrbScene: () => ({
    setState() {},
    setEnergy() {},
    dispose() {},
    rotateBy() {},
    zoomBy() {},
    zoomIn() {},
    zoomOut() {},
    resetView() {},
    pulse() {},
  }),
}));

vi.mock("@/lib/desktopBridge", () => ({
  getBridgeSecurityState: () => Promise.reject(new Error("offline")),
  armBridge: vi.fn(),
  emergencyStopBridge: vi.fn(),
  sendDesktopAction: vi.fn(),
  updateBridgePermissions: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  DrawingUtils: class {},
  FilesetResolver: { forVisionTasks: vi.fn() },
  GestureRecognizer: class {
    static HAND_CONNECTIONS = [];
  },
}));

vi.mock("@/components/RykaAccess", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement("div", { "data-testid": "access", "data-open": String(props.open) }),
  };
});

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function stored<T>(key: string): T | undefined {
  const raw = localStorage.getItem(key);
  return raw === null ? undefined : (JSON.parse(raw) as T);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("HandTracker shell", () => {
  it("renders the HUD, dock and every system panel section", async () => {
    render(<HandTracker />);
    await settle();

    for (const text of [
      "RYKA CORE",
      "GESTURES OFF",
      "CONTROL STATE",
      "DESKTOP BRIDGE",
      "SECURITY CENTER",
      "CAMERA MANAGER",
      "TRIGGER SAFETY",
      "SWIPE CALIBRATION",
      "ACTION MAPPER",
      "LIVE GESTURES",
      "ACTION LOG",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it("reports the desktop bridge as offline when it cannot be reached", async () => {
    render(<HandTracker />);
    await settle();
    expect(screen.getByText("BRIDGE OFFLINE")).toBeTruthy();
  });

  it("opens and closes the system panel", () => {
    const { container } = render(<HandTracker />);
    const panel = () => container.querySelector("aside.ultron-panel")!;
    expect(panel().classList.contains("open")).toBe(false);

    fireEvent.click(screen.getByText("SYS"));
    expect(panel().classList.contains("open")).toBe(true);

    fireEvent.click(screen.getByText("×"));
    expect(panel().classList.contains("open")).toBe(false);
  });

  it("switches interface view and remembers it", () => {
    const { container } = render(<HandTracker />);
    fireEvent.click(screen.getByText("DEBUG"));
    expect(container.querySelector("main")!.className).toContain("ultron-view-debug");
    expect(stored("ryka-core-view")).toBe("debug");
  });

  it("lets the keyboard change the view unless typing in a field", () => {
    const { container } = render(<HandTracker />);
    fireEvent.keyDown(window, { key: "2" });
    expect(container.querySelector("main")!.className).toContain("ultron-view-minimal");

    const input = container.querySelector('input[type="range"]')!;
    fireEvent.keyDown(input, { key: "3" });
    expect(container.querySelector("main")!.className).toContain("ultron-view-minimal");
  });

  it("restores saved settings, including keys from the legacy prefix", () => {
    localStorage.setItem("ryka-core-quality", JSON.stringify("quality"));
    localStorage.setItem("rafi-ultron-view", JSON.stringify("minimal"));
    const { container } = render(<HandTracker />);
    expect(container.querySelector("main")!.className).toContain("ultron-view-minimal");
    const quality = screen.getByText("QUALITY PROFILE").closest("label")!.querySelector("select")!;
    expect(quality.value).toBe("quality");
  });

  it("switches to the custom profile when an action is remapped", () => {
    const { container } = render(<HandTracker />);
    fireEvent.click(screen.getByText("MEDIA"));
    expect(stored("ryka-core-profile")).toBe("media");

    const firstMapping = container.querySelector(".ultron-mapper-list select")!;
    fireEvent.change(firstMapping, { target: { value: "mute" } });

    expect(stored("ryka-core-profile")).toBe("custom");
    expect(stored<Record<string, string>>("ryka-core-action-map")?.Closed_Fist).toBe("mute");
  });

  it("clamps the stored hand count and persists the normalised value", async () => {
    localStorage.setItem("ryka-core-num-hands", JSON.stringify(9));
    render(<HandTracker />);
    await settle();
    expect(stored("ryka-core-num-hands")).toBe(4);
  });

  it("opens the access suite from the dock and the panel", () => {
    render(<HandTracker />);
    expect(screen.getByTestId("access").getAttribute("data-open")).toBe("false");
    fireEvent.click(screen.getByText("ACCESS"));
    expect(screen.getByTestId("access").getAttribute("data-open")).toBe("true");
  });
});
