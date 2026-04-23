const ENHANCE_KEY = "powershot:enhance-screenshots";

export function loadEnhancePreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ENHANCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveEnhancePreference(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENHANCE_KEY, String(value));
  } catch {
    // ignore quota errors
  }
}
