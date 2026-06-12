import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type Accent = 'green' | 'blue' | 'violet' | 'orange' | 'cyan' | 'pink';

export const ACCENTS: Accent[] = ['green', 'blue', 'violet', 'orange', 'cyan', 'pink'];

interface ThemeConfig {
  theme: Theme;
  accent: Accent;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
}

const ThemeContext = createContext<ThemeConfig | null>(null);

const readTheme = (): Theme => (localStorage.getItem('athlion_theme') as Theme) ?? 'dark';
const readAccent = (): Accent => {
  const a = localStorage.getItem('athlion_accent') as Accent;
  return ACCENTS.includes(a) ? a : 'green';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [accent, setAccentState] = useState<Accent>(readAccent);

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem('athlion_theme', t); };
  const setAccent = (a: Accent) => { setAccentState(a); localStorage.setItem('athlion_accent', a); };

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.setAttribute('data-accent', accent);
    html.classList.toggle('theme-light', theme === 'light');
    // Couleur de la barre système (mobile)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F8F8FA' : '#0C0C10');
  }, [theme, accent]);

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme hors ThemeProvider');
  return ctx;
}
