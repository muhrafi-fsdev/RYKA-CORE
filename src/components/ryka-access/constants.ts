import type { AccessSettings } from "./types";

export const DEFAULT_SETTINGS: AccessSettings = {
  autoSpeak: false,
  confirmGesture: true,
  saveHistory: true,
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  speechRate: 1,
  speechVolume: 1,
  voiceUri: "",
  language: "id-ID",
  soundThreshold: 62,
  inputMode: "touch",
  scanningIntervalMs: 1400,
  dwellMs: 1200,
  privateSession: false,
  autoDeleteMinutes: 0,
  captionScale: 1,
};
