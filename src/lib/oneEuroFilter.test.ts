import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "./oneEuroFilter";

describe("OneEuroFilter", () => {
  it("keeps a constant signal stable", () => {
    const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.04 });
    const output = Array.from({ length: 20 }, (_, index) =>
      filter.filter(0.5, index * 16.67),
    );
    expect(output.at(-1)).toBeCloseTo(0.5, 6);
  });

  it("reduces high-frequency jitter", () => {
    const filter = new OneEuroFilter({ minCutoff: 0.6, beta: 0.02 });
    const input = [0.5, 0.58, 0.43, 0.57, 0.44, 0.55, 0.46, 0.53];
    const output = input.map((value, index) => filter.filter(value, index * 16.67));
    const inputRange = Math.max(...input) - Math.min(...input);
    const outputRange = Math.max(...output.slice(2)) - Math.min(...output.slice(2));
    expect(outputRange).toBeLessThan(inputRange);
  });

  it("can be reset", () => {
    const filter = new OneEuroFilter();
    filter.filter(0, 0);
    filter.filter(1, 16.67);
    filter.reset();
    expect(filter.filter(0.25, 100)).toBe(0.25);
  });
});
