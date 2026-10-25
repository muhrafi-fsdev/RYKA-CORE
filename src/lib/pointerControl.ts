import type { PointerOperation } from "@/lib/desktopBridge";
import { OneEuroFilter } from "@/lib/oneEuroFilter";

export type Point = { x: number; y: number };
type Sample = Point & { at: number };

/**
 * The part of the camera frame that covers the whole screen. The margin lets
 * the user reach every screen edge without leaving the frame.
 */
export const POINTER_REGION = { left: 0.15, top: 0.15, width: 0.7, height: 0.7 } as const;

// Same thumb-index hysteresis the orb pinch uses (hand-tracker/constants.ts).
const PINCH_ON = 0.32;
const PINCH_OFF = 0.45;
/** On a pinch the cursor goes back to where it was this long ago: closing the fingers moves the fingertip. */
const LOOKBACK_MS = 150;
const HISTORY_MS = 400;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Maps a point in (mirrored) camera-frame coordinates to a fraction of the screen. */
export function toScreenPoint(point: Point, region = POINTER_REGION): Point {
  return {
    x: clamp01((point.x - region.left) / region.width),
    y: clamp01((point.y - region.top) / region.height),
  };
}

type Landmark = { x: number; y: number };

/** Thumb-to-index distance relative to palm size; below ~0.32 the fingers are pinched. */
export function pinchRatio(hand: ReadonlyArray<Landmark>) {
  const scale = Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y);
  if (scale < 1e-6) return null;
  return Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) / scale;
}

export type PointerFrame = { tip: Point; palm: Point; pinchRatio: number; now: number };

/** Fingertip, palm centre and pinch of one hand, with x mirrored so right on screen is right. */
export function readHand(hand: ReadonlyArray<Landmark>): Omit<PointerFrame, "now"> | null {
  const ratio = pinchRatio(hand);
  if (ratio === null) return null;
  return {
    tip: { x: 1 - hand[8].x, y: hand[8].y },
    palm: { x: 1 - hand[9].x, y: hand[9].y },
    pinchRatio: ratio,
  };
}

/**
 * Turns hand frames into bridge operations. The index fingertip steers the
 * cursor; a pinch presses the button and a held pinch drags.
 *
 * Pinching moves the fingertip, so the press happens where the cursor was a
 * moment before, and while pressed the cursor follows the palm instead. On
 * release the button comes up first, at the drag position, and only then does
 * the cursor return to the fingertip.
 */
export class PointerTracker {
  private readonly fx = new OneEuroFilter({ minCutoff: 1.2, beta: 0.08 });
  private readonly fy = new OneEuroFilter({ minCutoff: 1.2, beta: 0.08 });
  private history: Array<Sample> = [];
  private pressed = false;
  private anchorCursor: Point = { x: 0, y: 0 };
  private anchorPalm: Point = { x: 0, y: 0 };

  get isPressed() {
    return this.pressed;
  }

  update(frame: PointerFrame): Array<PointerOperation> {
    const target = toScreenPoint(frame.tip);
    const smooth = { x: this.fx.filter(target.x, frame.now), y: this.fy.filter(target.y, frame.now) };
    this.history.push({ at: frame.now, ...smooth });
    this.history = this.history.filter((item) => frame.now - item.at <= HISTORY_MS);

    if (!this.pressed) {
      if (frame.pinchRatio < PINCH_ON) {
        const anchor = this.lookBack(frame.now);
        this.pressed = true;
        this.anchorCursor = anchor;
        this.anchorPalm = frame.palm;
        return [{ op: "move", ...anchor }, { op: "down" }];
      }
      return [{ op: "move", ...smooth }];
    }

    if (frame.pinchRatio > PINCH_OFF) {
      this.pressed = false;
      return [{ op: "up" }, { op: "move", ...smooth }];
    }

    const cursor = {
      x: clamp01(this.anchorCursor.x + (frame.palm.x - this.anchorPalm.x) / POINTER_REGION.width),
      y: clamp01(this.anchorCursor.y + (frame.palm.y - this.anchorPalm.y) / POINTER_REGION.height),
    };
    return [{ op: "move", ...cursor }];
  }

  /** Ends a press that is still held (hand lost, mode stopped). */
  release(): Array<PointerOperation> {
    if (!this.pressed) return [];
    this.pressed = false;
    return [{ op: "up" }];
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.history = [];
    this.pressed = false;
  }

  private lookBack(now: number): Point {
    const wanted = now - LOOKBACK_MS;
    for (let index = this.history.length - 1; index >= 0; index -= 1) {
      if (this.history[index].at <= wanted) return this.history[index];
    }
    return this.history[0];
  }
}

type SenderOptions = {
  onError: (error: unknown) => void;
  /** Smallest gap between two moves; keeps the rate under the bridge's pointer limit. */
  minMoveIntervalMs?: number;
  /** Moves shorter than this (fraction of the screen) are not worth sending. */
  epsilon?: number;
};

/**
 * Sends operations one at a time and in order. A newer move replaces a move
 * that has not left yet, and button events are never dropped or reordered.
 */
export class PointerSender {
  private queue: Array<PointerOperation> = [];
  private draining = false;
  private lastSentAt = 0;
  private lastMove: Point | null = null;

  constructor(
    private readonly send: (operation: PointerOperation) => Promise<void>,
    private readonly options: SenderOptions,
  ) {}

  push(operation: PointerOperation) {
    if (operation.op === "move") {
      const epsilon = this.options.epsilon ?? 0.002;
      const previous = this.lastMove;
      if (previous && Math.hypot(operation.x - previous.x, operation.y - previous.y) < epsilon) return;
      this.lastMove = { x: operation.x, y: operation.y };
      const tail = this.queue[this.queue.length - 1] as PointerOperation | undefined;
      if (tail?.op === "move") {
        this.queue[this.queue.length - 1] = operation;
        return;
      }
    }
    this.queue.push(operation);
    void this.drain();
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    const interval = this.options.minMoveIntervalMs ?? 40;
    try {
      while (this.queue.length > 0) {
        let operation = this.queue.shift()!;
        if (operation.op === "move") {
          const wait = this.lastSentAt + interval - Date.now();
          if (wait > 0) {
            await new Promise((resolve) => setTimeout(resolve, wait));
            // A newer position may have arrived while waiting.
            while (this.queue[0]?.op === "move") operation = this.queue.shift()!;
          }
        }
        await this.send(operation);
        this.lastSentAt = Date.now();
      }
    } catch (error) {
      this.queue = [];
      this.options.onError(error);
    } finally {
      this.draining = false;
    }
  }
}
