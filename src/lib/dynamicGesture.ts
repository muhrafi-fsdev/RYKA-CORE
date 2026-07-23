import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { DynamicGestureKey } from "@/lib/gestureEngine";

type Point = { x: number; y: number; at: number };
type Track = { points: Point[]; cooldownUntil: number };

export type DynamicGestureEvent = {
  gesture: DynamicGestureKey;
  hand: string;
  speed: number;
  distance: number;
};

export class DynamicGestureDetector {
  private tracks = new Map<string, Track>();

  update(
    landmarks: NormalizedLandmark[][],
    labels: string[],
    now: number,
  ): DynamicGestureEvent[] {
    const results: DynamicGestureEvent[] = [];
    const seen = new Set<string>();

    landmarks.forEach((hand, index) => {
      const label = labels[index] || `HAND-${index}`;
      seen.add(label);
      const palm = hand[9] ?? hand[0];
      const point = { x: 1 - palm.x, y: palm.y, at: now };
      const track = this.tracks.get(label) ?? { points: [], cooldownUntil: 0 };
      track.points.push(point);
      track.points = track.points.filter((item) => now - item.at <= 480);
      this.tracks.set(label, track);

      if (now < track.cooldownUntil || track.points.length < 5) return;

      const first = track.points[0];
      const last = track.points[track.points.length - 1];
      const dt = Math.max(0.001, (last.at - first.at) / 1000);
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const distance = Math.hypot(dx, dy);
      const speed = distance / dt;

      let gesture: DynamicGestureKey | null = null;
      if (absX >= 0.2 && absX > absY * 1.6 && speed >= 0.55) {
        gesture = dx > 0 ? "Swipe_Right" : "Swipe_Left";
      } else if (absY >= 0.18 && absY > absX * 1.6 && speed >= 0.5) {
        gesture = dy > 0 ? "Swipe_Down" : "Swipe_Up";
      }

      if (gesture) {
        results.push({ gesture, hand: label, speed, distance });
        track.cooldownUntil = now + 850;
        track.points = [last];
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
