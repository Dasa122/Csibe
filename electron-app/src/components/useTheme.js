import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'mindent-vagy-semmit-theme';

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (e) { /* ignore */ }
  return 'dark';
}

/**
 * useTheme — shared light/dark theme management.
 * Sets `data-theme` on <html> so the CSS `[data-theme="light"]` overrides apply,
 * and persists the choice in localStorage. Works in both the main window and
 * the separate dev-screen window.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* ignore */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme };
}
