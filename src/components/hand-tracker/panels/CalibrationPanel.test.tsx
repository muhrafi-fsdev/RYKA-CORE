// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalibrationPanel } from "./CalibrationPanel";
import { addSample, createProfile, startSession } from "@/lib/calibration";

const profile = createProfile({
  minHorizontalDistance: 0.165,
  minVerticalDistance: 0.14,
  minHorizontalSpeed: 0.4,
  minVerticalSpeed: 0.35,
});

function renderPanel(props: Partial<Parameters<typeof CalibrationPanel>[0]> = {}) {
  const handlers = { onStart: vi.fn(), onCancel: vi.fn(), onReset: vi.fn() };
  render(
    <CalibrationPanel profile={null} session={null} cameraOn {...handlers} {...props} />,
  );
  return handlers;
}

afterEach(() => cleanup());

describe("CalibrationPanel", () => {
  it("offers to start and says the defaults are in use", () => {
    const { onStart } = renderPanel();
    expect(screen.getByText("DEFAULT")).toBeTruthy();
    fireEvent.click(screen.getByText("START CALIBRATION"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("cannot start without the camera and explains why", () => {
    renderPanel({ cameraOn: false });
    expect(screen.getByText("START CALIBRATION")).toHaveProperty("disabled", true);
    expect(screen.getByText(/Turn gestures on first/)).toBeTruthy();
  });

  it("shows the tuned thresholds and lets the user recalibrate or reset", () => {
    const { onStart, onReset } = renderPanel({ profile });
    expect(screen.getByText("CALIBRATED")).toBeTruthy();
    expect(screen.getByText(/0\.17 wide, 0\.14 tall/)).toBeTruthy();
    fireEvent.click(screen.getByText("RECALIBRATE"));
    fireEvent.click(screen.getByText("RESET"));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("cannot reset when nothing is calibrated", () => {
    renderPanel();
    expect(screen.getByText("RESET")).toHaveProperty("disabled", true);
  });

  it("shows the current step and progress while the wizard runs", () => {
    let session = startSession();
    session = addSample(session, { axis: "x", distance: 0.3, speed: 0.8 });
    const { onCancel } = renderPanel({ session });
    expect(screen.getByText(/SWIPE LEFT AND RIGHT: 1\/3/)).toBeTruthy();
    expect(screen.queryByText("START CALIBRATION")).toBeNull();
    fireEvent.click(screen.getByText("CANCEL"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("moves on to the vertical step after the horizontal ones", () => {
    let session = startSession();
    for (let i = 0; i < 3; i += 1) session = addSample(session, { axis: "x", distance: 0.3, speed: 0.8 });
    renderPanel({ session });
    expect(screen.getByText(/SWIPE UP AND DOWN: 0\/3/)).toBeTruthy();
  });
});
