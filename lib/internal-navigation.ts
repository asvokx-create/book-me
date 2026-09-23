export const INTERNAL_HISTORY_KEY = "bubsbookings-internal-history-v1";
const HISTORY_LIMIT = 30;

export function isSafeInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export function normalizeInternalHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && isSafeInternalPath(item)).slice(-HISTORY_LIMIT);
}

export function appendInternalPath(history: string[], currentPath: string, reset = false) {
  const next = reset ? [] : normalizeInternalHistory(history);
  if (!isSafeInternalPath(currentPath)) return next;
  if (next.at(-1) !== currentPath) next.push(currentPath);
  return next.slice(-HISTORY_LIMIT);
}

export function rewindInternalHistory(history: string[], currentPath: string) {
  const next = normalizeInternalHistory(history);
  if (next.at(-1) === currentPath) next.pop();
  const previous = next.at(-1);
  return { history: next, previous: previous && previous !== currentPath ? previous : null };
}

export function readInternalHistory() {
  if (typeof window === "undefined") return [];
  try {
    return normalizeInternalHistory(JSON.parse(window.sessionStorage.getItem(INTERNAL_HISTORY_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeInternalHistory(history: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(INTERNAL_HISTORY_KEY, JSON.stringify(normalizeInternalHistory(history)));
  } catch {
    // Navigation still works through contextual fallbacks when storage is unavailable.
  }
}
