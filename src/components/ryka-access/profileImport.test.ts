import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./constants";
import {
  sanitizeFavorites,
  sanitizeGesturePhrases,
  sanitizePersonalProfile,
  sanitizeSettings,
} from "./profileImport";
import { DEFAULT_GESTURE_PHRASES, DEFAULT_PERSONAL_PROFILE } from "@/lib/accessibility";

describe("sanitizeGesturePhrases", () => {
  it("falls back to the defaults for anything that is not an object", () => {
    for (const bad of [null, undefined, "text", 12]) {
      expect(sanitizeGesturePhrases(bad)).toEqual(DEFAULT_GESTURE_PHRASES);
    }
  });

  it("applies string phrases, normalised, and ignores other types", () => {
    const result = sanitizeGesturePhrases({
      Thumb_Up: "  Saya   ingin minum.  ",
      Victory: 42,
      Open_Palm: { nested: true },
    });
    expect(result.Thumb_Up).toBe("Saya ingin minum.");
    expect(result.Victory).toBe(DEFAULT_GESTURE_PHRASES.Victory);
    expect(result.Open_Palm).toBe(DEFAULT_GESTURE_PHRASES.Open_Palm);
  });

  it("ignores gestures it does not know and never touches the shared defaults", () => {
    const before = { ...DEFAULT_GESTURE_PHRASES };
    const result = sanitizeGesturePhrases({ Not_A_Gesture: "x", Thumb_Up: "Ya." });
    expect(result).not.toHaveProperty("Not_A_Gesture");
    expect(DEFAULT_GESTURE_PHRASES).toEqual(before);
  });

  it("caps every phrase at the normalisation limit", () => {
    expect(sanitizeGesturePhrases({ Thumb_Up: "a".repeat(900) }).Thumb_Up).toHaveLength(500);
  });
});

describe("sanitizeFavorites", () => {
  it("keeps only non-empty normalised strings", () => {
    expect(sanitizeFavorites(["  Tolong   bantu. ", 5, null, "", "   ", "Ya."])).toEqual([
      "Tolong bantu.",
      "Ya.",
    ]);
  });

  it("keeps at most twelve entries, in order", () => {
    const many = Array.from({ length: 20 }, (_, index) => `Pesan ${index}`);
    const result = sanitizeFavorites(many);
    expect(result).toHaveLength(12);
    expect(result[0]).toBe("Pesan 0");
    expect(result[11]).toBe("Pesan 11");
  });
});

describe("sanitizeSettings", () => {
  const current = { ...DEFAULT_SETTINGS };

  it("returns the current settings untouched for an empty import", () => {
    expect(sanitizeSettings({}, current)).toEqual(current);
  });

  it("accepts valid booleans, numbers and enum values", () => {
    const result = sanitizeSettings(
      {
        autoSpeak: true,
        confirmGesture: false,
        largeText: true,
        speechRate: 1.5,
        speechVolume: 0.4,
        soundThreshold: 70,
        inputMode: "switch",
        scanningIntervalMs: 2000,
        dwellMs: 900,
        autoDeleteMinutes: 15,
        captionScale: 1.2,
        language: "en-US",
      },
      current,
    );
    expect(result).toMatchObject({
      autoSpeak: true,
      confirmGesture: false,
      largeText: true,
      speechRate: 1.5,
      speechVolume: 0.4,
      soundThreshold: 70,
      inputMode: "switch",
      scanningIntervalMs: 2000,
      dwellMs: 900,
      autoDeleteMinutes: 15,
      captionScale: 1.2,
      language: "en-US",
    });
  });

  it.each([
    ["speechRate", 0.5, 1.8],
    ["speechVolume", 0, 1],
    ["soundThreshold", 25, 95],
    ["scanningIntervalMs", 700, 3000],
    ["dwellMs", 500, 3000],
    ["captionScale", 0.8, 1.8],
  ] as const)("clamps %s between %d and %d", (key, min, max) => {
    expect(sanitizeSettings({ [key]: -1000 }, current)[key]).toBe(min);
    expect(sanitizeSettings({ [key]: 100000 }, current)[key]).toBe(max);
  });

  it("keeps the current value when the type is wrong", () => {
    const result = sanitizeSettings(
      { autoSpeak: "yes", speechRate: "fast", inputMode: 3, dwellMs: null },
      current,
    );
    expect(result.autoSpeak).toBe(current.autoSpeak);
    expect(result.speechRate).toBe(current.speechRate);
    expect(result.inputMode).toBe(current.inputMode);
    expect(result.dwellMs).toBe(current.dwellMs);
  });

  it("rejects input modes and delete intervals that are not on the allow-list", () => {
    const result = sanitizeSettings({ inputMode: "telepathy", autoDeleteMinutes: 7 }, current);
    expect(result.inputMode).toBe(current.inputMode);
    expect(result.autoDeleteMinutes).toBe(current.autoDeleteMinutes);
  });

  it("truncates long strings", () => {
    const result = sanitizeSettings({ voiceUri: "v".repeat(500), language: "l".repeat(50) }, current);
    expect(result.voiceUri).toHaveLength(300);
    expect(result.language).toHaveLength(20);
  });

  it("drops unknown keys, including prototype pollution attempts", () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "extra": 1, "autoSpeak": true}');
    const result = sanitizeSettings(hostile as Record<string, unknown>, current);
    expect(result).not.toHaveProperty("extra");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.autoSpeak).toBe(true);
  });

  it("does not mutate the settings it was given", () => {
    const snapshot = { ...current };
    sanitizeSettings({ autoSpeak: true }, current);
    expect(current).toEqual(snapshot);
  });
});

describe("sanitizePersonalProfile", () => {
  const current = { ...DEFAULT_PERSONAL_PROFILE, completed: false };

  it("marks the profile as completed even for an empty import", () => {
    expect(sanitizePersonalProfile({}, current).completed).toBe(true);
  });

  it("trims and caps the display name", () => {
    expect(sanitizePersonalProfile({ displayName: "  Rafi  " }, current).displayName).toBe("Rafi");
    expect(sanitizePersonalProfile({ displayName: "n".repeat(100) }, current).displayName).toHaveLength(60);
  });

  it("accepts values on the allow-lists", () => {
    const result = sanitizePersonalProfile(
      {
        role: "caregiver",
        inputMode: "dwell",
        dominantHand: "left",
        environment: "school",
        readingSupport: "symbol",
      },
      current,
    );
    expect(result).toMatchObject({
      role: "caregiver",
      inputMode: "dwell",
      dominantHand: "left",
      environment: "school",
      readingSupport: "symbol",
    });
  });

  it("falls back to the current value for anything off the allow-lists", () => {
    const result = sanitizePersonalProfile(
      { role: "admin", dominantHand: "both", environment: "moon", readingSupport: 1 },
      current,
    );
    expect(result.role).toBe(current.role);
    expect(result.dominantHand).toBe(current.dominantHand);
    expect(result.environment).toBe(current.environment);
    expect(result.readingSupport).toBe(current.readingSupport);
  });

  it("keeps only known needs and falls back when none are valid", () => {
    expect(
      sanitizePersonalProfile({ needs: ["speech", "hearing", "flying", 3] }, current).needs,
    ).toEqual(["speech", "hearing"]);
    expect(sanitizePersonalProfile({ needs: ["flying"] }, current).needs).toEqual(current.needs);
    expect(sanitizePersonalProfile({ needs: "speech" }, current).needs).toEqual(current.needs);
  });
});
