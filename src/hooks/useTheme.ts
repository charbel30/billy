import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  persistThemePreference,
  readThemePreference,
  type ThemePreference,
} from "~/lib/ui";

// Theme preference state: persists to localStorage, applies the .dark class,
// and tracks OS changes while on "system". The initial paint is handled by
// THEME_INIT_SCRIPT in the document head; this hook takes over after mount.
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    setPreferenceState(readThemePreference());
  }, []);

  useEffect(() => {
    if (preference !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    persistThemePreference(next);
    applyTheme(next);
  }, []);

  return { preference, setPreference };
}
