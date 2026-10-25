// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointerModePanel } from "./PointerModePanel";

afterEach(() => cleanup());

describe("PointerModePanel", () => {
  it("offers to start when nothing stands in the way", () => {
    const onToggle = vi.fn();
    render(<PointerModePanel active={false} reason={null} onToggle={onToggle} />);
    expect(screen.getByText("OFF")).toBeTruthy();
    fireEvent.click(screen.getByText("START POINTER MODE"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("cannot start and says why when something is missing", () => {
    render(<PointerModePanel active={false} reason="DESKTOP BRIDGE OFFLINE" onToggle={vi.fn()} />);
    expect(screen.getByText("START POINTER MODE")).toHaveProperty("disabled", true);
    expect(screen.getByText("DESKTOP BRIDGE OFFLINE.")).toBeTruthy();
  });

  it("can always be stopped, even if the conditions have just changed", () => {
    const onToggle = vi.fn();
    render(<PointerModePanel active reason="SECURITY LOCK ACTIVE" onToggle={onToggle} />);
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    const stop = screen.getByText("STOP POINTER MODE");
    expect(stop).toHaveProperty("disabled", false);
    fireEvent.click(stop);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("SECURITY LOCK ACTIVE.")).toBeNull();
  });

  it("explains how to use it and how it ends", () => {
    render(<PointerModePanel active={false} reason={null} onToggle={vi.fn()} />);
    expect(screen.getByText(/Pinch thumb and index to click/)).toBeTruthy();
    expect(screen.getByText(/Ctrl \+ Shift \+ F12/)).toBeTruthy();
  });
});
