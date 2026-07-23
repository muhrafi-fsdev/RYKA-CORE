export type OneEuroOptions = {
  frequency?: number;
  minCutoff?: number;
  beta?: number;
  derivativeCutoff?: number;
};

class LowPassFilter {
  private initialized = false;
  private previous = 0;

  filter(value: number, alpha: number) {
    if (!this.initialized) {
      this.initialized = true;
      this.previous = value;
      return value;
    }

    const filtered = alpha * value + (1 - alpha) * this.previous;
    this.previous = filtered;
    return filtered;
  }

  reset() {
    this.initialized = false;
    this.previous = 0;
  }
}

export class OneEuroFilter {
  private frequency: number;
  private minCutoff: number;
  private beta: number;
  private derivativeCutoff: number;
  private lastTimestamp: number | null = null;
  private lastRawValue: number | null = null;
  private readonly valueFilter = new LowPassFilter();
  private readonly derivativeFilter = new LowPassFilter();

  constructor(options: OneEuroOptions = {}) {
    this.frequency = options.frequency ?? 60;
    this.minCutoff = options.minCutoff ?? 1;
    this.beta = options.beta ?? 0.04;
    this.derivativeCutoff = options.derivativeCutoff ?? 1;
  }

  configure(options: OneEuroOptions) {
    if (options.frequency !== undefined) this.frequency = options.frequency;
    if (options.minCutoff !== undefined) this.minCutoff = options.minCutoff;
    if (options.beta !== undefined) this.beta = options.beta;
    if (options.derivativeCutoff !== undefined) {
      this.derivativeCutoff = options.derivativeCutoff;
    }
  }

  filter(value: number, timestampMs: number) {
    if (this.lastTimestamp !== null) {
      const elapsedSeconds = Math.max(1 / 240, (timestampMs - this.lastTimestamp) / 1000);
      this.frequency = 1 / elapsedSeconds;
    }

    const derivative =
      this.lastRawValue === null ? 0 : (value - this.lastRawValue) * this.frequency;
    const filteredDerivative = this.derivativeFilter.filter(
      derivative,
      this.alpha(this.derivativeCutoff),
    );
    const cutoff = this.minCutoff + this.beta * Math.abs(filteredDerivative);
    const filteredValue = this.valueFilter.filter(value, this.alpha(cutoff));

    this.lastTimestamp = timestampMs;
    this.lastRawValue = value;
    return filteredValue;
  }

  reset() {
    this.lastTimestamp = null;
    this.lastRawValue = null;
    this.valueFilter.reset();
    this.derivativeFilter.reset();
  }

  private alpha(cutoff: number) {
    const tau = 1 / (2 * Math.PI * Math.max(0.0001, cutoff));
    const te = 1 / Math.max(1, this.frequency);
    return 1 / (1 + tau / te);
  }
}
