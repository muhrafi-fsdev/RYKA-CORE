import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { DEFAULT_SETTINGS } from "./constants";
import { readLocal, saveLocal } from "./storage";
import type { GestureKey } from "@/lib/gestureEngine";
import type { AccessInputMode, AccessNeed, AccessRole, CommunicationEntry, PersonalAccessProfile } from "@/lib/accessibility";
import type { AccessSettings, AccessTab, CaptionLine, MessageSource, RykaAccessProps, SpeechRecognitionLike } from "./types";
import {
  ACCESS_GESTURES,
  ACCESS_GESTURE_LABELS,
  ACCESS_INPUT_LABELS,
  ACCESS_NEED_LABELS,
  ACCESS_ROLE_LABELS,
  DEFAULT_GESTURE_PHRASES,
  DEFAULT_PERSONAL_PROFILE,
  PHRASE_CATEGORIES,
  appendPhrase,
  formatAccessTime,
  normalizePhrase,
} from "@/lib/accessibility";

export function useRykaAccess(props: RykaAccessProps) {
  const { open, latestGesture } = props;
  const [tab, setTab] = useState<AccessTab>("communicate");
  const [composer, setComposer] = useState("");
  const [category, setCategory] = useState(PHRASE_CATEGORIES[0].id);
  const [history, setHistory] = useState<Array<CommunicationEntry>>(() =>
    readLocal("ryka-access-history", []),
  );
  const [favorites, setFavorites] = useState<Array<string>>(() =>
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
  const [voices, setVoices] = useState<Array<SpeechSynthesisVoice>>([]);
  const [captionSupported, setCaptionSupported] = useState(false);
  const [captionActive, setCaptionActive] = useState(false);
  const [captionInterim, setCaptionInterim] = useState("");
  const [captions, setCaptions] = useState<Array<CaptionLine>>([]);
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
        const allowedInputModes: Array<AccessInputMode> = ["touch", "keyboard", "switch", "dwell", "gesture"];
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
        const allowedRoles: Array<AccessRole> = ["user", "caregiver", "professional"];
        const allowedNeeds: Array<AccessNeed> = ["speech", "hearing", "motor", "emergency", "low-vision"];
        const allowedInputs: Array<AccessInputMode> = ["touch", "keyboard", "switch", "dwell", "gesture"];
        const allowedHands: Array<PersonalAccessProfile["dominantHand"]> = ["right", "left", "either"];
        const allowedEnvironments: Array<PersonalAccessProfile["environment"]> = ["home", "school", "work", "healthcare", "mixed"];
        const allowedReading: Array<PersonalAccessProfile["readingSupport"]> = ["text", "text-symbol", "symbol"];
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

  return {
    ...props,
    activeCategory,
    addFavorite,
    cancelDwell,
    captionActive,
    captionInterim,
    captionSupported,
    captions,
    category,
    composer,
    dwellPhrase,
    emergencyOpen,
    exportAccessAssessment,
    exportCommunicationCard,
    exportProfile,
    exportTranscript,
    favorites,
    fileInputRef,
    gesturePhrases,
    handleGesturePhrase,
    history,
    importProfile,
    partnerDisplayOpen,
    partnerRotated,
    pendingGesture,
    personalProfile,
    printCommunicationCard,
    profileImportError,
    recordMessage,
    resetAccessData,
    scanIndex,
    selectActivePhrase,
    setCaptions,
    setCategory,
    setComposer,
    setEmergencyOpen,
    setGesturePhrases,
    setHistory,
    setPartnerDisplayOpen,
    setPartnerRotated,
    setPendingGesture,
    setPersonalProfile,
    setSettings,
    setSetupOpen,
    setSpeakerLabel,
    setTab,
    setVisualAlert,
    setWaitingMessage,
    settings,
    setupOpen,
    soundLevel,
    soundMonitorActive,
    speakText,
    speakerLabel,
    startCaptions,
    startDwell,
    startSoundMonitor,
    stopCaptions,
    stopSoundMonitor,
    tab,
    visualAlert,
    voices,
    waitingMessage,
  };
}

export type AccessController = ReturnType<typeof useRykaAccess>;
