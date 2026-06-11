// Métadonnées sports + formatage des métriques (partagé dashboard/planning).

export const SPORTS: Record<string, { label: string; icon: string; accent: string }> = {
  run:   { label: 'Course',   icon: '🏃', accent: 'run' },
  bike:  { label: 'Vélo',     icon: '🚴', accent: 'bike' },
  swim:  { label: 'Natation', icon: '🏊', accent: 'swim' },
  hike:  { label: 'Rando',    icon: '🥾', accent: 'hike' },
  other: { label: 'Autre',    icon: '🏅', accent: 'other' },
};

export const sportMeta = (s: string) => SPORTS[s] ?? SPORTS.other;

export const fmtKm = (m: number) => (m / 1000).toLocaleString('fr', { maximumFractionDigits: 1 });
export const fmtElev = (m: number) => Math.round(m).toLocaleString('fr');

export function fmtH(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

/** Allure/vitesse selon le sport, à partir d'une vitesse en m/s. */
export function fmtPace(speed: number | null, sport: string) {
  if (!speed) return '—';
  if (sport === 'bike' || sport === 'hike') return `${(speed * 3.6).toFixed(1)} km/h`;
  const secPer = sport === 'swim' ? 100 / speed : 1000 / speed;
  const mm = Math.floor(secPer / 60);
  const ss = Math.round(secPer % 60);
  return `${mm}:${String(ss).padStart(2, '0')}${sport === 'swim' ? '/100m' : '/km'}`;
}

export const paceLabel = (sport: string) =>
  sport === 'bike' || sport === 'hike' ? 'Vitesse moy.' : sport === 'swim' ? 'Allure /100m' : 'Allure moy.';
