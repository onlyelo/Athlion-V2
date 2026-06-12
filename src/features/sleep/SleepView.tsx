import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { BarChart } from '../../components/Charts';

interface SleepPhases { deep_min?: number; rem_min?: number; light_min?: number; awake_min?: number; }
interface SleepNight {
  date: string;
  duration_min: number;
  wake_time: string | null;
  bedtime: string | null;
  source?: 'manual' | 'garmin';
  phases?: SleepPhases | null;
  hrv_ms?: number | null;
  resting_hr?: number | null;
}

interface SleepData {
  profile: { sleep_need_min: number; chronotype: string };
  nights: SleepNight[];
  sleep_debt_min: number;
  energy_curve: {
    points: Array<{ hour: number; energy: number }>;
    dipHour: number;
    melatoninWindow: { start: number; end: number };
  } | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return isoDate(d); };
const frDay = (iso: string) => new Date(iso).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
const hhmm = (min: number) => `${Math.floor(min / 60)}h${pad(Math.round(min % 60))}`;

export function SleepView() {
  const qc = useQueryClient();
  const today = isoDate(new Date());

  const { data, isLoading } = useQuery({ queryKey: ['sleep'], queryFn: () => api.get<SleepData>('/sleep') });

  const [selDate, setSelDate] = useState(today);
  const [bedtime, setBedtime] = useState('22:30');
  const [wake, setWake] = useState('06:30');
  const [saving, setSaving] = useState(false);
  const [savedDate, setSavedDate] = useState<string | null>(null);

  const loggedMap = useMemo(() => {
    const m = new Map<string, SleepNight>();
    data?.nights.forEach(n => m.set(n.date, n));
    return m;
  }, [data?.nights]);

  // 14 dernières nuits (date = jour de réveil), de la plus récente à la plus ancienne
  const grid = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, -i)), [today]);

  function selectNight(date: string) {
    setSelDate(date);
    const existing = loggedMap.get(date);
    if (existing?.bedtime) setBedtime(new Date(existing.bedtime).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }));
    if (existing?.wake_time) setWake(new Date(existing.wake_time).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }));
  }

  async function logNight() {
    setSaving(true);
    const [bh, bm] = bedtime.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let bedMins = bh * 60 + bm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= bedMins) wakeMins += 24 * 60;
    const duration_min = wakeMins - bedMins;
    await api.post('/sleep', { date: selDate, bedtime, wake_time: wake, duration_min });
    await qc.invalidateQueries({ queryKey: ['sleep'] });
    await qc.invalidateQueries({ queryKey: ['dashboard'] });
    setSaving(false);
    setSavedDate(selDate);
    setTimeout(() => setSavedDate(null), 1800);
  }

  if (isLoading) return <span className="label">Chargement…</span>;

  const need = data?.profile.sleep_need_min ?? 480;
  const debtMin = data?.sleep_debt_min ?? 0;
  const debtH = +(debtMin / 60).toFixed(1);
  const curve = data?.energy_curve;

  // Historique durées (chronologique, 14 nuits)
  const histNights = [...grid].reverse().map(d => ({ date: d, night: loggedMap.get(d) }));
  const durData = histNights.filter(h => h.night).map(h => ({
    label: frDay(h.date),
    value: +((h.night!.duration_min) / 60).toFixed(1),
  }));

  const selExisting = loggedMap.get(selDate);
  const selPhases = selExisting?.phases;
  const hasPhases = !!selPhases && (selPhases.deep_min || selPhases.rem_min || selPhases.light_min);

  return (
    <div className="stack">
      <h1 className="heading-1">Sommeil</h1>

      {/* ── Énergie circadienne ──────────────────────────── */}
      {curve && <EnergyCard curve={curve} />}

      {/* ── Dette de sommeil — expliquée ─────────────────── */}
      <DebtCard debtMin={debtMin} debtH={debtH} need={need} nights={data?.nights ?? []} />

      {/* ── Phases de la nuit sélectionnée (Garmin) ──────── */}
      {hasPhases && selExisting && (
        <div className="card">
          <div className="section-label">Phases — nuit du {frDay(selDate)}</div>
          <PhaseBar phases={selPhases!} total={selExisting.duration_min} />
          {(selExisting.hrv_ms || selExisting.resting_hr) && (
            <div className="row" style={{ gap: 18, marginTop: 12 }}>
              {selExisting.hrv_ms ? <Metric label="VFC nuit" value={`${selExisting.hrv_ms} ms`} /> : null}
              {selExisting.resting_hr ? <Metric label="FC repos" value={`${selExisting.resting_hr} bpm`} /> : null}
            </div>
          )}
        </div>
      )}

      {/* ── Grille de saisie 14 nuits ────────────────────── */}
      <div className="card">
        <div className="section-label">Mes 14 dernières nuits</div>
        <div className="sleep-grid">
          {grid.map(d => {
            const n = loggedMap.get(d);
            const h = n ? +(n.duration_min / 60).toFixed(1) : null;
            const ok = n ? n.duration_min >= need * 0.9 : false;
            const deep = n?.phases?.deep_min ?? null;
            return (
              <button key={d} onClick={() => selectNight(d)}
                className={`sleep-cell${selDate === d ? ' sleep-cell--sel' : ''}${n ? (ok ? ' sleep-cell--ok' : ' sleep-cell--low') : ''}`}>
                <span className="sleep-cell__day">{frDay(d)}</span>
                <span className="sleep-cell__val">{h !== null ? `${h}h` : '+'}</span>
                {n ? (
                  <span className="sleep-cell__src" title={n.source === 'garmin' ? 'Mesuré par Garmin' : 'Saisie manuelle'}>
                    {n.source === 'garmin' ? '⌚' : '✎'}{deep ? ` ${Math.round(deep / 60 * 10) / 10}` : ''}
                  </span>
                ) : <span className="sleep-cell__src">&nbsp;</span>}
              </button>
            );
          })}
        </div>
        <div className="sleep-legend">
          <span><i className="dot dot--ok" /> ≥ objectif</span>
          <span><i className="dot dot--low" /> sous l'objectif</span>
          <span>⌚ Garmin · ✎ manuel · chiffre = sommeil profond (h)</span>
        </div>

        {/* Formulaire pour la nuit sélectionnée */}
        <div className="stack" style={{ gap: 12, marginTop: 16 }}>
          <span className="body-sm">
            Nuit du <b className="text-ice">{new Date(addDays(selDate, -1)).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'short' })}</b> au <b className="text-ice">{new Date(selDate).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'short' })}</b>
            {selExisting ? <span className={`badge ${selExisting.source === 'garmin' ? 'badge--blue' : 'badge--green'}`} style={{ marginLeft: 8 }}>{selExisting.source === 'garmin' ? '⌚ mesurée' : 'saisie'}</span> : null}
          </span>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <TimeField label="Coucher" value={bedtime} onChange={setBedtime} />
            <TimeField label="Réveil" value={wake} onChange={setWake} />
          </div>
          <DurationHint bedtime={bedtime} wake={wake} need={need} />
          <button className={`btn full ${savedDate === selDate ? 'btn--secondary' : 'btn--primary'}`} onClick={logNight} disabled={saving}>
            {saving ? 'Enregistrement…' : savedDate === selDate ? '✓ Enregistré' : selExisting ? 'Mettre à jour' : 'Enregistrer la nuit'}
          </button>
        </div>
      </div>

      {/* ── Historique durées ────────────────────────────── */}
      {durData.length > 1 && (
        <div className="card">
          <div className="section-label">Durées — 14 nuits</div>
          <BarChart data={durData} color="var(--ice)" fmt={(v) => `${v} h`} />
          <div className="row between" style={{ marginTop: 8 }}>
            <span className="body-sm">Besoin : {(need / 60).toFixed(1)} h/nuit</span>
            <span className="body-sm">{durData.length} nuits saisies</span>
          </div>
        </div>
      )}

      {durData.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <span className="body-sm">Aucune nuit enregistrée — touche une case ci-dessus, ou connecte Garmin depuis le profil.</span>
        </div>
      )}
    </div>
  );
}

/* ── Énergie circadienne : courbe lissée SVG ─────────────────────── */
function EnergyCard({ curve }: { curve: NonNullable<SleepData['energy_curve']> }) {
  const H0 = 5, H1 = 24;               // fenêtre affichée (matin → nuit)
  const W = 320, H = 116, pT = 14, pB = 20, pX = 6;
  const pts = curve.points.filter(p => p.hour >= H0 && p.hour <= H1);
  const x = (h: number) => pX + ((h - H0) / (H1 - H0)) * (W - 2 * pX);
  const y = (e: number) => H - pB - (e / 100) * (H - pT - pB);

  const now = new Date();
  const nowDec = now.getHours() + now.getMinutes() / 60;
  const energyNow = useMemo(() => {
    if (nowDec < H0 || nowDec > H1) return null;
    return curve.points.reduce((best, p) => Math.abs(p.hour - nowDec) < Math.abs(best.hour - nowDec) ? p : best, curve.points[0]).energy;
  }, [curve.points, nowDec]);

  const line = pts.map(p => `${x(p.hour).toFixed(1)},${y(p.energy).toFixed(1)}`).join(' ');
  const area = `${x(H0).toFixed(1)},${H - pB} ${line} ${x(H1).toFixed(1)},${H - pB}`;

  // Pic matinal & creux de l'après-midi (pour annoter)
  const peak = pts.filter(p => p.hour >= 7 && p.hour <= 12).reduce((a, b) => b.energy > a.energy ? b : a, pts[0]);
  const dip = pts.filter(p => p.hour >= 12 && p.hour <= 17).reduce((a, b) => b.energy < a.energy ? b : a, { hour: curve.dipHour, energy: 100 });

  const mel = curve.melatoninWindow;
  const melStart = Math.max(H0, Math.min(H1, mel.start < H0 ? mel.start + 24 : mel.start));
  const melEnd = Math.max(H0, Math.min(H1, mel.end < melStart ? H1 : mel.end));

  const energyLabel = energyNow == null ? '—' : energyNow >= 70 ? 'haute' : energyNow >= 45 ? 'moyenne' : 'basse';

  return (
    <div className="card-glass">
      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 2 }}>Énergie circadienne</div>
          <span className="body-sm">Maintenant · {hour12(nowDec)}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="gauge text-plasma" style={{ fontSize: 34 }}>{energyNow ?? '—'}{energyNow != null ? <span style={{ fontSize: 16 }}>%</span> : null}</div>
          <span className="body-sm">énergie {energyLabel}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--plasma)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--plasma)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fenêtre mélatonine */}
        {melEnd > melStart && (
          <rect x={x(melStart)} y={pT} width={x(melEnd) - x(melStart)} height={H - pT - pB}
            fill="var(--warning)" opacity="0.12" />
        )}

        {/* Aire + courbe */}
        <polygon points={area} fill="url(#energyFill)" />
        <polyline points={line} fill="none" stroke="var(--plasma)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Repères horaires */}
        {[6, 9, 12, 15, 18, 21, 24].map(h => (
          <g key={h}>
            <line x1={x(h)} y1={H - pB} x2={x(h)} y2={H - pB + 3} stroke="var(--text-muted)" strokeWidth="1" />
            <text x={x(h)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">{h}h</text>
          </g>
        ))}

        {/* Pic & creux annotés */}
        {peak && <Annot x={x(peak.hour)} y={y(peak.energy)} val={peak.energy} up />}
        {dip && dip.energy < 100 && <Annot x={x(dip.hour)} y={y(dip.energy)} val={dip.energy} />}

        {/* Repère « maintenant » */}
        {energyNow != null && (
          <>
            <line x1={x(nowDec)} y1={pT} x2={x(nowDec)} y2={H - pB} stroke="var(--ice)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={x(nowDec)} cy={y(energyNow)} r="4" fill="var(--plasma)" stroke="var(--void)" strokeWidth="2" />
          </>
        )}
      </svg>

      <div className="sleep-legend" style={{ marginTop: 4 }}>
        <span><i className="dot" style={{ background: 'var(--warning)', opacity: 0.5 }} /> fenêtre mélatonine {mel.start}h–{mel.end}h</span>
        <span>creux vers {curve.dipHour}h</span>
      </div>
    </div>
  );
}

function Annot({ x, y, val, up }: { x: number; y: number; val: number; up?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r="2.5" fill="var(--text-secondary)" />
      <text x={x} y={up ? y - 6 : y + 12} textAnchor="middle" fontSize="9" fill="var(--text-secondary)" fontFamily="var(--font-mono)">{val}%</text>
    </g>
  );
}

const hour12 = (dec: number) => `${pad(Math.floor(dec))}:${pad(Math.round((dec % 1) * 60))}`;

/* ── Dette de sommeil expliquée ──────────────────────────────────── */
function DebtCard({ debtMin, debtH, need, nights }: { debtMin: number; debtH: number; need: number; nights: SleepNight[] }) {
  const debtColor = debtH > 3 ? 'text-danger' : debtH > 1 ? 'text-warning' : 'text-success';
  const last14 = nights.slice(0, 14);
  const totalNeed = need * 14;
  const totalSlept = last14.reduce((s, n) => s + (n.duration_min || 0), 0);
  const capped = debtMin >= 40 * 60;

  const verdict = debtH > 3
    ? 'Dette élevée : tes performances et ta récupération en pâtissent. Vise +30 à +60 min/nuit cette semaine.'
    : debtH > 1
    ? 'Légère dette : rattrapable en quelques nuits un peu plus longues. Évite de la laisser filer.'
    : 'Dette quasi nulle : ton sommeil couvre ton besoin. Continue ainsi.';

  return (
    <div className="card">
      <div className="section-label">Dette de sommeil · 14 nuits</div>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <span className={`gauge ${debtColor}`}>{debtH}</span>
          <span className="body-sm" style={{ marginLeft: 6 }}>h de dette{capped ? ' (plafond)' : ''}</span>
        </div>
        <div className="debt-bar" title={`${hhmm(debtMin)} de déficit cumulé`}>
          <div className="debt-bar__fill" style={{ width: `${Math.min(100, (debtMin / (40 * 60)) * 100)}%` }} />
        </div>
      </div>

      <p className="body-sm" style={{ marginTop: 10 }}>{verdict}</p>

      <div className="debt-explain">
        <div className="section-label" style={{ marginBottom: 6 }}>Comment c'est calculé</div>
        <p className="body-sm">
          C'est le <b className="text-ice">déficit cumulé</b> sur tes 14 dernières nuits : pour chaque nuit on compare
          ton sommeil réel à ton besoin ({(need / 60).toFixed(1)} h). Les nuits courtes ajoutent à la dette, les nuits
          longues la réduisent. Elle est plafonnée à 40 h (au-delà, le corps ne « comptabilise » plus).
        </p>
        <div className="debt-calc">
          <span>Besoin sur 14 nuits</span><span className="mono">{(totalNeed / 60).toFixed(0)} h</span>
          <span>Sommeil réel cumulé</span><span className="mono">{(totalSlept / 60).toFixed(0)} h</span>
          <span>Dette retenue</span><span className={`mono ${debtColor}`}>{debtH} h</span>
        </div>
      </div>
    </div>
  );
}

/* ── Barre de phases empilée ─────────────────────────────────────── */
function PhaseBar({ phases, total }: { phases: SleepPhases; total: number }) {
  const segs = [
    { k: 'deep_min' as const, label: 'Profond', color: 'var(--sleep-deep)' },
    { k: 'rem_min' as const, label: 'REM', color: 'var(--sleep-rem)' },
    { k: 'light_min' as const, label: 'Léger', color: 'var(--sleep-light)' },
    { k: 'awake_min' as const, label: 'Éveil', color: 'var(--sleep-awake)' },
  ];
  const sum = segs.reduce((s, x) => s + (phases[x.k] || 0), 0) || total || 1;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="phase-bar">
        {segs.map(s => {
          const v = phases[s.k] || 0;
          if (!v) return null;
          return <div key={s.k} className="phase-bar__seg" style={{ width: `${(v / sum) * 100}%`, background: s.color }} title={`${s.label} · ${hhmm(v)}`} />;
        })}
      </div>
      <div className="phase-legend">
        {segs.map(s => {
          const v = phases[s.k] || 0;
          return (
            <div key={s.k} className="phase-legend__item">
              <i className="dot" style={{ background: s.color }} />
              <span className="label">{s.label}</span>
              <span className="mono">{v ? hhmm(v) : '—'}</span>
              <span className="phase-legend__pct">{v ? `${Math.round((v / sum) * 100)}%` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 18 }}>{value}</div>
      <span className="label">{label}</span>
    </div>
  );
}

/* ── Sélecteur heure/minute à steppers ───────────────────────────── */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(':').map(Number);
  const setH = (nh: number) => onChange(`${pad((nh + 24) % 24)}:${pad(m)}`);
  const setM = (nm: number) => onChange(`${pad(h)}:${pad((nm + 60) % 60)}`);
  return (
    <div className="time-field">
      <span className="body-sm" style={{ display: 'block', marginBottom: 6 }}>{label}</span>
      <div className="time-stepper">
        <Seg val={h} onUp={() => setH(h + 1)} onDown={() => setH(h - 1)} onType={setH} max={23} />
        <span className="time-stepper__colon">:</span>
        <Seg val={m} onUp={() => setM(m + 5)} onDown={() => setM(m - 5)} onType={setM} max={59} />
      </div>
    </div>
  );
}

function Seg({ val, onUp, onDown, onType, max }: { val: number; onUp: () => void; onDown: () => void; onType: (v: number) => void; max: number }) {
  return (
    <div className="time-seg">
      <button type="button" className="time-seg__btn" onClick={onUp} aria-label="augmenter">▲</button>
      <input
        className="time-seg__inp"
        inputMode="numeric"
        value={pad(val)}
        onFocus={e => e.target.select()}
        onChange={e => {
          const n = parseInt(e.target.value.replace(/\D/g, '').slice(-2) || '0', 10);
          onType(Math.min(max, n));
        }}
      />
      <button type="button" className="time-seg__btn" onClick={onDown} aria-label="diminuer">▼</button>
    </div>
  );
}

function DurationHint({ bedtime, wake, need }: { bedtime: string; wake: string; need: number }) {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let dur = (wh * 60 + wm) - (bh * 60 + bm);
  if (dur <= 0) dur += 24 * 60;
  const ok = dur >= need * 0.9;
  return (
    <div className="row between">
      <span className="body-sm">Durée estimée</span>
      <span className={`mono ${ok ? 'text-success' : 'text-warning'}`}>{hhmm(dur)}{ok ? '' : ` · −${hhmm(need - dur)}`}</span>
    </div>
  );
}
