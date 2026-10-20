'use client';

import { useTheme, type Theme } from '@/lib/theme';
import { IconMonitor, IconMoon, IconSun } from './icons';

const order: Theme[] = ['system', 'light', 'dark'];
const labels: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') return <IconSun />;
  if (theme === 'dark') return <IconMoon />;
  return <IconMonitor />;
}

/** Cycles System -> Light -> Dark. Use `compact` for an icon-only button. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = order[(order.indexOf(theme) + 1) % order.length];

  return (
    <button
      type="button"
      className={compact ? 'theme-toggle compact' : 'board-link theme-toggle'}
      title={`Theme: ${labels[theme]} (switch to ${labels[next]})`}
      aria-label={`Theme: ${labels[theme]}. Switch to ${labels[next]}`}
      onClick={() => setTheme(next)}
    >
      {compact ? (
        <ThemeIcon theme={theme} />
      ) : (
        <>
          <span>
            <ThemeIcon theme={theme} />
          </span>
          <b>Theme: {labels[theme]}</b>
        </>
      )}
    </button>
  );
}
