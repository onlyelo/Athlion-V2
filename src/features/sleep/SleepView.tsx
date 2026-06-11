import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { BarChart } from '../../components/Charts';

interface SleepNight {
  date: string;
  duration_min: number;
  wake_time: string | null;
  bedtime: string | null;
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return isoDate(d); };
const frDay = (iso: string) => new Date(iso).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });

export function SleepView() {
  const qc = useQueryClient();
  const today = isoDate(new Date());
  const now = new Date().getHours();

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
  const debtH = data ? +(data.sleep_debt_min / 60).toFixed(1) : 0;
  const debtColor = debtH > 3 ? 'text-danger' : debtH > 1 ? 'text-warning' : 'text-success';
  const curve = data?.energy_curve;
  const curvePoints = curve?.points.filter(p => p.hour >= 6 && p.hour <= 23) ?? [];

  // Historique durées (chronologique, 14 nuits)
  const histNights = [...grid].reverse().map(d => ({ date: d, night: loggedMap.get(d) }));
  const durData = histNights.filter(h => h.night).map(h => ({
    label: frDay(h.date),
    value: +((h.night!.duration_min) / 60).toFixed(1),
  }));

  const selExisting = loggedMap.get(selDate);

  return (
    <div className="stack">
      <h1 className="heading-1">Sommeil</h1>

      {/* Dette + fenêtre mélatonine */}
      <div className="card-glass">
        <div className="section-label">Dette de sommeil · 14 nuits</div>
        <div className="row between">
          <div>
            <span className={`gauge ${debtColor}`}>{debtH}</span>
            <span className="body-sm" style={{ marginLeft: 6 }}>h de dette</span>
          </div>
          {curve && (
            <div className="stack" style={{ gap: 4, textAlign: 'right' }}>
              <span className="mono">Creux vers {curve.dipHour}h</span>
              <span className="body-sm">💤 {curve.melatoninWindow.start}h – {curve.melatoninWindow.end}h</span>
            </div>
          )}
        </div>
      </div>

      {/* Courbe circadienne */}
      {curvePoints.length > 0 && (
        <div className="card">
          <div className="section-label">Énergie circadienne — aujourd'hui</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
            {curvePoints.map(p => {
              const inMela = p.hour >= curve!.melatoninWindow.start || p.hour <= curve!.melatoninWindow.end;
              return (
                <span key={p.hour} style={{
                  flex: 1,
                  height: `${Math.max(4, p.energy)}%`,
                  background: p.hour === now ? 'var(--plasma)' : inMela ? 'rgba(232,184,109,0.35)' : 'rgba(123,191,234,0.28)',
                  boxShadow: p.hour === now ? '0 0 12px rgba(123,191,234,0.6)' : 'none',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s ease',
                }} title={`${p.hour}h — ${Math.round(p.energy)}%`} />
              );
            })}
          </div>
          <div className="row between" style={{ marginTop: 6 }}>
            <span className="label">6h</span>
            <span className="label" style={{ color: 'var(--plasma)' }}>maintenant</span>
            <span className="label">23h</span>
          </div>
        </div>
      )}

      {/* Grille de saisie 14 nuits */}
      <div className="card">
        <div className="section-label">Saisir mes nuits</div>
        <div className="sleep-grid">
          {grid.map(d => {
            const n = loggedMap.get(d);
            const h = n ? +(n.duration_min / 60).toFixed(1) : null;
            const ok = n ? n.duration_min >= need * 0.9 : false;
            return (
              <button key={d} onClick={() => selectNight(d)}
                className={`sleep-cell${selDate === d ? ' sleep-cell--sel' : ''}${n ? (ok ? ' sleep-cell--ok' : ' sleep-cell--low') : ''}`}>
                <span className="sleep-cell__day">{frDay(d)}</span>
                <span className="sleep-cell__val">{h !== null ? `${h}h` : '+'}</span>
              </button>
            );
          })}
        </div>

        {/* Formulaire pour la nuit sélectionnée */}
        <div className="stack" style={{ gap: 10, marginTop: 14 }}>
          <span className="body-sm">
            Nuit du <b className="text-ice">{new Date(addDays(selDate, -1)).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'short' })}</b> au <b className="text-ice">{new Date(selDate).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'short' })}</b>
            {selExisting ? <span className="badge badge--green" style={{ marginLeft: 8 }}>déjà saisie</span> : null}
          </span>
          <div className="grid grid-2">
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Coucher</span>
              <input className="input" type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} />
            </div>
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Réveil</span>
              <input className="input" type="time" value={wake} onChange={e => setWake(e.target.value)} />
            </div>
          </div>
          <button className={`btn full ${savedDate === selDate ? 'btn--secondary' : 'btn--primary'}`} onClick={logNight} disabled={saving}>
            {saving ? 'Enregistrement…' : savedDate === selDate ? '✓ Enregistré' : selExisting ? 'Mettre à jour' : 'Enregistrer la nuit'}
          </button>
        </div>
      </div>

      {/* Historique durées */}
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
          <span className="body-sm">Aucune nuit enregistrée — touche une case ci-dessus pour commencer.</span>
        </div>
      )}
    </div>
  );
}
