export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "billy:theme";
export const THEME_COLORS = { light: '#f8f7f3', dark: '#100f0c' };

export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readThemePreference(): ThemePreference {
  if (typeof localStorage === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  if (typeof matchMedia === "undefined") return "light";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document.getElementById('spolio-theme-color')?.setAttribute('content', THEME_COLORS[resolved]);
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // storage unavailable (private mode) — theme still applies for the session
  }
}

// Inlined in <head> before paint so a stored/system dark preference never
// flashes light on load. Must stay dependency-free and in sync with the
// logic above.
// This meta belongs to the theme script, outside HeadContent's managed tags.
// Mutating a managed SSR meta before hydration makes the head manager insert
// its original light value again, leaving two competing theme-color tags.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var m=document.getElementById('spolio-theme-color');if(!m){m=document.createElement('meta');m.id='spolio-theme-color';m.name='theme-color';document.head.appendChild(m)}m.content=d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}'}catch(e){}})()`;
