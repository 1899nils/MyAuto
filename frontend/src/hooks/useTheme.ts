import { useState, useEffect } from 'react';

export type Theme = 'system' | 'dark' | 'light';
const THEME_KEY = 'myauto_theme';

function applyTheme(t: Theme) {
  if (t === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
}

/** Call once at app startup (before React renders) to avoid flash */
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  if (saved && saved !== 'system') applyTheme(saved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) ?? 'system',
  );

  useEffect(() => { applyTheme(theme); }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
  }

  return { theme, setTheme };
}
