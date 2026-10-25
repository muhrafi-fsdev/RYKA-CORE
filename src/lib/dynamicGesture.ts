import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { DynamicGestureKey } from "@/lib/gestureEngine";

type Point = { x: number; y: number; at: number };
type Track = { points: Array<Point>; cooldownUntil: number };

export type DynamicGestureEvent = {
  gesture: DynamicGestureKey;
  hand: string;
  speed: number;
  distance: number;
};

/** Thresholds a hand movement must reach (in frame widths / heights and per second) to count as a swipe. */
export type DynamicGestureConfig = {
  minHorizontalDistance: number;
  minVerticalDistance: number;
  minHorizontalSpeed: number;
  minVerticalSpeed: number;
};

export const DEFAULT_DYNAMIC_CONFIG: DynamicGestureConfig = {
  minHorizontalDistance: 0.2,
  minVerticalDistance: 0.18,
  minHorizontalSpeed: 0.55,
  minVerticalSpeed: 0.5,
};

const WINDOW_MS = 480;
const COOLDOWN_MS = 850;
const MIN_POINTS = 5;
/** The movement along the swipe axis must beat the cross axis by this factor. */
const AXIS_DOMINANCE = 1.6;

/** Palm centre in mirrored screen coordinates, so "right" means right on screen. */
function palmPoint(hand: Array<NormalizedLandmark>, at: number): Point {
  const palm = hand[9] ?? hand[0];
  return { x: 1 - palm.x, y: palm.y, at };
}

export function measureMotion(points: Array<Point>) {
  const first = points[0];
  const last = points[points.length - 1];
  const dt = Math.max(0.001, (last.at - first.at) / 1000);
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const distance = Math.hypot(dx, dy);
  return { dx, dy, absX: Math.abs(dx), absY: Math.abs(dy), distance, speed: distance / dt };
}

export class DynamicGestureDetector {
  private tracks = new Map<string, Track>();

  constructor(private config: DynamicGestureConfig = DEFAULT_DYNAMIC_CONFIG) {}

  configure(config: DynamicGestureConfig) {
    this.config = config;
  }

  update(
    landmarks: Array<Array<NormalizedLandmark>>,
    labels: Array<string>,
    now: number,
  ): Array<DynamicGestureEvent> {
    const results: Array<DynamicGestureEvent> = [];
    const seen = new Set<string>();

    landmarks.forEach((hand, index) => {
      const label = labels[index] || `HAND-${index}`;
      seen.add(label);
      const track = this.tracks.get(label) ?? { points: [], cooldownUntil: 0 };
      track.points.push(palmPoint(hand, now));
      track.points = track.points.filter((item) => now - item.at <= WINDOW_MS);
      this.tracks.set(label, track);

      if (now < track.cooldownUntil || track.points.length < MIN_POINTS) return;

      const { dx, dy, absX, absY, distance, speed } = measureMotion(track.points);
      const { config } = this;

      let gesture: DynamicGestureKey | null = null;
      if (
        absX >= config.minHorizontalDistance &&
        absX > absY * AXIS_DOMINANCE &&
        speed >= config.minHorizontalSpeed
      ) {
        gesture = dx > 0 ? "Swipe_Right" : "Swipe_Left";
      } else if (
        absY >= config.minVerticalDistance &&
        absY > absX * AXIS_DOMINANCE &&
        speed >= config.minVerticalSpeed
      ) {
        gesture = dy > 0 ? "Swipe_Down" : "Swipe_Up";
      }

      if (gesture) {
        results.push({ gesture, hand: label, speed, distance });
        track.cooldownUntil = now + COOLDOWN_MS;
        track.points = [track.points[track.points.length - 1]];
      }
    });

    for (const key of this.tracks.keys()) {
      if (!seen.has(key)) this.tracks.delete(key);
    }

    return results;
  }

  reset() {
    this.tracks.clear();
  }
}

export type SwipeSample = { axis: "x" | "y"; distance: number; speed: number };

/** Smallest movement along the asked axis that counts as an attempt at a swipe. */
const ATTEMPT_DISTANCE = 0.08;
/** Gap after a recorded swipe before the next one is accepted. */
const SAMPLE_COOLDOWN_MS = 700;

/**
 * Measures how far and how fast the user really swipes. It uses the same
 * window and geometry as the detector, so thresholds derived from its samples
 * are directly comparable. A sample is the peak of one swipe, reported once
 * the hand stops moving along the axis (or leaves the frame).
 */
export class SwipeRecorder {
  private points: Array<Point> = [];
  private best: SwipeSample | null = null;
  private cooldownUntil = 0;

  update(
    landmarks: Array<Array<NormalizedLandmark>>,
    axis: SwipeSample["axis"],
    now: number,
  ): SwipeSample | null {
    const hand = landmarks[0] as Array<NormalizedLandmark> | undefined;
    if (!hand) return this.finish(now);

    this.points.push(palmPoint(hand, now));
    this.points = this.points.filter((item) => now - item.at <= WINDOW_MS);
    if (now < this.cooldownUntil || this.points.length < MIN_POINTS) return null;

    const motion = measureMotion(this.points);
    const along = axis === "x" ? motion.absX : motion.absY;
    const across = axis === "x" ? motion.absY : motion.absX;

    if (along >= ATTEMPT_DISTANCE && along > across * AXIS_DOMINANCE) {
      this.best = {
        axis,
        distance: Math.max(this.best?.distance ?? 0, along),
        speed: Math.max(this.best?.speed ?? 0, motion.speed),
      };
      return null;
    }
    return this.finish(now);
  }

  reset() {
    this.points = [];
    this.best = null;
    this.cooldownUntil = 0;
  }

  private finish(now: number) {
    const sample = this.best;
    this.points = [];
    this.best = null;
    if (sample) this.cooldownUntil = now + SAMPLE_COOLDOWN_MS;
    return sample;
  }
}
