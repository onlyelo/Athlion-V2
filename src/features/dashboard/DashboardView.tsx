import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LineChart, BarChart } from '../../components/Charts';
import { sportMeta, fmtKm, fmtElev, fmtH, fmtPace, paceLabel } from '../../lib/sport';
import type { DashboardData, StravaSummary, StravaStatus, SportStat, StravaActivity } from '../../types';

const normSport = (s: string) => {
  const t = (s || '').toLowerCase();
  if (t.includes('run')) return 'run';
  if (t.includes('ride') || t.includes('bike') || t.includes('cycl')) return 'bike';
  if (t.includes('swim')) return 'swim';
  if (t.includes('hike') || t.includes('walk')) return 'hike';
  return 'other';
};

const PERIODS = [
  { days: 7, label: '7j' },
  { days: 30, label: '30j' },
  { days: 90, label: '90j' },
  { days: 365, label: '1 an' },
];

interface Tile { key: string; label: string; value: string | number; unit?: string; sub?: string; accent: string; }

export function DashboardView() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [sport, setSport] = useState('all');
  const [syncing, setSyncing] = useState(false);

  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });
  const { data: status } = useQuery({ queryKey: ['strava-status'], queryFn: () => api.get<StravaStatus>('/strava/status') });
  const { data: summary } = useQuery({
    queryKey: ['strava-summary', days],
    queryFn: () => api.get<StravaSummary>(`/strava/summary?days=${days}`),
    enabled: !!status?.connected,
  });
  const { data: recent } = useQuery({
    queryKey: ['strava-activities', days],
    queryFn: () => api.get<{ activities: StravaActivity[] }>(`/strava/activities?days=${days}`),
    enabled: !!status?.connected,
  });

  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => { if (dash?.pinned) setPinned(dash.pinned); }, [dash?.pinned]);

  // ?strava=connected → on rafraîchit le statut
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('strava') === 'connected') {
      qc.invalidateQueries({ queryKey: ['strava-status'] });
      window.history.replaceState({}, '', '/');
    }
  }, [qc]);

  async function connectStrava() {
    const { url } = await api.get<{ url: string }>('/strava/connect');
    window.location.href = url;
  }
  async function syncStrava() {
    setSyncing(true);
    try {
      await api.post('/strava/sync');
      await qc.invalidateQueries({ queryKey: ['strava-summary'] });
      await qc.invalidateQueries({ queryKey: ['strava-status'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
    } finally { setSyncing(false); }
  }

  async function togglePin(key: string) {
    const next = pinned.includes(key) ? pinned.filter(k => k !== key) : [...pinned, key];
    setPinned(next);
    await api.put('/dashboard/layout', { pinned: next });
  }

  if (!dash) return <span className="label">Chargement de l'état…</span>;
  const { state, history } = dash;

  // ── Construction des tuiles ──────────────────────────────────
  const stateTiles: Tile[] = [
    { key: 'state:ctl', label: 'Fitness (CTL)', value: state.ctl, accent: 'run' },
    { key: 'state:atl', label: 'Fatigue (ATL)', value: state.atl, accent: 'bike' },
    { key: 'state:tsb', label: 'Forme (TSB)', value: state.tsb, accent: 'hike' },
    { key: 'state:sleepdebt', label: 'Dette sommeil', value: (state.sleep_debt_min / 60).toFixed(1), unit: 'h', accent: 'swim' },
  ];

  const totalsTiles: Tile[] = summary ? [
    { key: 'total:distance', label: 'Distance totale', value: fmtKm(summary.totals.distance), unit: 'km', accent: 'run', sub: `${summary.totals.sessions} séances` },
    { key: 'total:elevation', label: 'D+ cumulé', value: fmtElev(summary.totals.elevation), unit: 'm', accent: 'hike' },
    { key: 'total:time', label: 'Temps total', value: fmtH(summary.totals.time), accent: 'bike' },
    ...(summary.totals.avgHr ? [{ key: 'total:hr', label: 'FC moyenne', value: summary.totals.avgHr, unit: 'bpm', accent: 'other' } as Tile] : []),
  ] : [];

  const sportTiles = (s: SportStat): Tile[] => {
    const m = sportMeta(s.sport);
    return [
      { key: `${s.sport}:distance`, label: 'Distance', value: fmtKm(s.distance), unit: 'km', accent: m.accent, sub: `${s.sessions} séances` },
      { key: `${s.sport}:elevation`, label: 'D+', value: fmtElev(s.elevation), unit: 'm', accent: m.accent },
      { key: `${s.sport}:time`, label: 'Temps', value: fmtH(s.time), accent: m.accent },
      { key: `${s.sport}:pace`, label: paceLabel(s.sport), value: fmtPace(s.avgSpeed, s.sport), accent: m.accent },
      ...(s.avgHr ? [{ key: `${s.sport}:hr`, label: 'FC moy.', value: s.avgHr, unit: 'bpm', accent: m.accent } as Tile] : []),
    ];
  };

  // Index global pour résoudre les favoris
  const allTiles: Tile[] = [...stateTiles, ...totalsTiles, ...(summary?.bySport.flatMap(sportTiles) ?? [])];
  const tileMap = new Map(allTiles.map(t => [t.key, t]));
  const pinnedTiles = pinned.map(k => tileMap.get(k)).filter(Boolean) as Tile[];

  const sportsAvailable = summary?.bySport ?? [];
  const visibleTiles: Tile[] = sport === 'all'
    ? totalsTiles
    : sportTiles(sportsAvailable.find(s => s.sport === sport) ?? { sport, distance: 0, elevation: 0, time: 0, sessions: 0, avgHr: null, avgSpeed: null });

  const weekly = summary?.weekly ?? [];
  const ctlSeries = history.map(h => Number(h.ctl));
  const ctlLabels = history.map(h => h.date.slice(5));

  return (
    <div className="stack">
      {/* ── Forme du jour ───────────────────────────────── */}
      <div className="card-glass card-hero">
        <div className="section-label">Forme du jour</div>
        <div className="row between">
          <div>
            <div className="gauge text-plasma">{state.readiness}</div>
            <span className="body-sm">Readiness / 100</span>
          </div>
          <div className="stack" style={{ gap: 4, textAlign: 'right' }}>
            <span className="mono">TSB {state.tsb}</span>
            <span className="body-sm">{readinessLabel(state.readiness)}</span>
          </div>
        </div>
      </div>

      {/* ── Strava ──────────────────────────────────────── */}
      {!status?.connected ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>Données d'entraînement</div>
          <p className="body-sm" style={{ marginBottom: 12 }}>Connecte Strava pour alimenter ton tableau de bord avec tes activités réelles.</p>
          <button className="btn btn--glass" onClick={connectStrava}>⚡ Connecter Strava</button>
        </div>
      ) : (
        <div className="row between" style={{ padding: '0 4px' }}>
          <span className="body-sm">
            {status.cached} activités{status.last_sync ? ` · maj ${new Date(status.last_sync).toLocaleDateString('fr')}` : ''}
          </span>
          <button className="btn btn--sm btn--secondary" onClick={syncStrava} disabled={syncing}>
            {syncing ? <span className="spin" /> : '↻ Synchroniser'}
          </button>
        </div>
      )}

      {/* ── Favoris épinglés ────────────────────────────── */}
      {pinnedTiles.length > 0 && (
        <div>
          <div className="section-label">★ Favoris</div>
          <div className="grid grid-2">
            {pinnedTiles.map(t => <TileCard key={t.key} t={t} pinned onPin={togglePin} />)}
          </div>
        </div>
      )}

      {/* ── Filtres (visibles si Strava connecté) ───────── */}
      {status?.connected && (
        <>
          <div className="row between wrap" style={{ gap: 8 }}>
            <div className="segmented">
              {PERIODS.map(p => (
                <button key={p.days} className={`seg-btn${days === p.days ? ' seg-btn--active' : ''}`} onClick={() => setDays(p.days)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={`chip${sport === 'all' ? ' chip--active' : ''}`} onClick={() => setSport('all')}>Tous</button>
            {sportsAvailable.map(s => {
              const m = sportMeta(s.sport);
              return (
                <button key={s.sport} className={`chip${sport === s.sport ? ' chip--active' : ''}`} onClick={() => setSport(s.sport)}>
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>

          {/* ── Tuiles métriques ──────────────────────────── */}
          {visibleTiles.length > 0 ? (
            <div className="grid grid-2">
              {visibleTiles.map(t => (
                <TileCard key={t.key} t={t} pinned={pinned.includes(t.key)} onPin={togglePin} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <span className="body-sm">Aucune activité sur cette période. Lance une synchronisation.</span>
            </div>
          )}

          {/* ── Répartition par sport (vue Tous) ──────────── */}
          {sport === 'all' && sportsAvailable.length > 0 && (
            <div className="card">
              <div className="section-label">Par sport</div>
              <div className="stack" style={{ gap: 10 }}>
                {sportsAvailable.map(s => {
                  const m = sportMeta(s.sport);
                  return (
                    <div key={s.sport} className="row between" style={{ cursor: 'pointer' }} onClick={() => setSport(s.sport)}>
                      <span className="body-md">{m.icon} {m.label}</span>
                      <span className="mono">{fmtKm(s.distance)} km · {fmtElev(s.elevation)} D+ · {s.sessions}×</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Volume hebdomadaire ───────────────────────── */}
          {weekly.length > 1 && (
            <div className="card">
              <div className="section-label">Volume hebdomadaire</div>
              <BarChart
                data={weekly.map(w => ({ label: w.week.slice(5), value: Math.round(w.distance / 1000) }))}
                color="var(--plasma)"
                fmt={(v) => `${v} km`}
              />
            </div>
          )}

          {/* ── Dernières activités ───────────────────────── */}
          {recent && recent.activities.length > 0 && (
            <div className="card">
              <div className="section-label">Dernières activités</div>
              <div className="stack" style={{ gap: 8 }}>
                {recent.activities
                  .filter(a => sport === 'all' || normSport(a.sport_type || a.type || '') === sport)
                  .slice(0, 6)
                  .map(a => {
                    const sp = normSport(a.sport_type || a.type || '');
                    const m = sportMeta(sp);
                    return (
                      <div key={a.id} className="activity-item">
                        <div className={`activity-icon activity-icon--${m.accent === 'hike' ? 'nutrition' : m.accent === 'swim' ? 'swim' : m.accent === 'bike' ? 'bike' : 'run'}`}>{m.icon}</div>
                        <div className="activity-info">
                          <div className="activity-title">{a.name}</div>
                          <div className="activity-sub">
                            {new Date(a.start_date_local).toLocaleDateString('fr', { day: 'numeric', month: 'short' })}
                            {a.distance ? ` · ${fmtKm(a.distance)} km` : ''}
                            {a.total_elevation_gain ? ` · ${fmtElev(a.total_elevation_gain)} D+` : ''}
                          </div>
                        </div>
                        <span className="activity-stat">{fmtH(a.moving_time)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Évolution de la forme (toujours) ──────────────── */}
      {ctlSeries.length > 1 && (
        <div className="card">
          <div className="section-label">Évolution de la forme (CTL)</div>
          <LineChart data={ctlSeries} labels={ctlLabels} color="var(--success)" fmt={(v) => `CTL ${Math.round(v)}`} />
        </div>
      )}

      {/* ── Charge (état athlète) ─────────────────────────── */}
      <div>
        <div className="section-label">Charge du jour</div>
        <div className="grid grid-2">
          {stateTiles.map(t => <TileCard key={t.key} t={t} pinned={pinned.includes(t.key)} onPin={togglePin} />)}
        </div>
      </div>
    </div>
  );
}

function TileCard({ t, pinned, onPin }: { t: Tile; pinned: boolean; onPin: (k: string) => void }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile__top">
        <span className="stat-tile__label">{t.label}</span>
        <button className={`pin-btn${pinned ? ' pin-btn--on' : ''}`} onClick={() => onPin(t.key)} title={pinned ? 'Retirer des favoris' : 'Épingler'}>
          {pinned ? '★' : '☆'}
        </button>
      </div>
      <div className="stat-tile__value">{t.value}{t.unit ? <span className="stat-tile__unit">{t.unit}</span> : null}</div>
      {t.sub && <div className="stat-tile__sub">{t.sub}</div>}
      <div className={`accent-bar accent--${t.accent}`} />
    </div>
  );
}

function readinessLabel(r: number) {
  if (r >= 75) return 'Frais — go';
  if (r >= 50) return 'Correct';
  if (r >= 30) return 'Fatigue';
  return 'Repos conseillé';
}
