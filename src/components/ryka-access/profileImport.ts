import type {
  AccessInputMode,
  AccessNeed,
  AccessRole,
  PersonalAccessProfile,
} from "@/lib/accessibility";
import type { GestureKey } from "@/lib/gestureEngine";
import type { AccessSettings } from "./types";
import {
  ACCESS_GESTURES,
  DEFAULT_GESTURE_PHRASES,
  normalizePhrase,
} from "@/lib/accessibility";

/** Gesture phrases from an imported profile; unknown gestures keep the default. */
export function sanitizeGesturePhrases(source: unknown): Record<GestureKey, string> {
  const gestureSource = source && typeof source === "object"
    ? source as Partial<Record<GestureKey, unknown>>
    : {};
  const nextGesturePhrases = { ...DEFAULT_GESTURE_PHRASES };
  for (const gesture of ACCESS_GESTURES) {
    const value = gestureSource[gesture];
    if (typeof value === "string") nextGesturePhrases[gesture] = normalizePhrase(value);
  }
  return nextGesturePhrases;
}

/** Imported favourites: strings only, normalised, empty ones dropped, capped at 12. */
export function sanitizeFavorites(source: Array<unknown>): Array<string> {
  return source
    .filter((item): item is string => typeof item === "string")
    .map(normalizePhrase)
    .filter(Boolean)
    .slice(0, 12);
}

/** Merges imported settings over the current ones, clamping every number and checking enums. */
export function sanitizeSettings(
  source: Record<string, unknown>,
  current: AccessSettings,
): AccessSettings {
  const allowedInputModes: Array<AccessInputMode> = ["touch", "keyboard", "switch", "dwell", "gesture"];
  return {
    ...current,
    autoSpeak: typeof source.autoSpeak === "boolean" ? source.autoSpeak : current.autoSpeak,
    confirmGesture: typeof source.confirmGesture === "boolean" ? source.confirmGesture : current.confirmGesture,
    saveHistory: typeof source.saveHistory === "boolean" ? source.saveHistory : current.saveHistory,
    largeText: typeof source.largeText === "boolean" ? source.largeText : current.largeText,
    highContrast: typeof source.highContrast === "boolean" ? source.highContrast : current.highContrast,
    reducedMotion: typeof source.reducedMotion === "boolean" ? source.reducedMotion : current.reducedMotion,
    privateSession: typeof source.privateSession === "boolean" ? source.privateSession : current.privateSession,
    speechRate: typeof source.speechRate === "number" ? Math.min(1.8, Math.max(0.5, source.speechRate)) : current.speechRate,
    speechVolume: typeof source.speechVolume === "number" ? Math.min(1, Math.max(0, source.speechVolume)) : current.speechVolume,
    voiceUri: typeof source.voiceUri === "string" ? source.voiceUri.slice(0, 300) : current.voiceUri,
    language: typeof source.language === "string" ? source.language.slice(0, 20) : current.language,
    soundThreshold: typeof source.soundThreshold === "number" ? Math.min(95, Math.max(25, source.soundThreshold)) : current.soundThreshold,
    inputMode: typeof source.inputMode === "string" && allowedInputModes.includes(source.inputMode as AccessInputMode)
      ? source.inputMode as AccessInputMode
      : current.inputMode,
    scanningIntervalMs: typeof source.scanningIntervalMs === "number"
      ? Math.min(3000, Math.max(700, source.scanningIntervalMs))
      : current.scanningIntervalMs,
    dwellMs: typeof source.dwellMs === "number"
      ? Math.min(3000, Math.max(500, source.dwellMs))
      : current.dwellMs,
    autoDeleteMinutes: typeof source.autoDeleteMinutes === "number" && [0, 5, 15, 60, 1440].includes(source.autoDeleteMinutes)
      ? source.autoDeleteMinutes
      : current.autoDeleteMinutes,
    captionScale: typeof source.captionScale === "number"
      ? Math.min(1.8, Math.max(0.8, source.captionScale))
      : current.captionScale,
  };
}

/** Merges an imported personal profile over the current one using fixed allow-lists. */
export function sanitizePersonalProfile(
  source: Record<string, unknown>,
  current: PersonalAccessProfile,
): PersonalAccessProfile {
  const allowedRoles: Array<AccessRole> = ["user", "caregiver", "professional"];
  const allowedNeeds: Array<AccessNeed> = ["speech", "hearing", "motor", "emergency", "low-vision"];
  const allowedInputs: Array<AccessInputMode> = ["touch", "keyboard", "switch", "dwell", "gesture"];
  const allowedHands: Array<PersonalAccessProfile["dominantHand"]> = ["right", "left", "either"];
  const allowedEnvironments: Array<PersonalAccessProfile["environment"]> = ["home", "school", "work", "healthcare", "mixed"];
  const allowedReading: Array<PersonalAccessProfile["readingSupport"]> = ["text", "text-symbol", "symbol"];
  const needs = Array.isArray(source.needs)
    ? source.needs.filter((item): item is AccessNeed => typeof item === "string" && allowedNeeds.includes(item as AccessNeed)).slice(0, allowedNeeds.length)
    : [];
  return {
    ...current,
    completed: true,
    displayName: typeof source.displayName === "string" ? source.displayName.trim().slice(0, 60) : current.displayName,
    role: typeof source.role === "string" && allowedRoles.includes(source.role as AccessRole) ? source.role as AccessRole : current.role,
    needs: needs.length ? needs : current.needs,
    inputMode: typeof source.inputMode === "string" && allowedInputs.includes(source.inputMode as AccessInputMode)
      ? source.inputMode as AccessInputMode
      : current.inputMode,
    dominantHand: typeof source.dominantHand === "string" && allowedHands.includes(source.dominantHand as PersonalAccessProfile["dominantHand"])
      ? source.dominantHand as PersonalAccessProfile["dominantHand"]
      : current.dominantHand,
    environment: typeof source.environment === "string" && allowedEnvironments.includes(source.environment as PersonalAccessProfile["environment"])
      ? source.environment as PersonalAccessProfile["environment"]
      : current.environment,
    readingSupport: typeof source.readingSupport === "string" && allowedReading.includes(source.readingSupport as PersonalAccessProfile["readingSupport"])
      ? source.readingSupport as PersonalAccessProfile["readingSupport"]
      : current.readingSupport,
  };
}
