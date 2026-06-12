import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, BarChart } from '../../components/Charts';
import { MetricCard, CircularGauge, Skeleton, Segmented } from '../../components/ui';
import { Icon } from '../../components/Icon';
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
  { value: '7', label: '7j' },
  { value: '30', label: '30j' },
  { value: '90', label: '90j' },
  { value: '365', label: '1 an' },
] as const;

interface Tile { key: string; label: string; value: string | number; unit?: string; sub?: string; accent: string; }

function pct(series: number[]): { delta?: string; deltaPos?: boolean } {
  if (series.length < 2) return {};
  const first = series[0], last = series[series.length - 1];
  if (!first) return {};
  const d = ((last - first) / Math.abs(first)) * 100;
  if (!Number.isFinite(d) || Math.abs(d) < 0.5) return {};
  return { delta: `${Math.abs(Math.round(d))}%`, deltaPos: d >= 0 };
}

export function DashboardView() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const { data: sleepData } = useQuery({
    queryKey: ['sleep'],
    queryFn: () => api.get<{ nights: Array<{ date: string; duration_min: number; phases?: { deep_min?: number } | null }> }>('/sleep'),
  });

  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => { if (dash?.pinned) setPinned(dash.pinned); }, [dash?.pinned]);

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

  if (!dash) return <DashboardSkeleton />;
  const { state, history } = dash;

  // ── Greeting ─────────────────────────────────────────────────
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const firstName = (user?.name || '').split(' ')[0] || 'Athlète';

  // ── Séries ───────────────────────────────────────────────────
  const histLabels = history.map(h => h.date.slice(5));
  const ctlSeries = history.map(h => Number(h.ctl));
  const readinessSeries = history.map(h => Number(h.readiness));
  const debtSeries = history.map(h => +(Number(h.sleep_debt_min) / 60).toFixed(1));
  const weekly = summary?.weekly ?? [];
  const weeklyKm = weekly.map(w => Math.round(w.distance / 1000));
  const weeklyElev = weekly.map(w => Math.round(w.elevation));
  const weeklyTimeMin = weekly.map(w => Math.round(w.time / 60));

  const sleepNights = [...(sleepData?.nights ?? [])].reverse();
  const sleepBars = sleepNights.map(n => ({ label: n.date.slice(5), value: +(n.duration_min / 60).toFixed(1) }));
  const deepNights = sleepNights.filter(n => n.phases?.deep_min);
  const deepAvgH = deepNights.length
    ? +(deepNights.reduce((s, n) => s + (n.phases!.deep_min || 0), 0) / deepNights.length / 60).toFixed(1)
    : null;

  // ── Tuiles « Forme » (charge athlète) ────────────────────────
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
  const allTiles: Tile[] = [...stateTiles, ...totalsTiles, ...(summary?.bySport.flatMap(sportTiles) ?? [])];
  const tileMap = new Map(allTiles.map(t => [t.key, t]));
  const pinnedTiles = pinned.map(k => tileMap.get(k)).filter(Boolean) as Tile[];
  const sportsAvailable = summary?.bySport ?? [];
  const visibleTiles: Tile[] = sport === 'all'
    ? totalsTiles
    : sportTiles(sportsAvailable.find(s => s.sport === sport) ?? { sport, distance: 0, elevation: 0, time: 0, sessions: 0, avgHr: null, avgSpeed: null });

  // ── Conseil IA dérivé du TSB ─────────────────────────────────
  const tsb = Number(state.tsb);
  const advice = tsb > 5
    ? <>Forme fraîche. TSB <strong>+{tsb}</strong> — moment idéal pour une séance de qualité.</>
    : tsb < -10
    ? <>Fatigue marquée. TSB <strong>{tsb}</strong> — privilégie le Z1-Z2 et le sommeil.</>
    : <>Charge équilibrée. TSB <strong>{tsb >= 0 ? '+' : ''}{tsb}</strong> — maintiens le cap, écoute tes sensations.</>;

  return (
    <div className="stack" style={{ gap: 22 }}>
      {/* ── Greeting ─────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 3 }}>{greeting}, {firstName} 👋</h2>
        <p className="body-sm">
          {summary ? `${summary.totals.sessions} séances · ${fmtKm(summary.totals.distance)} km sur ${days}j` : 'Ton tableau de bord du jour'}
        </p>
      </div>

      {/* ── Readiness Hero ───────────────────────────────── */}
      <div className="card-hero" style={{ background: `linear-gradient(160deg, var(--pulse-soft) 0%, var(--bg-card) 60%)` }}>
        <CircularGauge value={Number(state.readiness)} />
        <div className="hero-gauge-stats">
          {[
            { l: 'CTL', v: Math.round(Number(state.ctl)) },
            { l: 'ATL', v: Math.round(Number(state.atl)) },
            { l: 'TSB', v: `${tsb >= 0 ? '+' : ''}${Math.round(tsb)}`, pos: tsb >= 0 },
            { l: 'Dette', v: `${(state.sleep_debt_min / 60).toFixed(1)}h`, neg: state.sleep_debt_min > 60 },
          ].map((m, i) => (
            <div key={i}>
              <div className="hero-stat__label">{m.l}</div>
              <div className="hero-stat__value" style={{ color: m.pos ? 'var(--energy)' : m.neg ? 'var(--effort)' : 'var(--text-primary)' }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Strava ───────────────────────────────────────── */}
      {!status?.connected ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>Données d'entraînement</div>
          <p className="body-sm" style={{ marginBottom: 14 }}>Connecte Strava pour alimenter ton tableau de bord avec tes activités réelles.</p>
          <button className="btn btn--primary" onClick={connectStrava}><Icon name="zap" size={16} /> Connecter Strava</button>
        </div>
      ) : (
        <div className="row between" style={{ padding: '0 4px' }}>
          <span className="body-sm">
            {status.cached} activités{status.last_sync ? ` · maj ${new Date(status.last_sync).toLocaleDateString('fr')}` : ''}
          </span>
          <button className="btn btn--secondary btn--sm" onClick={syncStrava} disabled={syncing}>
            {syncing ? <span className="spin" /> : <><Icon name="refresh" size={14} /> Synchroniser</>}
          </button>
        </div>
      )}

      {/* ── Période ──────────────────────────────────────── */}
      {status?.connected && (
        <Segmented options={PERIODS.map(p => ({ value: p.value, label: p.label }))} value={String(days)} onChange={(v) => setDays(Number(v))} />
      )}

      {/* ── Favoris ──────────────────────────────────────── */}
      {pinnedTiles.length > 0 && (
        <div>
          <div className="section-label">★ Favoris</div>
          <div className="grid grid-2">{pinnedTiles.map(t => <TileCard key={t.key} t={t} pinned onPin={togglePin} />)}</div>
        </div>
      )}

      {/* ── Cartes métriques (mockup 2×2 avec sparklines) ─── */}
      {summary && (
        <div className="grid grid-2">
          <MetricCard label="Distance" value={Math.round(summary.totals.distance / 1000)} unit="km" {...pct(weeklyKm)} sparkData={weeklyKm} color="var(--pulse)" />
          <MetricCard label="Dénivelé" value={Math.round(summary.totals.elevation)} unit="m" {...pct(weeklyElev)} sparkData={weeklyElev} color="var(--effort)" />
          <MetricCard label="Fitness" value={Math.round(Number(state.ctl))} unit="CTL" {...pct(ctlSeries)} sparkData={ctlSeries} color="var(--energy)" />
          <MetricCard label="Temps" value={Math.round(summary.totals.time / 60)} unit="min" {...pct(weeklyTimeMin)} sparkData={weeklyTimeMin} color="var(--recovery)" />
        </div>
      )}

      {/* ── Filtres sport ────────────────────────────────── */}
      {status?.connected && (
        <>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={`chip${sport === 'all' ? ' active' : ''}`} onClick={() => setSport('all')}>Tous</button>
            {sportsAvailable.map(s => {
              const m = sportMeta(s.sport);
              return <button key={s.sport} className={`chip${sport === s.sport ? ' active' : ''}`} onClick={() => setSport(s.sport)}>{m.icon} {m.label}</button>;
            })}
          </div>

          {sport !== 'all' && visibleTiles.length > 0 && (
            <div className="grid grid-2">{visibleTiles.map(t => <TileCard key={t.key} t={t} pinned={pinned.includes(t.key)} onPin={togglePin} />)}</div>
          )}
        </>
      )}

      {/* ── CTL chart ────────────────────────────────────── */}
      {ctlSeries.length > 1 && (
        <div>
          <div className="section-label">Évolution de la forme (CTL)</div>
          <div className="card-sm">
            <LineChart data={ctlSeries} labels={histLabels} color="var(--pulse)" fmt={(v) => `CTL ${Math.round(v)}`} />
          </div>
        </div>
      )}

      {/* ── Volume hebdo ─────────────────────────────────── */}
      {weekly.length > 1 && (
        <div>
          <div className="section-label">Volume hebdomadaire · km</div>
          <div className="card-sm">
            <BarChart data={weekly.map(w => ({ label: w.week.slice(5), value: Math.round(w.distance / 1000) }))} color="var(--energy)" fmt={(v) => `${v} km`} />
          </div>
        </div>
      )}

      {/* ── Prochaine séance + Conseil IA ────────────────── */}
      <div className="grid grid-2">
        <div className="card-sm" style={{ cursor: 'pointer' }} onClick={() => navigate('/planning')}>
          <div className="label" style={{ marginBottom: 10 }}>Planning</div>
          <Icon name="calendar" size={20} />
          <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 3px' }}>Voir ma semaine</div>
          <div className="body-sm" style={{ fontSize: 11 }}>Séances & charge →</div>
        </div>
        <div className="ai-card">
          <div className="ai-card__label">Conseil IA ✦</div>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-primary)' }}>{advice}</p>
        </div>
      </div>

      {/* ── Activités récentes ───────────────────────────── */}
      {recent && recent.activities.length > 0 && (
        <div>
          <div className="section-label">Activités récentes</div>
          <div className="card" style={{ padding: '0 16px' }}>
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

      {/* ── Tendances secondaires ────────────────────────── */}
      {readinessSeries.length > 1 && (
        <div>
          <div className="section-label">Readiness — évolution</div>
          <div className="card-sm"><LineChart data={readinessSeries} labels={histLabels} color="var(--pulse)" fmt={(v) => `${Math.round(v)}/100`} /></div>
        </div>
      )}
      {sleepBars.length > 1 && (
        <div>
          <div className="section-label" style={{ justifyContent: 'space-between' }}>
            <span>Sommeil — {sleepBars.length} nuits</span>
            {deepAvgH != null && <span className="body-sm" style={{ textTransform: 'none', letterSpacing: 0 }}>profond ~{deepAvgH}h</span>}
          </div>
          <div className="card-sm"><BarChart data={sleepBars} color="var(--sleep-light)" fmt={(v) => `${v} h`} /></div>
        </div>
      )}
      {debtSeries.some(v => v > 0) && (
        <div>
          <div className="section-label">Dette de sommeil — évolution</div>
          <div className="card-sm"><LineChart data={debtSeries} labels={histLabels} color="var(--warn)" fmt={(v) => `${v} h`} /></div>
        </div>
      )}

      {/* ── Charge du jour (tuiles épinglables) ──────────── */}
      <div>
        <div className="section-label">Charge du jour</div>
        <div className="grid grid-2">{stateTiles.map(t => <TileCard key={t.key} t={t} pinned={pinned.includes(t.key)} onPin={togglePin} />)}</div>
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="stat-tile__value">{t.value}</span>
        {t.unit ? <span className="stat-tile__unit">{t.unit}</span> : null}
      </div>
      {t.sub && <div className="stat-tile__sub">{t.sub}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div><Skeleton w={180} h={26} /><div style={{ height: 8 }} /><Skeleton w={220} h={13} /></div>
      <div className="card-hero" style={{ display: 'grid', placeItems: 'center', gap: 16 }}>
        <Skeleton w={180} h={180} r={90} />
        <Skeleton w="100%" h={44} />
      </div>
      <div className="grid grid-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={90} r={14} />)}
      </div>
      <Skeleton h={120} r={20} />
    </div>
  );
}
