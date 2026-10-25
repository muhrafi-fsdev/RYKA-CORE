import { useEffect } from "react";
import type { MutableRefObject } from "react";

/**
 * Mirrors a state value into an optional ref (read by the camera loop, which
 * must not re-subscribe on every change) and persists it to localStorage.
 */
export function usePersistedSetting<T>(
  value: T,
  storageKey: string,
  mirror?: MutableRefObject<T>,
) {
  useEffect(() => {
    if (mirror) mirror.current = value;
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [value, storageKey, mirror]);
}
