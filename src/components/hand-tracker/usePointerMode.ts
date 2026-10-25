import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { sendPointer } from "@/lib/desktopBridge";
import { PointerSender, PointerTracker, readHand } from "@/lib/pointerControl";

/** Pointer mode switches itself off after this long without a hand in view. */
export const HAND_LOST_MS = 5000;

export type PointerAvailability = {
  cameraOn: boolean;
  bridgeOnline: boolean;
  /** The bridge's pointer permission (off until the user turns it on). */
  permitted: boolean;
  /** Emergency lock on the bridge. */
  locked: boolean;
};

/** Why pointer mode cannot run right now, or null when it can. */
export function unavailableReason(state: PointerAvailability) {
  if (!state.cameraOn) return "TURN GESTURES ON FIRST";
  if (state.locked) return "SECURITY LOCK ACTIVE";
  if (!state.bridgeOnline) return "DESKTOP BRIDGE OFFLINE";
  if (!state.permitted) return "ENABLE POINTER CONTROL IN SECURITY CENTER";
  return null;
}

/**
 * Pointer mode: the index fingertip steers the Windows cursor and a pinch
 * clicks or drags, through the bridge's opt-in /pointer endpoint. It turns
 * itself off when the camera stops, the bridge locks or goes away, the
 * permission is withdrawn, or no hand has been seen for a few seconds.
 */
export function usePointerMode(availability: PointerAvailability) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const trackerRef = useRef(new PointerTracker());
  const senderRef = useRef<PointerSender | null>(null);
  const lastHandAtRef = useRef(0);
  const availabilityRef = useRef(availability);
  availabilityRef.current = availability;
  const reason = unavailableReason(availability);

  const stop = useCallback((message?: string) => {
    if (!activeRef.current) return;
    // Let go of a held button before the mode ends.
    for (const operation of trackerRef.current.release()) senderRef.current?.push(operation);
    trackerRef.current.reset();
    activeRef.current = false;
    setActive(false);
    if (message) toast(message);
  }, []);

  const getSender = useCallback(() => {
    senderRef.current ??= new PointerSender(sendPointer, {
      onError: (error) => {
        stop();
        toast.error(
          error instanceof Error ? `POINTER MODE // ${error.message}` : "POINTER MODE // SEND FAILED",
        );
      },
    });
    return senderRef.current;
  }, [stop]);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      stop("POINTER MODE OFF");
      return;
    }
    const why = unavailableReason(availabilityRef.current);
    if (why) {
      toast.error(`POINTER MODE // ${why}`);
      return;
    }
    getSender();
    trackerRef.current.reset();
    lastHandAtRef.current = performance.now();
    activeRef.current = true;
    setActive(true);
    toast.success("POINTER MODE ACTIVE");
  }, [getSender, stop]);

  useEffect(() => {
    if (active && reason) stop(`POINTER MODE OFF // ${reason}`);
  }, [active, reason, stop]);

  useEffect(() => () => stop(), [stop]);

  const processFrame = useCallback(
    (landmarks: Array<Array<NormalizedLandmark>>, now: number) => {
      if (!activeRef.current) return;
      const sender = getSender();
      const hand = landmarks[0] as Array<NormalizedLandmark> | undefined;
      const frame = hand && readHand(hand);

      if (!frame) {
        for (const operation of trackerRef.current.release()) sender.push(operation);
        if (now - lastHandAtRef.current > HAND_LOST_MS) stop("POINTER MODE OFF // HAND LOST");
        return;
      }
      lastHandAtRef.current = now;
      for (const operation of trackerRef.current.update({ ...frame, now })) sender.push(operation);
    },
    [getSender, stop],
  );

  return { active, activeRef, reason, toggle, processFrame };
}
