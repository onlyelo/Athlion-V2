import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

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

export function SleepView() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().getHours();
  const [form, setForm] = useState({ date: today, bedtime: '22:30', wake_time: '06:30' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sleep'],
    queryFn: () => api.get<SleepData>('/sleep'),
  });

  async function logNight() {
    setSaving(true);
    const [bh, bm] = form.bedtime.split(':').map(Number);
    const [wh, wm] = form.wake_time.split(':').map(Number);
    let bedMins = bh * 60 + bm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= bedMins) wakeMins += 24 * 60;
    const duration_min = wakeMins - bedMins;
    await api.post('/sleep', { ...form, duration_min });
    await qc.invalidateQueries({ queryKey: ['sleep'] });
    await qc.invalidateQueries({ queryKey: ['dashboard'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (isLoading) return <span className="label">Chargement…</span>;

  const debtH = data ? +(data.sleep_debt_min / 60).toFixed(1) : 0;
  const debtColor = debtH > 3 ? 'text-danger' : debtH > 1 ? 'text-warning' : 'text-success';
  const curve = data?.energy_curve;
  const curvePoints = curve?.points.filter(p => p.hour >= 6 && p.hour <= 23) ?? [];

  return (
    <div className="stack">
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
              <span className="mono">Creux à {curve.dipHour}h</span>
              <span className="body-sm">
                Mélatonine {curve.melatoninWindow.start}h – {curve.melatoninWindow.end}h
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Courbe circadienne */}
      {curvePoints.length > 0 && (
        <div className="card">
          <div className="section-label">Énergie circadienne — aujourd'hui</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
            {curvePoints.map(p => (
              <span
                key={p.hour}
                style={{
                  flex: 1,
                  height: `${Math.max(4, p.energy)}%`,
                  background: p.hour === now
                    ? 'var(--plasma)'
                    : p.hour >= (curve!.melatoninWindow.start) || p.hour <= (curve!.melatoninWindow.end)
                      ? 'rgba(232,184,109,0.35)'
                      : 'rgba(123,191,234,0.30)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.3s ease',
                }}
                title={`${p.hour}h — ${Math.round(p.energy)}%`}
              />
            ))}
          </div>
          <div className="row between" style={{ marginTop: 6 }}>
            <span className="label">6h</span>
            <span className="label" style={{ color: 'var(--plasma)' }}>maintenant</span>
            <span className="label">23h</span>
          </div>
        </div>
      )}

      {/* Formulaire saisie */}
      <div className="card">
        <div className="section-label">Enregistrer une nuit</div>
        <div className="stack" style={{ gap: 10 }}>
          <div>
            <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Date du réveil</span>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="grid grid-2">
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Coucher</span>
              <input
                className="input"
                type="time"
                value={form.bedtime}
                onChange={e => setForm(f => ({ ...f, bedtime: e.target.value }))}
              />
            </div>
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Réveil</span>
              <input
                className="input"
                type="time"
                value={form.wake_time}
                onChange={e => setForm(f => ({ ...f, wake_time: e.target.value }))}
              />
            </div>
          </div>
          <button
            className={`btn full ${saved ? 'btn--secondary' : 'btn--primary'}`}
            onClick={logNight}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer la nuit'}
          </button>
        </div>
      </div>

      {/* Historique nuits */}
      {data && data.nights.length > 0 && (
        <div className="card">
          <div className="section-label">Nuits récentes</div>
          <div className="stack" style={{ gap: 8 }}>
            {data.nights.slice(0, 10).map(n => {
              const h = +(n.duration_min / 60).toFixed(1);
              const ok = n.duration_min >= data.profile.sleep_need_min * 0.9;
              return (
                <div key={n.date} className="row between">
                  <span className="body-sm">{n.date}</span>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="body-sm">
                      {n.bedtime ? new Date(n.bedtime).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      {' → '}
                      {n.wake_time ? new Date(n.wake_time).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <span className={`mono ${ok ? 'text-success' : 'text-danger'}`}>{h}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && data.nights.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <span className="body-sm">Aucune nuit enregistrée — commence par ajouter hier soir.</span>
        </div>
      )}
    </div>
  );
}
