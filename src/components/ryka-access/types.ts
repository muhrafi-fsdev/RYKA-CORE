import type { GestureKey } from "@/lib/gestureEngine";
import type { AccessInputMode, CommunicationEntry } from "@/lib/accessibility";

export type AccessTab = "communicate" | "caption" | "personal" | "partner" | "gestures" | "settings";
export type MessageSource = CommunicationEntry["source"];

export type GestureEvent = {
  id: number;
  gesture: GestureKey;
  score: number;
};

export type RykaAccessProps = {
  open: boolean;
  cameraOn: boolean;
  latestGesture: GestureEvent | null;
  onClose: () => void;
  onToggleCamera: () => void;
};

export type AccessSettings = {
  autoSpeak: boolean;
  confirmGesture: boolean;
  saveHistory: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  speechRate: number;
  speechVolume: number;
  voiceUri: string;
  language: string;
  soundThreshold: number;
  inputMode: AccessInputMode;
  scanningIntervalMs: number;
  dwellMs: number;
  privateSession: boolean;
  autoDeleteMinutes: number;
  captionScale: number;
};

export type CaptionLine = {
  id: number;
  text: string;
  time: string;
  speaker: string;
  confidence: number;
};

export type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence: number;
};

export type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

export type SpeechRecognitionResultListLike = {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
};

export type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};

export type SpeechRecognitionErrorEventLike = Event & {
  readonly error: string;
};

export type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
