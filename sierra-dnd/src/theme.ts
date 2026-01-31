export type ThemeMode = "dark" | "light";

export function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyAccent(accentColor: string) {
  document.documentElement.style.setProperty("--accent", accentColor);
}

export function loadLocalPrefs(): { theme?: ThemeMode; accentColor?: string } {
  try {
    const raw = localStorage.getItem("sierra_prefs");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveLocalPrefs(prefs: { theme: ThemeMode; accentColor: string }) {
  localStorage.setItem("sierra_prefs", JSON.stringify(prefs));
}
