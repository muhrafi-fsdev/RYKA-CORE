export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readCompatStorage<T>(
  newKey: string,
  legacyKey: string,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const newValue = readStorage<T>(newKey, fallback);
    if (localStorage.getItem(newKey) !== null) return newValue;
    return readStorage<T>(legacyKey, fallback);
  } catch {
    return fallback;
  }
}
