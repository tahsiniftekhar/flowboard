'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { THEME_KEY } from './constants';

export type Theme = 'light' | 'dark' | 'system';

const THEME_CHANGE_EVENT = 'flowboard-theme-change';

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable: still apply for this page view
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return { theme, setTheme };
}

/** Keeps data-theme in sync with the OS preference and other tabs. */
export function ThemeSync() {
  const { theme } = useTheme();

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [theme]);

  return null;
}
