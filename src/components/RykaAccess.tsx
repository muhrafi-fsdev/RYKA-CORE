import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { GestureKey } from "@/lib/gestureEngine";
import {
  ACCESS_GESTURE_LABELS,
  ACCESS_GESTURES,
  DEFAULT_GESTURE_PHRASES,
  ACCESS_INPUT_LABELS,
  ACCESS_NEED_LABELS,
  ACCESS_ROLE_LABELS,
  BODY_REGIONS,
  CORE_VOCABULARY,
  DEFAULT_PERSONAL_PROFILE,
  PARTNER_GUIDE,
  PHRASE_CATEGORIES,
  appendPhrase,
  buildPainPhrase,
  formatAccessTime,
  normalizePhrase,
  removeLastWord,
  type AccessInputMode,
  type AccessNeed,
  type AccessRole,
  type CommunicationEntry,
  type PersonalAccessProfile,
} from "@/lib/accessibility";

type AccessTab = "communicate" | "caption" | "personal" | "partner" | "gestures" | "settings";
type MessageSource = CommunicationEntry["source"];

type GestureEvent = {
  id: number;
  gesture: GestureKey;
  score: number;
};

type RykaAccessProps = {
  open: boolean;
  cameraOn: boolean;
  latestGesture: GestureEvent | null;
  onClose: () => void;
  onToggleCamera: () => void;
};

type AccessSettings = {
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

type CaptionLine = {
  id: number;
  text: string;
  time: string;
  speaker: string;
  confidence: number;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  readonly error: string;
};

type SpeechRecognitionLike = EventTarget & {
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

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const DEFAULT_SETTINGS: AccessSettings = {
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

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private browsing or hardened contexts.
  }
}

export default function RykaAccess({
  open,
  cameraOn,
  latestGesture,
  onClose,
  onToggleCamera,
}: RykaAccessProps) {
  const [tab, setTab] = useState<AccessTab>("communicate");
  const [composer, setComposer] = useState("");
  const [category, setCategory] = useState(PHRASE_CATEGORIES[0].id);
  const [history, setHistory] = useState<CommunicationEntry[]>(() =>
    readLocal("ryka-access-history", []),
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    readLocal("ryka-access-favorites", [
      "Saya ingin minum.",
      "Tolong bantu saya.",
      "Tolong tuliskan untuk saya.",
    ]),
  );
  const [gesturePhrases, setGesturePhrases] = useState<Record<GestureKey, string>>(
    () => readLocal("ryka-access-gesture-phrases", DEFAULT_GESTURE_PHRASES),
  );
  const [settings, setSettings] = useState<AccessSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readLocal<Partial<AccessSettings>>("ryka-access-settings", {}),
  }));
  const [pendingGesture, setPendingGesture] = useState<{
    gesture: GestureKey;
    phrase: string;
    score: number;
  } | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [captionSupported, setCaptionSupported] = useState(false);
  const [captionActive, setCaptionActive] = useState(false);
  const [captionInterim, setCaptionInterim] = useState("");
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [soundMonitorActive, setSoundMonitorActive] = useState(false);
  const [soundLevel, setSoundLevel] = useState(0);
  const [visualAlert, setVisualAlert] = useState<string | null>(null);
  const [profileImportError, setProfileImportError] = useState<string | null>(null);
  const [personalProfile, setPersonalProfile] = useState<PersonalAccessProfile>(() => ({
    ...DEFAULT_PERSONAL_PROFILE,
    ...readLocal<Partial<PersonalAccessProfile>>("ryka-access-personal-profile", {}),
  }));
  const [setupOpen, setSetupOpen] = useState(() =>
    !readLocal("ryka-access-personal-profile", DEFAULT_PERSONAL_PROFILE).completed,
  );
  const [partnerDisplayOpen, setPartnerDisplayOpen] = useState(false);
  const [partnerRotated, setPartnerRotated] = useState(false);
  const [speakerLabel, setSpeakerLabel] = useState("Lawan bicara");
  const [scanIndex, setScanIndex] = useState(0);
  const [dwellPhrase, setDwellPhrase] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState(false);

  const messageIdRef = useRef(
    history.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
  );
  const captionIdRef = useRef(1);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const captionShouldRunRef = useRef(false);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRafRef = useRef(0);
  const lastSoundAlertRef = useRef(0);
  const lastGestureEventRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dwellTimerRef = useRef<number | null>(null);

  const activeCategory = useMemo(
    () => PHRASE_CATEGORIES.find((item) => item.id === category) ?? PHRASE_CATEGORIES[0],
    [category],
  );

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const refreshVoices = useCallback(() => {
    if (!speechSupported) return;
    const next = window.speechSynthesis.getVoices();
    setVoices(next);
  }, [speechSupported]);

  useEffect(() => {
    refreshVoices();
    if (!speechSupported) return;
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [refreshVoices, speechSupported]);

  useEffect(() => {
    setCaptionSupported(
      typeof window !== "undefined" &&
        Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
  }, []);

  useEffect(() => saveLocal("ryka-access-history", settings.saveHistory ? history : []), [history, settings.saveHistory]);
  useEffect(() => saveLocal("ryka-access-favorites", favorites), [favorites]);
  useEffect(() => saveLocal("ryka-access-gesture-phrases", gesturePhrases), [gesturePhrases]);
  useEffect(() => saveLocal("ryka-access-settings", settings), [settings]);
  useEffect(() => saveLocal("ryka-access-personal-profile", personalProfile), [personalProfile]);

  const speakText = useCallback(
    (rawText: string) => {
      const text = normalizePhrase(rawText);
      if (!text) {
        toast.error("TIDAK ADA TEKS UNTUK DIBACAKAN");
        return;
      }
      if (!speechSupported) {
        toast.error("TEXT-TO-SPEECH TIDAK TERSEDIA DI BROWSER INI");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.language;
      utterance.rate = settings.speechRate;
      utterance.volume = settings.speechVolume;
      const selectedVoice = voices.find((voice) => voice.voiceURI === settings.voiceUri);
      if (selectedVoice) utterance.voice = selectedVoice;
      window.speechSynthesis.speak(utterance);
    },
    [settings.language, settings.speechRate, settings.speechVolume, settings.voiceUri, speechSupported, voices],
  );

  const recordMessage = useCallback(
    (rawText: string, source: MessageSource, shouldSpeak: boolean) => {
      const text = normalizePhrase(rawText);
      if (!text) return;
      setComposer(text);
      if (settings.saveHistory && !settings.privateSession) {
        const next: CommunicationEntry = {
          id: messageIdRef.current++,
          text,
          source,
          timestamp: formatAccessTime(),
          createdAt: Date.now(),
        };
        setHistory((current) => [next, ...current].slice(0, 60));
      }
      if (shouldSpeak || settings.autoSpeak) speakText(text);
    },
    [settings.autoSpeak, settings.privateSession, settings.saveHistory, speakText],
  );

  const handleGesturePhrase = useCallback(
    (gesture: GestureKey, score: number) => {
      const phrase = normalizePhrase(gesturePhrases[gesture] ?? "");
      if (!phrase) {
        toast.error(`${ACCESS_GESTURE_LABELS[gesture]} BELUM MEMILIKI KALIMAT`);
        return;
      }
      if (settings.confirmGesture) {
        setPendingGesture({ gesture, phrase, score });
        return;
      }
      recordMessage(phrase, "gesture", settings.autoSpeak);
      toast.success(`GESTUR → TEKS // ${Math.round(score * 100)}%`);
    },
    [gesturePhrases, recordMessage, settings.autoSpeak, settings.confirmGesture],
  );

  useEffect(() => {
    if (!open || !latestGesture || latestGesture.id === lastGestureEventRef.current) return;
    lastGestureEventRef.current = latestGesture.id;
    handleGesturePhrase(latestGesture.gesture, latestGesture.score);
  }, [handleGesturePhrase, latestGesture, open]);

  const selectActivePhrase = useCallback(
    (phrase: string) => {
      recordMessage(
        phrase,
        activeCategory.id === "emergency" ? "emergency" : "phrase",
        settings.autoSpeak,
      );
    },
    [activeCategory.id, recordMessage, settings.autoSpeak],
  );

  const cancelDwell = useCallback(() => {
    if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = null;
    setDwellPhrase(null);
  }, []);

  const startDwell = useCallback(
    (phrase: string) => {
      if (settings.inputMode !== "dwell") return;
      cancelDwell();
      setDwellPhrase(phrase);
      dwellTimerRef.current = window.setTimeout(() => {
        selectActivePhrase(phrase);
        setDwellPhrase(null);
        dwellTimerRef.current = null;
      }, settings.dwellMs);
    },
    [cancelDwell, selectActivePhrase, settings.dwellMs, settings.inputMode],
  );

  useEffect(() => {
    setScanIndex(0);
    if (!open || tab !== "communicate" || settings.inputMode !== "switch") return;
    const timer = window.setInterval(() => {
      setScanIndex((current) => (current + 1) % Math.max(activeCategory.phrases.length, 1));
    }, settings.scanningIntervalMs);
    return () => window.clearInterval(timer);
  }, [activeCategory.phrases.length, open, settings.inputMode, settings.scanningIntervalMs, tab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (event.key === "Escape") {
        if (partnerDisplayOpen) setPartnerDisplayOpen(false);
        else if (emergencyOpen) setEmergencyOpen(false);
        return;
      }
      if (editing) return;
      if (event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        speakText(composer);
        return;
      }
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setTab("partner");
        return;
      }
      if (tab !== "communicate") return;
      if (settings.inputMode === "switch" && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        const phrase = activeCategory.phrases[scanIndex];
        if (phrase) selectActivePhrase(phrase);
      }
      if (settings.inputMode === "keyboard" && /^[1-9]$/.test(event.key)) {
        const phrase = activeCategory.phrases[Number(event.key) - 1];
        if (phrase) {
          event.preventDefault();
          selectActivePhrase(phrase);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeCategory.phrases,
    composer,
    emergencyOpen,
    open,
    partnerDisplayOpen,
    scanIndex,
    selectActivePhrase,
    settings.inputMode,
    speakText,
    tab,
  ]);

  useEffect(() => {
    if (settings.privateSession) setHistory([]);
  }, [settings.privateSession]);

  useEffect(() => {
    if (settings.autoDeleteMinutes <= 0) return;
    const cleanup = () => {
      const cutoff = Date.now() - settings.autoDeleteMinutes * 60_000;
      setHistory((current) => current.filter((item) => Boolean(item.createdAt && item.createdAt >= cutoff)));
    };
    cleanup();
    const timer = window.setInterval(cleanup, 30_000);
    return () => window.clearInterval(timer);
  }, [settings.autoDeleteMinutes]);

  const stopCaptions = useCallback(() => {
    captionShouldRunRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setCaptionActive(false);
    setCaptionInterim("");
  }, []);

  const startCaptions = useCallback(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("LIVE CAPTION TIDAK DIDUKUNG BROWSER INI");
      return;
    }
    stopCaptions();
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.language;
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = normalizePhrase(result[0]?.transcript ?? "");
        if (!text) continue;
        if (result.isFinal) {
          const line: CaptionLine = {
            id: captionIdRef.current++,
            text,
            time: formatAccessTime(),
            speaker: speakerLabel,
            confidence: Number.isFinite(result[0]?.confidence) ? result[0].confidence : 0,
          };
          setCaptions((current) => [line, ...current].slice(0, 30));
        } else {
          interim = appendPhrase(interim, text);
        }
      }
      setCaptionInterim(interim);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        toast.error(`LIVE CAPTION // ${event.error.toUpperCase()}`);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      captionShouldRunRef.current = false;
      setCaptionActive(false);
    };
    recognitionRef.current = recognition;
    captionShouldRunRef.current = true;
    setCaptionActive(true);
    try {
      recognition.start();
    } catch {
      captionShouldRunRef.current = false;
      setCaptionActive(false);
      toast.error("LIVE CAPTION GAGAL DIMULAI");
    }
  }, [settings.language, speakerLabel, stopCaptions]);

  const stopSoundMonitor = useCallback(() => {
    cancelAnimationFrame(audioRafRef.current);
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close();
    audioContextRef.current = null;
    setSoundMonitorActive(false);
    setSoundLevel(0);
  }, []);

  const startSoundMonitor = useCallback(async () => {
    stopSoundMonitor();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      audioStreamRef.current = stream;
      audioContextRef.current = context;
      setSoundMonitorActive(true);

      const readLevel = () => {
        analyser.getByteTimeDomainData(data);
        let total = 0;
        for (const sample of data) {
          const normalized = (sample - 128) / 128;
          total += normalized * normalized;
        }
        const rms = Math.sqrt(total / data.length);
        const level = Math.min(100, Math.round(rms * 260));
        setSoundLevel(level);
        const now = performance.now();
        if (level >= settings.soundThreshold && now - lastSoundAlertRef.current > 2800) {
          lastSoundAlertRef.current = now;
          setVisualAlert("SUARA KERAS TERDETEKSI");
          if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
          window.setTimeout(() => setVisualAlert(null), 2200);
        }
        audioRafRef.current = requestAnimationFrame(readLevel);
      };
      readLevel();
    } catch {
      toast.error("IZIN MIKROFON DITOLAK ATAU TIDAK TERSEDIA");
      stopSoundMonitor();
    }
  }, [settings.soundThreshold, stopSoundMonitor]);

  useEffect(() => {
    if (open) return;
    stopCaptions();
    stopSoundMonitor();
    cancelDwell();
    setEmergencyOpen(false);
    setPartnerDisplayOpen(false);
    setPendingGesture(null);
  }, [cancelDwell, open, stopCaptions, stopSoundMonitor]);

  useEffect(
    () => () => {
      stopCaptions();
      stopSoundMonitor();
      cancelDwell();
      if (speechSupported) window.speechSynthesis.cancel();
    },
    [cancelDwell, speechSupported, stopCaptions, stopSoundMonitor],
  );

  const addFavorite = useCallback((text: string) => {
    const normalized = normalizePhrase(text);
    if (!normalized) return;
    setFavorites((current) =>
      current.includes(normalized) ? current.filter((item) => item !== normalized) : [normalized, ...current].slice(0, 12),
    );
  }, []);

  const exportProfile = useCallback(() => {
    const data = {
      format: "ryka-access-profile",
      version: 2,
      gesturePhrases,
      favorites,
      settings,
      personalProfile,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `ryka-access-profile-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }, [favorites, gesturePhrases, personalProfile, settings]);

  const importProfile = useCallback(async (file: File) => {
    try {
      if (file.size > 256_000) throw new Error("Ukuran profil terlalu besar");
      const parsed = JSON.parse(await file.text()) as {
        format?: unknown;
        gesturePhrases?: unknown;
        favorites?: unknown;
        settings?: unknown;
        personalProfile?: unknown;
      };
      if (parsed.format !== "ryka-access-profile") throw new Error("Format profil tidak dikenali");

      const gestureSource = parsed.gesturePhrases && typeof parsed.gesturePhrases === "object"
        ? parsed.gesturePhrases as Partial<Record<GestureKey, unknown>>
        : {};
      const nextGesturePhrases = { ...DEFAULT_GESTURE_PHRASES };
      for (const gesture of ACCESS_GESTURES) {
        const value = gestureSource[gesture];
        if (typeof value === "string") nextGesturePhrases[gesture] = normalizePhrase(value);
      }
      setGesturePhrases(nextGesturePhrases);

      if (Array.isArray(parsed.favorites)) {
        setFavorites(
          parsed.favorites
            .filter((item): item is string => typeof item === "string")
            .map(normalizePhrase)
            .filter(Boolean)
            .slice(0, 12),
        );
      }

      if (parsed.settings && typeof parsed.settings === "object") {
        const source = parsed.settings as Record<string, unknown>;
        const allowedInputModes: AccessInputMode[] = ["touch", "keyboard", "switch", "dwell", "gesture"];
        setSettings((current) => ({
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
        }));
      }

      if (parsed.personalProfile && typeof parsed.personalProfile === "object") {
        const source = parsed.personalProfile as Record<string, unknown>;
        const allowedRoles: AccessRole[] = ["user", "caregiver", "professional"];
        const allowedNeeds: AccessNeed[] = ["speech", "hearing", "motor", "emergency", "low-vision"];
        const allowedInputs: AccessInputMode[] = ["touch", "keyboard", "switch", "dwell", "gesture"];
        const allowedHands: PersonalAccessProfile["dominantHand"][] = ["right", "left", "either"];
        const allowedEnvironments: PersonalAccessProfile["environment"][] = ["home", "school", "work", "healthcare", "mixed"];
        const allowedReading: PersonalAccessProfile["readingSupport"][] = ["text", "text-symbol", "symbol"];
        const needs = Array.isArray(source.needs)
          ? source.needs.filter((item): item is AccessNeed => typeof item === "string" && allowedNeeds.includes(item as AccessNeed)).slice(0, allowedNeeds.length)
          : [];
        setPersonalProfile((current) => ({
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
        }));
      }

      setProfileImportError(null);
      toast.success("PROFIL RYKA ACCESS BERHASIL DIIMPOR");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profil tidak valid";
      setProfileImportError(message);
      toast.error("GAGAL MENGIMPOR PROFIL");
    }
  }, []);

  const downloadText = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }, []);

  const exportTranscript = useCallback(() => {
    const text = captions
      .slice()
      .reverse()
      .map((line) => `[${line.time}] ${line.speaker}: ${line.text}`)
      .join("\n");
    if (!text) {
      toast.error("BELUM ADA TRANSKRIP UNTUK DIEKSPOR");
      return;
    }
    downloadText(`ryka-caption-${Date.now()}.txt`, text);
  }, [captions, downloadText]);

  const exportAccessAssessment = useCallback(() => {
    const lines = [
      "RYKA ACCESS 4.4 — CONFIGURATION SNAPSHOT",
      `Generated: ${new Date().toISOString()}`,
      `Display name: ${personalProfile.displayName || "Not provided"}`,
      `Role: ${ACCESS_ROLE_LABELS[personalProfile.role]}`,
      `Needs: ${personalProfile.needs.map((need) => ACCESS_NEED_LABELS[need]).join(", ")}`,
      `Input mode: ${ACCESS_INPUT_LABELS[settings.inputMode]}`,
      `Dominant hand: ${personalProfile.dominantHand}`,
      `Environment: ${personalProfile.environment}`,
      `Reading support: ${personalProfile.readingSupport}`,
      `Large text: ${settings.largeText}`,
      `High contrast: ${settings.highContrast}`,
      `Reduced motion: ${settings.reducedMotion}`,
      `Switch interval: ${settings.scanningIntervalMs} ms`,
      `Dwell time: ${settings.dwellMs} ms`,
      "",
      "This file is a configuration snapshot, not a clinical assessment or diagnosis.",
    ];
    downloadText(`ryka-access-configuration-${Date.now()}.txt`, lines.join("\n"));
  }, [downloadText, personalProfile, settings]);

  const exportCommunicationCard = useCallback(() => {
    const emergency = PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases ?? [];
    const lines = [
      "RYKA ACCESS — KARTU KOMUNIKASI",
      personalProfile.displayName ? `Nama: ${personalProfile.displayName}` : "Nama: ____________________",
      "",
      "Saya mungkin membutuhkan waktu untuk berkomunikasi.",
      "Silakan gunakan kalimat singkat, tulisan, atau pilihan YA/TIDAK.",
      "",
      "PESAN FAVORIT:",
      ...(favorites.length ? favorites : ["Ya.", "Tidak.", "Tolong ulangi."]).map((item) => `- ${item}`),
      "",
      "DARURAT:",
      ...emergency.map((item) => `- ${item}`),
    ];
    downloadText(`ryka-communication-card-${Date.now()}.txt`, lines.join("\n"));
  }, [downloadText, favorites, personalProfile.displayName]);

  const printCommunicationCard = useCallback(() => {
    const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character] ?? character);
    const popup = window.open("", "_blank");
    if (!popup) {
      toast.error("POP-UP DIBLOKIR. IZINKAN POP-UP UNTUK MENCETAK KARTU.");
      return;
    }
    popup.opener = null;
    const emergency = PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases ?? [];
    const favoriteMarkup = (favorites.length ? favorites : ["Ya.", "Tidak.", "Tolong ulangi."])
      .map((item) => `<li>${safe(item)}</li>`).join("");
    const emergencyMarkup = emergency.map((item) => `<li>${safe(item)}</li>`).join("");
    popup.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Kartu Komunikasi RYKA</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}h1{color:#0369a1}section{border:2px solid #0ea5e9;border-radius:16px;padding:18px;margin:16px 0}li{font-size:20px;margin:10px 0}.note{font-size:22px;font-weight:700;background:#e0f2fe;padding:18px;border-radius:14px}@media print{button{display:none}}</style></head><body><h1>RYKA ACCESS — KARTU KOMUNIKASI</h1><p><strong>Nama:</strong> ${safe(personalProfile.displayName || "____________________")}</p><p class="note">Saya mungkin membutuhkan waktu untuk berkomunikasi. Silakan gunakan kalimat singkat, tulisan, atau pertanyaan YA/TIDAK.</p><section><h2>Pesan favorit</h2><ul>${favoriteMarkup}</ul></section><section><h2>Darurat</h2><ul>${emergencyMarkup}</ul></section><button onclick="window.print()">Cetak / Simpan PDF</button></body></html>`);
    popup.document.close();
    popup.focus();
  }, [favorites, personalProfile.displayName]);

  const resetAccessData = useCallback(() => {
    setGesturePhrases(DEFAULT_GESTURE_PHRASES);
    setFavorites([]);
    setHistory([]);
    setCaptions([]);
    setComposer("");
    setSettings(DEFAULT_SETTINGS);
    setPersonalProfile(DEFAULT_PERSONAL_PROFILE);
    setSetupOpen(true);
    toast("DATA RYKA ACCESS DIKEMBALIKAN KE DEFAULT");
  }, []);

  if (!open) return null;

  const rootClasses = [
    "ryka-access",
    settings.largeText ? "ryka-access-large" : "",
    settings.highContrast ? "ryka-access-contrast" : "",
    settings.reducedMotion ? "ryka-access-reduced-motion" : "",
    visualAlert ? "ryka-access-alerting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} role="dialog" aria-modal="true" aria-label="RYKA Access communication suite">
      <header className="ryka-access-header">
        <div>
          <strong>RYKA ACCESS 4.4</strong>
          <span>PERSONAL ACCESS & PARTNER COMMUNICATION // TANPA NUSAMIND AI</span>
        </div>
        <div className="ryka-access-header-actions">
          <button type="button" className="ryka-access-role-chip" onClick={() => setTab("personal")}>
            {ACCESS_ROLE_LABELS[personalProfile.role]}
          </button>
          <button type="button" onClick={() => setSetupOpen(true)}>SETUP</button>
          <button type="button" className="ryka-access-emergency-button" onClick={() => setEmergencyOpen(true)}>
            🆘 DARURAT
          </button>
          <button type="button" onClick={onClose} aria-label="Tutup RYKA Access">×</button>
        </div>
      </header>

      <nav className="ryka-access-tabs" aria-label="Menu RYKA Access">
        {([
          ["communicate", "💬 KOMUNIKASI"],
          ["caption", "CC CAPTION"],
          ["personal", "👤 PERSONAL ACCESS"],
          ["partner", "↔ PARTNER DISPLAY"],
          ["gestures", "✋ PROFIL GESTUR"],
          ["settings", "⚙ SETTINGS"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </nav>

      {setupOpen && (
        <div className="ryka-access-setup-backdrop" role="dialog" aria-modal="true" aria-label="Personal Needs Setup">
          <section className="ryka-access-setup-card">
            <div className="ryka-access-card-heading">
              <div>
                <small>PERSONAL NEEDS SETUP</small>
                <h2>ATUR RYKA SESUAI KEBUTUHAN PENGGUNA</h2>
                <p>Pengaturan dapat diubah kapan saja. Pilih lebih dari satu kebutuhan bila diperlukan.</p>
              </div>
              {personalProfile.completed && (
                <button type="button" onClick={() => setSetupOpen(false)} aria-label="Tutup setup">×</button>
              )}
            </div>

            <div className="ryka-access-setup-grid">
              <label className="ryka-access-field-row">
                <span>NAMA TAMPILAN</span>
                <input
                  type="text"
                  value={personalProfile.displayName}
                  maxLength={60}
                  placeholder="Nama pengguna (opsional)"
                  onChange={(event) => setPersonalProfile((current) => ({ ...current, displayName: event.target.value }))}
                />
              </label>

              <div className="ryka-access-setup-section">
                <strong>KEBUTUHAN UTAMA</strong>
                <div className="ryka-access-choice-grid">
                  {(Object.entries(ACCESS_NEED_LABELS) as [AccessNeed, string][]).map(([need, label]) => {
                    const active = personalProfile.needs.includes(need);
                    return (
                      <button
                        key={need}
                        type="button"
                        className={active ? "active" : ""}
                        aria-pressed={active}
                        onClick={() => setPersonalProfile((current) => ({
                          ...current,
                          needs: active
                            ? current.needs.filter((item) => item !== need)
                            : [...current.needs, need],
                        }))}
                      >
                        {active ? "✓ " : ""}{label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ryka-access-setup-section">
                <strong>METODE INPUT UTAMA</strong>
                <div className="ryka-access-choice-grid">
                  {(Object.entries(ACCESS_INPUT_LABELS) as [AccessInputMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={personalProfile.inputMode === mode ? "active" : ""}
                      onClick={() => {
                        setPersonalProfile((current) => ({ ...current, inputMode: mode }));
                        setSettings((current) => ({ ...current, inputMode: mode }));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="ryka-access-field-row">
                <span>MODE PENGGUNA</span>
                <select
                  value={personalProfile.role}
                  onChange={(event) => setPersonalProfile((current) => ({ ...current, role: event.target.value as AccessRole }))}
                >
                  {(Object.entries(ACCESS_ROLE_LABELS) as [AccessRole, string][]).map(([role, label]) => (
                    <option key={role} value={role}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="ryka-access-field-row">
                <span>DUKUNGAN BACA</span>
                <select
                  value={personalProfile.readingSupport}
                  onChange={(event) => setPersonalProfile((current) => ({
                    ...current,
                    readingSupport: event.target.value as PersonalAccessProfile["readingSupport"],
                  }))}
                >
                  <option value="text">Teks utama</option>
                  <option value="text-symbol">Teks + simbol</option>
                  <option value="symbol">Simbol dominan</option>
                </select>
              </label>

              <label className="ryka-access-field-row">
                <span>TANGAN DOMINAN</span>
                <select
                  value={personalProfile.dominantHand}
                  onChange={(event) => setPersonalProfile((current) => ({
                    ...current,
                    dominantHand: event.target.value as PersonalAccessProfile["dominantHand"],
                  }))}
                >
                  <option value="either">Keduanya / tidak dibatasi</option>
                  <option value="right">Kanan</option>
                  <option value="left">Kiri</option>
                </select>
              </label>

              <label className="ryka-access-field-row">
                <span>LINGKUNGAN UTAMA</span>
                <select
                  value={personalProfile.environment}
                  onChange={(event) => setPersonalProfile((current) => ({
                    ...current,
                    environment: event.target.value as PersonalAccessProfile["environment"],
                  }))}
                >
                  <option value="mixed">Beragam</option>
                  <option value="home">Rumah</option>
                  <option value="school">Sekolah</option>
                  <option value="work">Pekerjaan</option>
                  <option value="healthcare">Fasilitas kesehatan</option>
                </select>
              </label>
            </div>

            <div className="ryka-access-profile-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const inputMode = personalProfile.inputMode;
                  const needs = personalProfile.needs.length ? personalProfile.needs : ["speech" as AccessNeed];
                  setPersonalProfile((current) => ({ ...current, needs, completed: true }));
                  setSettings((current) => ({
                    ...current,
                    inputMode,
                    largeText: current.largeText || needs.includes("low-vision"),
                  }));
                  setSetupOpen(false);
                  toast.success("PERSONAL ACCESS PROFILE TERSIMPAN");
                }}
              >
                SIMPAN & MULAI
              </button>
              <button type="button" onClick={() => {
                setPersonalProfile((current) => ({ ...current, completed: true }));
                setSetupOpen(false);
              }}>GUNAKAN DEFAULT</button>
            </div>
          </section>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importProfile(file);
          event.target.value = "";
        }}
      />

      {visualAlert && (
        <div className="ryka-access-visual-alert" role="alert">
          <strong>⚠ {visualAlert}</strong>
          <span>Level mikrofon: {soundLevel}%</span>
        </div>
      )}

      <div className="ryka-access-body">
        {tab === "communicate" && (
          <div className="ryka-access-communication-layout">
            <section className="ryka-access-card ryka-access-composer-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>PESAN SAYA</h2>
                  <p>Ketik, pilih kalimat, atau gunakan gestur yang sudah dipetakan.</p>
                </div>
                <button
                  type="button"
                  className={`ryka-access-camera-chip ${cameraOn ? "online" : ""}`}
                  onClick={onToggleCamera}
                >
                  CAMERA {cameraOn ? "ON" : "OFF"}
                </button>
              </div>
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value.slice(0, 500))}
                placeholder="Tulis pesan di sini…"
                aria-label="Pesan komunikasi"
              />

              <div className="ryka-access-composer-tools">
                <div className="ryka-access-card-heading">
                  <div>
                    <h2>CORE VOCABULARY</h2>
                    <p>Posisi kata dibuat tetap untuk membantu pembelajaran motorik dan penyusunan kalimat.</p>
                  </div>
                  <span className="ryka-access-mode-chip">{ACCESS_INPUT_LABELS[settings.inputMode]}</span>
                </div>
                <div className="ryka-access-core-grid" aria-label="Kosakata inti">
                  {CORE_VOCABULARY.map((word) => (
                    <button
                      key={word.id}
                      type="button"
                      onClick={() => setComposer((current) => appendPhrase(current, word.label))}
                      title={`Tambahkan ${word.label}`}
                    >
                      <span aria-hidden="true">{word.icon}</span>
                      <strong>{word.label}</strong>
                    </button>
                  ))}
                </div>
                <div className="ryka-access-composer-edit-actions">
                  <button type="button" onClick={() => setComposer((current) => removeLastWord(current))}>⌫ HAPUS KATA</button>
                  <button type="button" onClick={() => setComposer((current) => appendPhrase(current, "."))}>. TITIK</button>
                  <button type="button" onClick={() => setComposer((current) => appendPhrase(current, "?"))}>? TANYA</button>
                  <button type="button" onClick={() => setWaitingMessage((current) => !current)}>⏳ MOHON TUNGGU</button>
                </div>
              </div>

              <div className="ryka-access-message-actions">
                <button type="button" className="primary" onClick={() => recordMessage(composer, "typed", true)}>
                  🔊 BICARAKAN
                </button>
                <button type="button" onClick={() => recordMessage(composer, "typed", false)}>
                  ✓ SIMPAN PESAN
                </button>
                <button type="button" onClick={() => addFavorite(composer)}>
                  ★ FAVORIT
                </button>
                <button type="button" onClick={() => setPartnerDisplayOpen(true)}>↔ PARTNER DISPLAY</button>
                <button type="button" onClick={() => setComposer("")}>HAPUS</button>
              </div>
              <div className="ryka-access-local-note">
                <span>🔒</span>
                <div>
                  <strong>{settings.privateSession ? "PRIVATE SESSION" : "LOCAL-FIRST"}</strong>
                  <p>{settings.privateSession ? "Riwayat tidak disimpan selama sesi privat aktif." : "Pesan, profil gestur, dan riwayat disimpan lokal pada browser ini."}</p>
                </div>
              </div>
              <div className="ryka-access-input-guide" role="status">
                <strong>METODE INPUT: {ACCESS_INPUT_LABELS[settings.inputMode]}</strong>
                <span>
                  {settings.inputMode === "keyboard" && "Tekan angka 1–9 untuk memilih kalimat pada kategori aktif."}
                  {settings.inputMode === "switch" && "RYKA menyorot pilihan otomatis. Tekan Space atau Enter untuk memilih."}
                  {settings.inputMode === "dwell" && `Arahkan pointer selama ${settings.dwellMs} ms untuk memilih.`}
                  {settings.inputMode === "gesture" && "Gunakan gestur yang telah dipetakan pada Profil Gestur."}
                  {settings.inputMode === "touch" && "Gunakan layar sentuh atau mouse seperti biasa."}
                </span>
              </div>
            </section>

            <section className="ryka-access-card ryka-access-phrases-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>QUICK PHRASE BOARD</h2>
                  <p>Tombol besar untuk kebutuhan komunikasi sehari-hari.</p>
                </div>
              </div>
              <div className="ryka-access-category-tabs">
                {PHRASE_CATEGORIES.map((item) => (
                  <button key={item.id} type="button" className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
              <div className="ryka-access-phrase-grid">
                {activeCategory.phrases.map((phrase, index) => {
                  const classes = [
                    favorites.includes(phrase) ? "favorite" : "",
                    settings.inputMode === "switch" && scanIndex === index ? "scan-active" : "",
                    dwellPhrase === phrase ? "dwell-active" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <button
                      key={phrase}
                      type="button"
                      className={classes}
                      onClick={() => selectActivePhrase(phrase)}
                      onPointerEnter={() => startDwell(phrase)}
                      onPointerLeave={cancelDwell}
                      onFocus={() => startDwell(phrase)}
                      onBlur={cancelDwell}
                      aria-current={settings.inputMode === "switch" && scanIndex === index ? "true" : undefined}
                    >
                      <span>{phrase}</span>
                      <small>
                        {settings.inputMode === "keyboard" && index < 9 ? `${index + 1} // ` : ""}
                        {favorites.includes(phrase) ? "★ Favorit" : "Pilih pesan"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="ryka-access-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>FAVORIT</h2>
                  <p>Pesan yang paling sering digunakan.</p>
                </div>
              </div>
              <div className="ryka-access-favorite-list">
                {favorites.length === 0 ? (
                  <p className="ryka-access-empty">Belum ada pesan favorit.</p>
                ) : (
                  favorites.map((phrase) => (
                    <div key={phrase}>
                      <button type="button" onClick={() => recordMessage(phrase, "phrase", settings.autoSpeak)}>{phrase}</button>
                      <button type="button" aria-label={`Hapus ${phrase} dari favorit`} onClick={() => addFavorite(phrase)}>×</button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="ryka-access-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>RIWAYAT KOMUNIKASI</h2>
                  <p>Maksimum 40 pesan dan dapat dimatikan melalui Privacy Settings.</p>
                </div>
                <button type="button" onClick={() => setHistory([])}>BERSIHKAN</button>
              </div>
              <div className="ryka-access-history-list">
                {history.length === 0 ? (
                  <p className="ryka-access-empty">Belum ada pesan yang digunakan.</p>
                ) : (
                  history.map((item) => (
                    <button key={item.id} type="button" onClick={() => setComposer(item.text)}>
                      <small>{item.timestamp} // {item.source.toUpperCase()}</small>
                      <span>{item.text}</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {tab === "caption" && (
          <div className="ryka-access-caption-layout">
            <section className="ryka-access-card ryka-access-caption-stage">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>LIVE CAPTION</h2>
                  <p>Suara lawan bicara diubah menjadi teks menggunakan kemampuan browser.</p>
                </div>
                <span className={`ryka-access-caption-chip ${captionActive ? "online" : ""}`}>
                  {captionActive ? "MENDENGARKAN" : "BERHENTI"}
                </span>
              </div>
              <div className="ryka-access-caption-toolbar">
                <label>
                  <span>LABEL PEMBICARA</span>
                  <input
                    type="text"
                    value={speakerLabel}
                    maxLength={40}
                    onChange={(event) => setSpeakerLabel(event.target.value)}
                  />
                </label>
                <label>
                  <span>UKURAN CAPTION</span>
                  <input
                    type="range"
                    min={0.8}
                    max={1.8}
                    step={0.1}
                    value={settings.captionScale}
                    onChange={(event) => setSettings((current) => ({ ...current, captionScale: Number(event.target.value) }))}
                  />
                </label>
              </div>
              {!captionSupported ? (
                <div className="ryka-access-unavailable">
                  <strong>LIVE CAPTION TIDAK TERSEDIA</strong>
                  <p>Gunakan Google Chrome atau Microsoft Edge terbaru. Dukungan tetap bergantung pada browser dan sistem operasi.</p>
                </div>
              ) : (
                <div className="ryka-access-caption-controls">
                  <button type="button" className="primary" disabled={captionActive} onClick={startCaptions}>🎙 MULAI CAPTION</button>
                  <button type="button" disabled={!captionActive} onClick={stopCaptions}>STOP</button>
                  <button type="button" onClick={exportTranscript}>EXPORT TXT</button>
                  <button type="button" onClick={() => setPartnerDisplayOpen(true)}>PARTNER DISPLAY</button>
                  <button type="button" onClick={() => setCaptions([])}>HAPUS TRANSKRIP</button>
                </div>
              )}
              <div className="ryka-access-caption-display" aria-live="polite" style={{ "--caption-scale": settings.captionScale } as React.CSSProperties}>
                {captionInterim && <div className="interim">{captionInterim}</div>}
                {captions.length === 0 && !captionInterim ? (
                  <p>Kalimat lawan bicara akan muncul besar di sini.</p>
                ) : (
                  captions.map((line) => (
                    <div key={line.id}>
                      <small>{line.time} // {line.speaker} {line.confidence > 0 ? `// ${Math.round(line.confidence * 100)}%` : ""}</small>
                      <strong>{line.text}</strong>
                      <button type="button" onClick={() => setComposer(line.text)}>GUNAKAN SEBAGAI PESAN</button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="ryka-access-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>VISUAL SOUND ALERT</h2>
                  <p>Mendeteksi tingkat suara keras. Fitur ini belum mengklasifikasikan jenis suara.</p>
                </div>
              </div>
              <div className="ryka-access-sound-meter">
                <div><span style={{ width: `${soundLevel}%` }} /></div>
                <strong>{soundLevel}%</strong>
              </div>
              <div className="ryka-access-caption-controls">
                <button type="button" className="primary" disabled={soundMonitorActive} onClick={() => void startSoundMonitor()}>AKTIFKAN MONITOR</button>
                <button type="button" disabled={!soundMonitorActive} onClick={stopSoundMonitor}>STOP</button>
                <button type="button" onClick={() => {
                  setVisualAlert("TES PERINGATAN VISUAL");
                  window.setTimeout(() => setVisualAlert(null), 1800);
                }}>TES ALERT</button>
              </div>
              <label className="ryka-access-range-row">
                <span>AMBANG SUARA</span>
                <strong>{settings.soundThreshold}%</strong>
                <input type="range" min={25} max={95} value={settings.soundThreshold} onChange={(event) => setSettings((current) => ({ ...current, soundThreshold: Number(event.target.value) }))} />
              </label>
              <p className="ryka-access-privacy-warning">Mikrofon hanya dipakai saat fitur diaktifkan. Audio tidak disimpan oleh RYKA CORE.</p>
            </section>

            <section className="ryka-access-card ryka-access-conversation-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>CONVERSATION MODE</h2>
                  <p>Caption lawan bicara di atas, jawaban pengguna di bawah.</p>
                </div>
              </div>
              <div className="ryka-access-conversation-split">
                <div>
                  <small>LAWAN BICARA</small>
                  <strong>{captionInterim || captions[0]?.text || "Menunggu suara…"}</strong>
                </div>
                <div>
                  <small>PENGGUNA RYKA</small>
                  <strong>{composer || "Pilih atau tulis pesan…"}</strong>
                  <div className="ryka-access-conversation-actions">
                    <button type="button" onClick={() => speakText(composer)}>🔊 BICARAKAN JAWABAN</button>
                    <button type="button" onClick={() => setPartnerDisplayOpen(true)}>LAYAR LAWAN BICARA</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === "personal" && (
          <div className="ryka-access-settings-layout">
            <section className="ryka-access-card ryka-access-personal-summary">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>PERSONAL ACCESS PROFILE</h2>
                  <p>Profil ini mengatur cara RYKA menampilkan kontrol dan menerima input.</p>
                </div>
                <button type="button" onClick={() => setSetupOpen(true)}>ULANGI SETUP</button>
              </div>
              <div className="ryka-access-profile-summary-grid">
                <div><small>NAMA</small><strong>{personalProfile.displayName || "Belum diisi"}</strong></div>
                <div><small>MODE</small><strong>{ACCESS_ROLE_LABELS[personalProfile.role]}</strong></div>
                <div><small>INPUT</small><strong>{ACCESS_INPUT_LABELS[settings.inputMode]}</strong></div>
                <div><small>LINGKUNGAN</small><strong>{personalProfile.environment.toUpperCase()}</strong></div>
              </div>
              <div className="ryka-access-needs-list">
                {personalProfile.needs.map((need) => <span key={need}>{ACCESS_NEED_LABELS[need]}</span>)}
              </div>
            </section>

            <section className="ryka-access-card">
              <h2>METODE AKSES ALTERNATIF</h2>
              <p>Pilih cara yang paling nyaman. Touch dan mouse tetap selalu tersedia.</p>
              <div className="ryka-access-choice-grid ryka-access-choice-grid-vertical">
                {(Object.entries(ACCESS_INPUT_LABELS) as [AccessInputMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={settings.inputMode === mode ? "active" : ""}
                    onClick={() => {
                      setSettings((current) => ({ ...current, inputMode: mode }));
                      setPersonalProfile((current) => ({ ...current, inputMode: mode }));
                    }}
                  >
                    <strong>{label}</strong>
                    <small>
                      {mode === "touch" && "Tekan tombol memakai sentuhan atau mouse."}
                      {mode === "keyboard" && "Gunakan angka 1–9 dan shortcut keyboard."}
                      {mode === "switch" && "Sorotan berpindah otomatis; pilih dengan Space/Enter."}
                      {mode === "dwell" && "Arahkan pointer dan tahan tanpa klik."}
                      {mode === "gesture" && "Gunakan pemetaan Gesture-to-Text."}
                    </small>
                  </button>
                ))}
              </div>
            </section>

            <section className="ryka-access-card">
              <h2>ROLE MODE</h2>
              <p>Mode tidak mengambil hak pengguna. Caregiver dan Professional hanya menampilkan alat konfigurasi tambahan.</p>
              <div className="ryka-access-choice-grid ryka-access-choice-grid-vertical">
                {(Object.entries(ACCESS_ROLE_LABELS) as [AccessRole, string][]).map(([role, label]) => (
                  <button
                    key={role}
                    type="button"
                    className={personalProfile.role === role ? "active" : ""}
                    onClick={() => setPersonalProfile((current) => ({ ...current, role }))}
                  >
                    <strong>{label}</strong>
                    <small>
                      {role === "user" && "Komunikasi sehari-hari dengan kontrol sederhana."}
                      {role === "caregiver" && "Mengatur phrase board, backup, dan bantuan setup."}
                      {role === "professional" && "Kalibrasi metode akses dan dokumentasi evaluasi."}
                    </small>
                  </button>
                ))}
              </div>
            </section>

            {personalProfile.role !== "user" && (
              <section className="ryka-access-card">
                <h2>{personalProfile.role === "caregiver" ? "CAREGIVER TOOLS" : "PROFESSIONAL SETUP TOOLS"}</h2>
                <p>Alat ini membantu setup dan backup. Kontrol serta data komunikasi tetap berada pada pengguna utama.</p>
                <div className="ryka-access-profile-actions">
                  <button type="button" onClick={exportAccessAssessment}>EXPORT CONFIGURATION SNAPSHOT</button>
                  <button type="button" onClick={exportProfile}>BACKUP PROFIL JSON</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>IMPORT PROFIL</button>
                </div>
                <div className="ryka-access-local-note">
                  <span>⚖️</span>
                  <div>
                    <strong>USER CONTROL FIRST</strong>
                    <p>Mode pendamping tidak memberikan akses otomatis ke percakapan privat dan bukan pengganti evaluasi profesional.</p>
                  </div>
                </div>
              </section>
            )}

            <section className="ryka-access-card">
              <h2>LOW-TECH FALLBACK</h2>
              <p>Siapkan kartu komunikasi yang tetap dapat digunakan saat kamera, mikrofon, atau perangkat bermasalah.</p>
              <div className="ryka-access-profile-actions">
                <button type="button" onClick={printCommunicationCard}>CETAK / SIMPAN PDF</button>
                <button type="button" onClick={exportCommunicationCard}>DOWNLOAD TXT</button>
                <button type="button" onClick={exportProfile}>BACKUP PROFIL JSON</button>
              </div>
              <div className="ryka-access-local-note">
                <span>🪪</span>
                <div>
                  <strong>KARTU KOMUNIKASI</strong>
                  <p>Berisi cara berkomunikasi, pesan favorit, dan kalimat darurat. Periksa isinya sebelum dicetak.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === "partner" && (
          <div className="ryka-access-partner-layout">
            <section className="ryka-access-card ryka-access-partner-preview-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>PARTNER DISPLAY</h2>
                  <p>Tampilan besar untuk lawan bicara. Pesan dapat diputar 180° saat perangkat diletakkan di meja.</p>
                </div>
                <button type="button" className="primary" onClick={() => setPartnerDisplayOpen(true)}>BUKA LAYAR PENUH</button>
              </div>
              <div className={`ryka-access-partner-stage ${partnerRotated ? "rotated" : ""}`}>
                <small>{waitingMessage ? "MOHON TUNGGU — SEDANG MENYUSUN JAWABAN" : "PESAN DARI PENGGUNA RYKA"}</small>
                <strong>{composer || "Pilih atau tulis pesan pada tab Komunikasi."}</strong>
                {captions[0]?.text && <p><b>{captions[0].speaker}:</b> {captions[0].text}</p>}
              </div>
              <div className="ryka-access-message-actions">
                <button type="button" onClick={() => setPartnerRotated((current) => !current)}>↻ PUTAR 180°</button>
                <button type="button" onClick={() => speakText(composer)}>🔊 BICARAKAN</button>
                <button type="button" onClick={() => setWaitingMessage((current) => !current)}>⏳ STATUS MENUNGGU</button>
                <button type="button" onClick={() => setTab("communicate")}>EDIT PESAN</button>
              </div>
            </section>

            <section className="ryka-access-card">
              <h2>PANDUAN MITRA KOMUNIKASI</h2>
              <ul className="ryka-access-partner-guide">
                {PARTNER_GUIDE.map((item) => <li key={item}>✓ {item}</li>)}
              </ul>
              <button type="button" onClick={() => setComposer("Mohon beri saya waktu untuk menjawab.")}>GUNAKAN PESAN “MOHON TUNGGU”</button>
            </section>

            <section className="ryka-access-card">
              <h2>PERTANYAAN CEPAT</h2>
              <p>Lawan bicara dapat memakai pertanyaan sederhana yang dapat dijawab cepat.</p>
              <div className="ryka-access-yes-no-grid">
                <button type="button" className="yes" onClick={() => recordMessage("Ya.", "phrase", settings.autoSpeak)}>✓ YA</button>
                <button type="button" className="no" onClick={() => recordMessage("Tidak.", "phrase", settings.autoSpeak)}>✕ TIDAK</button>
                <button type="button" onClick={() => recordMessage("Tolong ulangi.", "phrase", settings.autoSpeak)}>ULANGI</button>
                <button type="button" onClick={() => recordMessage("Saya belum mengerti.", "phrase", settings.autoSpeak)}>BELUM MENGERTI</button>
              </div>
            </section>
          </div>
        )}

        {tab === "gestures" && (
          <div className="ryka-access-gesture-layout">
            <section className="ryka-access-card">
              <div className="ryka-access-card-heading">
                <div>
                  <h2>GESTURE-TO-TEXT PROFILE</h2>
                  <p>Setiap gestur dapat dipetakan ke kalimat pribadi. Gunakan kamera dan tunggu stabilisasi sebelum pesan muncul.</p>
                </div>
                <button type="button" className={cameraOn ? "online" : ""} onClick={onToggleCamera}>
                  CAMERA {cameraOn ? "ON" : "OFF"}
                </button>
              </div>
              <div className="ryka-access-gesture-map">
                {ACCESS_GESTURES.map((gesture) => (
                  <label key={gesture}>
                    <span>
                      <strong>{ACCESS_GESTURE_LABELS[gesture]}</strong>
                      <small>{gesture.replaceAll("_", " ")}</small>
                    </span>
                    <input
                      value={gesturePhrases[gesture]}
                      maxLength={300}
                      onChange={(event) => setGesturePhrases((current) => ({ ...current, [gesture]: event.target.value }))}
                    />
                    <button type="button" onClick={() => handleGesturePhrase(gesture, 1)}>TES</button>
                  </label>
                ))}
              </div>
              <div className="ryka-access-profile-actions">
                <button type="button" onClick={exportProfile}>EXPORT PROFIL</button>
                <button type="button" onClick={() => fileInputRef.current?.click()}>IMPORT PROFIL</button>
                <button type="button" onClick={() => setGesturePhrases(DEFAULT_GESTURE_PHRASES)}>RESET GESTUR</button>
              </div>
              {profileImportError && <p className="ryka-access-error">{profileImportError}</p>}
            </section>

            <section className="ryka-access-card ryka-access-safety-card">
              <h2>ANTI-SALAH DETEKSI</h2>
              <ul>
                <li>Weighted multi-frame stabilization tetap aktif.</li>
                <li>Confidence, hold duration, cooldown, dan release-required tetap digunakan.</li>
                <li>Konfirmasi pesan gestur dapat diwajibkan sebelum dibacakan.</li>
                <li>Semua gestur personal disimpan lokal.</li>
              </ul>
            </section>
          </div>
        )}

        {tab === "settings" && (
          <div className="ryka-access-settings-layout">
            <section className="ryka-access-card">
              <h2>TAMPILAN AKSESIBEL</h2>
              <label className="ryka-access-toggle-row">
                <span><strong>TEKS BESAR</strong><small>Memperbesar teks dan kontrol utama.</small></span>
                <input type="checkbox" checked={settings.largeText} onChange={(event) => setSettings((current) => ({ ...current, largeText: event.target.checked }))} />
              </label>
              <label className="ryka-access-toggle-row">
                <span><strong>KONTRAS TINGGI</strong><small>Menguatkan batas, teks, dan tombol.</small></span>
                <input type="checkbox" checked={settings.highContrast} onChange={(event) => setSettings((current) => ({ ...current, highContrast: event.target.checked }))} />
              </label>
              <label className="ryka-access-toggle-row">
                <span><strong>KURANGI ANIMASI</strong><small>Menonaktifkan transisi dan efek yang tidak perlu.</small></span>
                <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings((current) => ({ ...current, reducedMotion: event.target.checked }))} />
              </label>
            </section>

            <section className="ryka-access-card">
              <h2>KONTROL KOMUNIKASI</h2>
              <label className="ryka-access-toggle-row">
                <span><strong>KONFIRMASI GESTUR</strong><small>Tampilkan preview sebelum gestur dibacakan.</small></span>
                <input type="checkbox" checked={settings.confirmGesture} onChange={(event) => setSettings((current) => ({ ...current, confirmGesture: event.target.checked }))} />
              </label>
              <label className="ryka-access-toggle-row">
                <span><strong>AUTO SPEAK</strong><small>Kalimat pilihan langsung dibacakan.</small></span>
                <input type="checkbox" checked={settings.autoSpeak} onChange={(event) => setSettings((current) => ({ ...current, autoSpeak: event.target.checked }))} />
              </label>
              <label className="ryka-access-toggle-row">
                <span><strong>SIMPAN RIWAYAT LOKAL</strong><small>Matikan untuk mode tanpa riwayat.</small></span>
                <input type="checkbox" checked={settings.saveHistory} onChange={(event) => {
                  const enabled = event.target.checked;
                  setSettings((current) => ({ ...current, saveHistory: enabled }));
                  if (!enabled) setHistory([]);
                }} />
              </label>
            </section>

            <section className="ryka-access-card">
              <h2>ALTERNATIVE INPUT SETTINGS</h2>
              <label className="ryka-access-field-row">
                <span>METODE INPUT</span>
                <select
                  value={settings.inputMode}
                  onChange={(event) => {
                    const inputMode = event.target.value as AccessInputMode;
                    setSettings((current) => ({ ...current, inputMode }));
                    setPersonalProfile((current) => ({ ...current, inputMode }));
                  }}
                >
                  {(Object.entries(ACCESS_INPUT_LABELS) as [AccessInputMode, string][]).map(([mode, label]) => (
                    <option key={mode} value={mode}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="ryka-access-range-row">
                <span>SCAN INTERVAL</span>
                <strong>{settings.scanningIntervalMs} ms</strong>
                <input type="range" min={700} max={3000} step={100} value={settings.scanningIntervalMs} onChange={(event) => setSettings((current) => ({ ...current, scanningIntervalMs: Number(event.target.value) }))} />
              </label>
              <label className="ryka-access-range-row">
                <span>DWELL TIME</span>
                <strong>{settings.dwellMs} ms</strong>
                <input type="range" min={500} max={3000} step={100} value={settings.dwellMs} onChange={(event) => setSettings((current) => ({ ...current, dwellMs: Number(event.target.value) }))} />
              </label>
              <p>Shortcut: Alt+S untuk membacakan pesan, Alt+P membuka Partner Display, Escape menutup layar penuh.</p>
            </section>

            <section className="ryka-access-card">
              <h2>TEXT-TO-SPEECH</h2>
              <label className="ryka-access-field-row">
                <span>BAHASA</span>
                <select value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value }))}>
                  <option value="id-ID">Bahasa Indonesia</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </select>
              </label>
              <label className="ryka-access-field-row">
                <span>SUARA</span>
                <select value={settings.voiceUri} onChange={(event) => setSettings((current) => ({ ...current, voiceUri: event.target.value }))}>
                  <option value="">Default sistem</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} — {voice.lang}</option>
                  ))}
                </select>
              </label>
              <label className="ryka-access-range-row">
                <span>KECEPATAN</span>
                <strong>{settings.speechRate.toFixed(1)}×</strong>
                <input type="range" min={0.5} max={1.8} step={0.1} value={settings.speechRate} onChange={(event) => setSettings((current) => ({ ...current, speechRate: Number(event.target.value) }))} />
              </label>
              <label className="ryka-access-range-row">
                <span>VOLUME</span>
                <strong>{Math.round(settings.speechVolume * 100)}%</strong>
                <input type="range" min={0} max={1} step={0.05} value={settings.speechVolume} onChange={(event) => setSettings((current) => ({ ...current, speechVolume: Number(event.target.value) }))} />
              </label>
              <button type="button" onClick={() => speakText("Ini adalah suara RYKA Access.")}>TES SUARA</button>
            </section>

            <section className="ryka-access-card ryka-access-danger-zone">
              <h2>PRIVACY CENTER</h2>
              <p>Kamera dan mikrofon selalu memiliki indikator. RYKA CORE tidak menyimpan rekaman video atau audio secara default.</p>
              <label className="ryka-access-toggle-row">
                <span><strong>PRIVATE SESSION</strong><small>Tidak menyimpan pesan baru dan langsung menghapus riwayat aktif.</small></span>
                <input type="checkbox" checked={settings.privateSession} onChange={(event) => setSettings((current) => ({ ...current, privateSession: event.target.checked }))} />
              </label>
              <label className="ryka-access-field-row">
                <span>AUTO-DELETE RIWAYAT</span>
                <select value={settings.autoDeleteMinutes} onChange={(event) => setSettings((current) => ({ ...current, autoDeleteMinutes: Number(event.target.value) }))}>
                  <option value={0}>Tidak otomatis</option>
                  <option value={5}>5 menit</option>
                  <option value={15}>15 menit</option>
                  <option value={60}>1 jam</option>
                  <option value={1440}>24 jam</option>
                </select>
              </label>
              <div className="ryka-access-profile-actions">
                <button type="button" onClick={() => setHistory([])}>HAPUS RIWAYAT</button>
                <button type="button" onClick={() => setCaptions([])}>HAPUS CAPTION</button>
                <button type="button" onClick={resetAccessData}>HAPUS & RESET SEMUA DATA ACCESS</button>
              </div>
            </section>
          </div>
        )}
      </div>

      {pendingGesture && (
        <div className="ryka-access-confirm-backdrop" role="alertdialog" aria-modal="true" aria-label="Konfirmasi pesan gestur">
          <div className="ryka-access-confirm-card">
            <small>GESTUR TERDETEKSI // {Math.round(pendingGesture.score * 100)}%</small>
            <h2>{ACCESS_GESTURE_LABELS[pendingGesture.gesture]}</h2>
            <p>{pendingGesture.phrase}</p>
            <div>
              <button type="button" className="primary" onClick={() => {
                recordMessage(pendingGesture.phrase, "gesture", true);
                setPendingGesture(null);
              }}>🔊 KONFIRMASI & BICARAKAN</button>
              <button type="button" onClick={() => {
                setComposer(pendingGesture.phrase);
                setPendingGesture(null);
                setTab("communicate");
              }}>EDIT</button>
              <button type="button" onClick={() => setPendingGesture(null)}>BATAL</button>
            </div>
          </div>
        </div>
      )}

      {partnerDisplayOpen && (
        <div className={`ryka-access-partner-fullscreen ${partnerRotated ? "rotated" : ""}`} role="dialog" aria-modal="true" aria-label="Partner Display layar penuh">
          <header>
            <div>
              <strong>{waitingMessage ? "MOHON TUNGGU" : "PESAN PENGGUNA RYKA"}</strong>
              <span>{waitingMessage ? "Sedang menyusun jawaban…" : "Tampilan untuk lawan bicara"}</span>
            </div>
            <div>
              <button type="button" onClick={() => setPartnerRotated((current) => !current)}>↻ 180°</button>
              <button type="button" onClick={() => setPartnerDisplayOpen(false)} aria-label="Tutup Partner Display">×</button>
            </div>
          </header>
          <main>
            <strong>{composer || "Mohon beri saya waktu untuk menjawab."}</strong>
            {captions[0]?.text && (
              <div>
                <small>{captions[0].speaker}</small>
                <p>{captions[0].text}</p>
              </div>
            )}
          </main>
          <footer>
            <button type="button" onClick={() => speakText(composer)}>🔊 BICARAKAN</button>
            <button type="button" onClick={() => recordMessage("Ya.", "phrase", settings.autoSpeak)}>✓ YA</button>
            <button type="button" onClick={() => recordMessage("Tidak.", "phrase", settings.autoSpeak)}>✕ TIDAK</button>
            <button type="button" onClick={() => { setPartnerDisplayOpen(false); setTab("communicate"); }}>EDIT PESAN</button>
          </footer>
        </div>
      )}

      {emergencyOpen && (
        <div className="ryka-access-emergency-screen" role="alertdialog" aria-modal="true" aria-label="Komunikasi darurat">
          <header>
            <div>
              <strong>🆘 KOMUNIKASI DARURAT</strong>
              <span>Pilih pesan. RYKA akan menampilkan dan membacakannya.</span>
            </div>
            <button type="button" onClick={() => setEmergencyOpen(false)}>×</button>
          </header>
          <div className="ryka-access-emergency-grid">
            {PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases.map((phrase) => (
              <button key={phrase} type="button" onClick={() => {
                recordMessage(phrase, "emergency", true);
                setEmergencyOpen(false);
                setTab("communicate");
              }}>{phrase}</button>
            ))}
          </div>
          <section className="ryka-access-body-map">
            <strong>TUNJUKKAN BAGIAN YANG SAKIT</strong>
            <div>
              {BODY_REGIONS.map((region) => (
                <button key={region} type="button" onClick={() => {
                  const phrase = buildPainPhrase(region);
                  recordMessage(phrase, "emergency", true);
                  setEmergencyOpen(false);
                  setTab("communicate");
                }}>{region.toUpperCase()}</button>
              ))}
            </div>
          </section>
          <p>RYKA CORE adalah alat bantu komunikasi. Aplikasi tidak melakukan panggilan, diagnosis, atau mengirim lokasi secara otomatis.</p>
        </div>
      )}
    </div>
  );
}
