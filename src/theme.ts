import { useEffect, useState } from 'react';
export type ThemePreference = 'system' | 'light' | 'dark';
const key = 'open-timelog-theme';
const getPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(key);
    if (value === 'dark' || value === 'light') return value;
  } catch {}
  return 'system';
};
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(getPreference);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(query.matches);
    const stored = () => setPreference(getPreference());
    query.addEventListener('change', changed);
    window.addEventListener('storage', stored);
    changed();
    return () => {
      query.removeEventListener('change', changed);
      window.removeEventListener('storage', stored);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#172328' : '#f5f7f8');
  }, [resolved]);
  useEffect(() => {
    window.timelogDesktop?.setTheme(preference);
  }, [preference]);
  function choose(value: ThemePreference) {
    try {
      localStorage.setItem(key, value);
    } catch {}
    setPreference(value);
  }
  return { preference, resolved, choose };
}
