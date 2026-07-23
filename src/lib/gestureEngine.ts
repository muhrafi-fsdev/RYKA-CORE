export type StaticGestureKey =
  | "Closed_Fist"
  | "Open_Palm"
  | "Pointing_Up"
  | "Thumb_Down"
  | "Thumb_Up"
  | "Victory"
  | "ILoveYou";

export type DynamicGestureKey =
  | "Swipe_Left"
  | "Swipe_Right"
  | "Swipe_Up"
  | "Swipe_Down";

export type GestureKey = StaticGestureKey | DynamicGestureKey;

export type GestureCandidate = {
  gesture: StaticGestureKey;
  score: number;
  hand: string;
};

export type StableGesture = GestureCandidate & {
  votes: number;
};

type HistoryEntry = GestureCandidate & { at: number };

export class GestureStabilizer {
  private history: HistoryEntry[] = [];
  private releaseGesture: StaticGestureKey | null = null;
  private releaseStartedAt = 0;

  constructor(
    private readonly windowMs = 420,
    private readonly minimumVotes = 4,
    private readonly releaseMs = 260,
  ) {}

  push(candidate: GestureCandidate | null, now: number): StableGesture | null {
    if (candidate) this.history.push({ ...candidate, at: now });
    this.history = this.history.filter((item) => now - item.at <= this.windowMs);

    const grouped = new Map<
      string,
      { gesture: StaticGestureKey; hand: string; votes: number; scoreTotal: number }
    >();

    for (const item of this.history) {
      const key = `${item.hand}:${item.gesture}`;
      const current = grouped.get(key) ?? {
        gesture: item.gesture,
        hand: item.hand,
        votes: 0,
        scoreTotal: 0,
      };
      current.votes += 1;
      current.scoreTotal += item.score;
      grouped.set(key, current);
    }

    const winner = [...grouped.values()]
      .filter((item) => item.votes >= this.minimumVotes)
      .sort((a, b) => {
        const aWeight = a.votes * (a.scoreTotal / a.votes);
        const bWeight = b.votes * (b.scoreTotal / b.votes);
        return bWeight - aWeight;
      })[0];

    const stable = winner
      ? {
          gesture: winner.gesture,
          hand: winner.hand,
          votes: winner.votes,
          score: winner.scoreTotal / winner.votes,
        }
      : null;

    if (this.releaseGesture) {
      if (!stable || stable.gesture !== this.releaseGesture) {
        if (this.releaseStartedAt === 0) this.releaseStartedAt = now;
        if (now - this.releaseStartedAt >= this.releaseMs) {
          this.releaseGesture = null;
          this.releaseStartedAt = 0;
        }
      } else {
        this.releaseStartedAt = 0;
      }
    }

    return stable;
  }

  requiresRelease(gesture: StaticGestureKey) {
    return this.releaseGesture === gesture;
  }

  isReleasePending() {
    return this.releaseGesture !== null;
  }

  markTriggered(gesture: StaticGestureKey) {
    this.releaseGesture = gesture;
    this.releaseStartedAt = 0;
    this.history = [];
  }

  reset() {
    this.history = [];
    this.releaseGesture = null;
    this.releaseStartedAt = 0;
  }
}
