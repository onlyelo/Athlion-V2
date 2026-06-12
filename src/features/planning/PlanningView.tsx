import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { sportMeta } from '../../lib/sport';
import { BarChart } from '../../components/Charts';

interface Session {
  id: string; date: string; sport: string | null; name: string | null; status: string;
  duration_min: number | null; distance_m: number | null; tss: number | null;
  intensity_zone: string | null; prescribed: { detail?: string } | null;
  completion_ratio: number | null; adaptation_reason: string | null;
}
interface Goal { id: string; horizon: 'short' | 'mid' | 'long'; title: string; type: string | null; target_date: string | null; }
interface Level { sport: string; level_estimate: number; confidence: number; }
interface GenResult { week: { label: string; weeklyTssTarget: number; intensity: string; deload: boolean }; count: number; }

const HORIZON = { short: 'Court terme', mid: 'Moyen terme', long: 'Long terme' };
const STATUS_BADGE: Record<string, string> = { planned: 'badge--blue', completed: 'badge--green', skipped: 'badge--red', modified: 'badge--amber' };

const DAYS = [['L', 0], ['M', 1], ['M', 2], ['J', 3], ['V', 4], ['S', 5], ['D', 6]] as const;
const DAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const SPORTS = [
  { key: 'swim', icon: '🏊', label: 'Nage' },
  { key: 'bike', icon: '🚴', label: 'Vélo' },
  { key: 'run', icon: '🏃', label: 'Course' },
  { key: 'strength', icon: '💪', label: 'Renfo' },
];
const SESSION_TYPES = ['Endurance', 'Seuil', 'VO2max', 'Technique', 'Sortie longue', 'Fractionné'];
const INTENSITY: Array<{ key: 'easy' | 'normal' | 'hard'; label: string }> = [
  { key: 'easy', label: 'Facile' }, { key: 'normal', label: 'Normal' }, { key: 'hard', label: 'Intense' },
];

interface Constraints {
  sessionsCount: number | null;
  days: number[];
  focusSports: string[];
  intensity: 'easy' | 'normal' | 'hard';
  sessionTypes: string[];
  notes: string;
  daySpecs: Record<number, string[]>; // jour (0-6) → disciplines choisies
}

export function PlanningView() {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [genInfo, setGenInfo] = useState<GenResult['week'] | null>(null);
  const [showGoal, setShowGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', horizon: 'mid' as Goal['horizon'], target_date: '' });
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [cst, setCst] = useState<Constraints>({ sessionsCount: null, days: [], focusSports: [], intensity: 'normal', sessionTypes: [], notes: '', daySpecs: {} });

  const range = weekRange(weekOffset);
  const { data: sessions } = useQuery({ queryKey: ['sessions', weekOffset], queryFn: () => api.get<Session[]>(`/training/sessions?from=${range.start}&to=${range.end}`) });
  const { data: goals } = useQuery({ queryKey: ['goals'], queryFn: () => api.get<Goal[]>('/training/goals') });
  const { data: levels } = useQuery({ queryKey: ['levels'], queryFn: () => api.get<Level[]>('/training/levels') });

  const toggle = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  async function generate() {
    setGenerating(true);
    try {
      const daySpecs = Object.entries(cst.daySpecs)
        .filter(([, s]) => s.length)
        .map(([wd, sports]) => ({ weekday: Number(wd), sports }));
      const constraints = {
        ...(cst.sessionsCount ? { sessionsCount: cst.sessionsCount } : {}),
        days: cst.days,
        focusSports: cst.focusSports,
        intensity: cst.intensity,
        sessionTypes: cst.sessionTypes,
        ...(cst.notes.trim() ? { notes: cst.notes.trim() } : {}),
        // Mode détaillé : prioritaire côté serveur s'il est non vide.
        ...(detailed && daySpecs.length ? { daySpecs } : {}),
      };
      const r = await api.post<GenResult>('/training/generate', { constraints });
      setGenInfo(r.week);
      await qc.invalidateQueries({ queryKey: ['sessions'] });
    } catch {
      setGenInfo(null);
      alert("La génération a échoué. Réessaie dans un instant.");
    } finally { setGenerating(false); }
  }

  async function addGoal() {
    if (!goalForm.title) return;
    await api.post('/training/goals', { ...goalForm, target_date: goalForm.target_date || undefined });
    setGoalForm({ title: '', horizon: 'mid', target_date: '' });
    setShowGoal(false);
    qc.invalidateQueries({ queryKey: ['goals'] });
  }
  async function delGoal(id: string) { await api.del(`/training/goals/${id}`).catch(() => {}); qc.invalidateQueries({ queryKey: ['goals'] }); }

  // Regroupement par jour pour la vue calendrier de la semaine affichée.
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addIso(range.start, i)), [range.start]);
  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>();
    (sessions ?? []).forEach(s => {
      const k = s.date.slice(0, 10);
      const arr = m.get(k) ?? []; arr.push(s); m.set(k, arr);
    });
    return m;
  }, [sessions]);
  const dayLoad = weekDays.map(d => ({ label: frShort(d), value: (byDate.get(d) ?? []).reduce((s, x) => s + (x.tss || 0), 0) }));
  const weekTss = Math.round(dayLoad.reduce((s, d) => s + d.value, 0));

  return (
    <div className="stack">
      <div className="row between">
        <h1 className="heading-1">Planning</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className={`btn btn--sm ${showCustom ? 'btn--secondary' : 'btn--ghost'}`} onClick={() => setShowCustom(s => !s)}>⚙︎ Contraintes</button>
          <button className="btn btn--primary btn--sm" onClick={generate} disabled={generating}>
            {generating ? <span className="spin" /> : '✦ Générer'}
          </button>
        </div>
      </div>

      {/* Contraintes de génération IA */}
      {showCustom && (
        <div className="card">
          <div className="section-label">Contraintes de la semaine</div>
          <div className="stack" style={{ gap: 14 }}>
            {/* Mode : global vs jour par jour */}
            <div className="segmented">
              <button className={`seg-btn${!detailed ? ' seg-btn--active' : ''}`} onClick={() => setDetailed(false)}>Global</button>
              <button className={`seg-btn${detailed ? ' seg-btn--active' : ''}`} onClick={() => setDetailed(true)}>Jour par jour</button>
            </div>

            {!detailed ? (
              <>
                {/* Nombre de séances */}
                <div className="row between">
                  <span className="body-sm">Nombre de séances</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="step-btn" onClick={() => setCst(c => ({ ...c, sessionsCount: Math.max(2, (c.sessionsCount ?? 5) - 1) }))}>−</button>
                    <span className="mono" style={{ minWidth: 48, textAlign: 'center' }}>{cst.sessionsCount ?? 'auto'}</span>
                    <button className="step-btn" onClick={() => setCst(c => ({ ...c, sessionsCount: Math.min(12, (c.sessionsCount ?? 5) + 1) }))}>+</button>
                    {cst.sessionsCount != null && <button className="btn btn--ghost btn--sm" onClick={() => setCst(c => ({ ...c, sessionsCount: null }))}>auto</button>}
                  </div>
                </div>

                {/* Jours autorisés */}
                <div>
                  <span className="body-sm" style={{ display: 'block', marginBottom: 6 }}>Jours d'entraînement {cst.days.length === 0 && <span className="text-muted">· tous</span>}</span>
                  <div className="row" style={{ gap: 6 }}>
                    {DAYS.map(([lbl, idx]) => (
                      <button key={idx} className={`day-chip${cst.days.includes(idx) ? ' day-chip--active' : ''}`}
                        onClick={() => setCst(c => ({ ...c, days: toggle(c.days, idx) }))}>{lbl}</button>
                    ))}
                  </div>
                </div>

                {/* Disciplines */}
                <div>
                  <span className="body-sm" style={{ display: 'block', marginBottom: 6 }}>Disciplines {cst.focusSports.length === 0 && <span className="text-muted">· toutes</span>}</span>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {SPORTS.map(s => (
                      <button key={s.key} className={`chip${cst.focusSports.includes(s.key) ? ' chip--active' : ''}`}
                        onClick={() => setCst(c => ({ ...c, focusSports: toggle(c.focusSports, s.key) }))}>{s.icon} {s.label}</button>
                    ))}
                  </div>
                </div>

                {/* Types de séances */}
                <div>
                  <span className="body-sm" style={{ display: 'block', marginBottom: 6 }}>Types de séances {cst.sessionTypes.length === 0 && <span className="text-muted">· au choix</span>}</span>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {SESSION_TYPES.map(t => (
                      <button key={t} className={`chip${cst.sessionTypes.includes(t) ? ' chip--active' : ''}`}
                        onClick={() => setCst(c => ({ ...c, sessionTypes: toggle(c.sessionTypes, t) }))}>{t}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Mode détaillé : pour chaque jour, choisis les disciplines */
              <div className="stack" style={{ gap: 8 }}>
                <span className="body-sm text-muted">Choisis, jour par jour, les disciplines voulues. Une séance sera créée par discipline cochée.</span>
                {DAYS.map(([, idx]) => (
                  <div key={idx} className="row between daySpec-row">
                    <span className="body-sm" style={{ minWidth: 70 }}>{DAY_FULL[idx]}</span>
                    <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {SPORTS.map(s => {
                        const on = (cst.daySpecs[idx] ?? []).includes(s.key);
                        return (
                          <button key={s.key} title={s.label}
                            className={`sport-toggle${on ? ' sport-toggle--on' : ''}`}
                            onClick={() => setCst(c => ({ ...c, daySpecs: { ...c.daySpecs, [idx]: toggle(c.daySpecs[idx] ?? [], s.key) } }))}>
                            {s.icon}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <span className="body-sm" style={{ textAlign: 'right' }}>
                  {Object.values(cst.daySpecs).reduce((n, s) => n + s.length, 0)} séance(s) planifiée(s)
                </span>
              </div>
            )}

            {/* Intensité (commun aux deux modes) */}
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 6 }}>Intensité globale</span>
              <div className="segmented">
                {INTENSITY.map(it => (
                  <button key={it.key} className={`seg-btn${cst.intensity === it.key ? ' seg-btn--active' : ''}`}
                    onClick={() => setCst(c => ({ ...c, intensity: it.key }))}>{it.label}</button>
                ))}
              </div>
            </div>

            {/* Note libre */}
            <input className="input" placeholder="Demande libre (ex : pas de vélo en intérieur, séance club le mardi)…"
              value={cst.notes} onChange={e => setCst(c => ({ ...c, notes: e.target.value }))} maxLength={300} />
          </div>
        </div>
      )}

      {/* Phase de périodisation (après génération) */}
      {genInfo && (
        <div className="card-glass">
          <div className="section-label">Phase — {genInfo.label}{genInfo.deload ? ' · décharge' : ''}</div>
          <div className="row between">
            <span className="body-sm">{genInfo.intensity}</span>
            <span className="mono">~{genInfo.weeklyTssTarget} TSS</span>
          </div>
        </div>
      )}

      {/* Objectifs */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 4 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Objectifs</div>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowGoal(s => !s)}>{showGoal ? 'Annuler' : '+ Objectif'}</button>
        </div>
        {showGoal && (
          <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
            <input className="input" placeholder="ex : Triathlon M de Nice" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} />
            <div className="grid grid-2">
              <select className="input" value={goalForm.horizon} onChange={e => setGoalForm(f => ({ ...f, horizon: e.target.value as Goal['horizon'] }))}>
                <option value="short">Court terme</option>
                <option value="mid">Moyen terme</option>
                <option value="long">Long terme</option>
              </select>
              <input className="input" type="date" value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} />
            </div>
            <button className="btn btn--primary full" onClick={addGoal}>Ajouter l'objectif</button>
          </div>
        )}
        {goals && goals.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            {goals.map(g => (
              <div key={g.id} className="row between">
                <div>
                  <span className="body-md">{g.title}</span>
                  <div className="activity-sub">{HORIZON[g.horizon]}{g.target_date ? ` · ${new Date(g.target_date).toLocaleDateString('fr')}` : ''}</div>
                </div>
                <button className="pin-btn" onClick={() => delGoal(g.id)} title="Retirer">✕</button>
              </div>
            ))}
          </div>
        ) : <span className="body-sm">Ajoute un objectif pour orienter la périodisation.</span>}
      </div>

      {/* Niveaux par discipline */}
      {levels && levels.length > 0 && (
        <div className="card">
          <div className="section-label">Niveaux estimés</div>
          <div className="grid grid-3">
            {levels.map(l => {
              const m = sportMeta(l.sport);
              return (
                <div key={l.sport} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{m.icon}</div>
                  <div className="heading-2">{Math.round(l.level_estimate)}</div>
                  <span className="label">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation semaine */}
      <div className="card week-nav-card">
        <button className="step-btn" onClick={() => setWeekOffset(o => o - 1)} aria-label="semaine précédente">‹</button>
        <div style={{ textAlign: 'center' }}>
          <div className="body-md">{weekLabel(range)}</div>
          {weekOffset === 0
            ? <span className="label">cette semaine</span>
            : <button className="btn btn--ghost btn--sm" onClick={() => setWeekOffset(0)}>↩ revenir à cette semaine</button>}
        </div>
        <button className="step-btn" onClick={() => setWeekOffset(o => o + 1)} aria-label="semaine suivante">›</button>
      </div>

      {/* Charge par jour */}
      {weekTss > 0 && (
        <div className="card">
          <div className="section-label">Charge de la semaine · {weekTss} TSS</div>
          <BarChart data={dayLoad} color="var(--plasma)" fmt={(v) => `${Math.round(v)} TSS`} />
        </div>
      )}

      {/* Calendrier jour par jour */}
      <div className="stack" style={{ gap: 8 }}>
        {weekDays.map(d => {
          const ses = byDate.get(d) ?? [];
          const dayTss = ses.reduce((s, x) => s + (x.tss || 0), 0);
          return (
            <div key={d} className={`day-block${d === todayIso ? ' day-block--today' : ''}`}>
              <div className="day-block__head">
                <span className="day-block__date">{frDayNum(d)}{d === todayIso ? ' · aujourd\'hui' : ''}</span>
                {dayTss > 0 && <span className="mono">{Math.round(dayTss)} TSS</span>}
              </div>
              {ses.length === 0 ? (
                <span className="body-sm text-muted">Repos</span>
              ) : (
                <div className="stack" style={{ gap: 6 }}>
                  {ses.map(s => (
                    <SessionCard key={s.id} s={s} open={reconcileId === s.id}
                      onToggle={() => setReconcileId(id => id === s.id ? null : s.id)}
                      onDone={() => { setReconcileId(null); qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['levels'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(sessions?.length ?? 0) === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <span className="body-sm">Aucune séance cette semaine.<br />Lance « Générer » pour un plan IA adapté à ta forme et tes objectifs.</span>
        </div>
      )}
    </div>
  );
}

interface StravaMatch { found: boolean; activity?: { name: string; duration_min: number; distance_m: number }; }

function SessionCard({ s, open, onToggle, onDone }: { s: Session; open: boolean; onToggle: () => void; onDone: () => void }) {
  const m = sportMeta(s.sport ?? 'run');
  const [dur, setDur] = useState(s.duration_min ?? 0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<StravaMatch | null>(null);
  const [matching, setMatching] = useState(false);

  // À l'ouverture, on cherche automatiquement l'activité Strava correspondante.
  useEffect(() => { if (open && match === null) doMatch(false); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doMatch(forceSync: boolean) {
    setMatching(true);
    try {
      if (forceSync) { await api.post('/strava/sync').catch(() => {}); }
      const r = await api.get<StravaMatch>(`/training/sessions/${s.id}/strava-match`);
      setMatch(r);
      if (r.found && r.activity?.duration_min) setDur(r.activity.duration_min);
    } catch { setMatch({ found: false }); }
    finally { setMatching(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await api.post<{ verdict: string; ratio: number }>(`/training/sessions/${s.id}/reconcile`, { executed: { duration_min: dur } });
      setVerdict(r.verdict);
      setTimeout(onDone, 1200);
    } finally { setBusy(false); }
  }

  const reconcilable = s.status === 'planned' || s.status === 'modified';
  const statusLabel = s.status === 'planned' ? 'à faire'
    : s.status === 'modified' ? 'modifiée'
    : s.status === 'completed' ? (s.completion_ratio != null ? `${Math.round(s.completion_ratio * 100)}%` : 'fait')
    : s.status === 'skipped' ? 'sautée' : s.status;

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="row between">
        <div className="row" style={{ gap: 12 }}>
          <div className={`activity-icon activity-icon--${m.accent === 'hike' ? 'nutrition' : m.accent === 'swim' ? 'swim' : m.accent === 'bike' ? 'bike' : 'run'}`}>{m.icon}</div>
          <div>
            <div className="activity-title">{s.name || m.label}</div>
            <div className="activity-sub">
              {s.duration_min ? `${s.duration_min} min` : ''}{s.intensity_zone ? ` · ${s.intensity_zone}` : ''}{s.tss ? ` · ${Math.round(s.tss)} TSS` : ''}
            </div>
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[s.status] || 'badge--blue'}`}>{statusLabel}</span>
      </div>

      {s.prescribed?.detail && <div className="body-sm" style={{ marginTop: 8, color: 'var(--ice)' }}>📋 {s.prescribed.detail}</div>}

      {reconcilable && (
        <div style={{ marginTop: 10 }}>
          {!open ? (
            <button className="btn btn--secondary btn--sm full" onClick={onToggle}>✓ J'ai fait cette séance</button>
          ) : verdict ? (
            <div className={`badge ${verdict === 'success' ? 'badge--green' : verdict === 'fail' ? 'badge--red' : 'badge--amber'}`} style={{ width: '100%', justifyContent: 'center', padding: 8 }}>
              {verdict === 'success' ? '✓ Réussie — niveau ↗' : verdict === 'fail' ? '✗ Échec — niveau ↘' : 'Partielle — niveau maintenu'}
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {matching ? (
                <span className="body-sm"><span className="spin" /> <span style={{ marginLeft: 6 }}>recherche sur Strava…</span></span>
              ) : match?.found && match.activity ? (
                <div className="body-sm text-success">⚡ Strava : {match.activity.name} · {match.activity.duration_min} min{match.activity.distance_m ? ` · ${(match.activity.distance_m / 1000).toFixed(1)} km` : ''}</div>
              ) : match ? (
                <div className="row between">
                  <span className="body-sm text-muted">Aucune activité Strava trouvée ce jour-là.</span>
                  <button className="btn btn--ghost btn--sm" onClick={() => doMatch(true)}>↻ Resync Strava</button>
                </div>
              ) : null}
              <div className="row" style={{ gap: 8 }}>
                <input className="input" type="number" value={dur} onChange={e => setDur(Number(e.target.value))} placeholder="durée réalisée (min)" />
                <button className="btn btn--primary btn--sm" onClick={submit} disabled={busy}>{busy ? <span className="spin" /> : 'Valider'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers semaine ────────────────────────────────────────────────
function weekRange(offset: number) {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;            // 0 = lundi
  d.setDate(d.getDate() - day + offset * 7);
  const start = d.toISOString().slice(0, 10);
  const e = new Date(d); e.setDate(e.getDate() + 6);
  return { start, end: e.toISOString().slice(0, 10) };
}
function addIso(iso: string, n: number) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
const frShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr', { weekday: 'short' });
const frDayNum = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'short' });
function weekLabel(r: { start: string; end: string }) {
  const o = { day: 'numeric', month: 'short' } as const;
  return `Semaine du ${new Date(r.start + 'T00:00:00').toLocaleDateString('fr', o)} au ${new Date(r.end + 'T00:00:00').toLocaleDateString('fr', o)}`;
}
