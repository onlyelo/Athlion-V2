import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

interface AthleteProfile {
  gender: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  ftp_w: number | null;
  lthr_bpm: number | null;
  vma_kmh: number | null;
  css_s_per_100m: number | null;
  vo2max: number | null;
}

interface SleepProfileData {
  sleep_need_min: number;
  chronotype: string;
}

export function ProfileView() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'metrics' | 'sleep'>('metrics');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<AthleteProfile | null>('/profile'),
  });

  const [metrics, setMetrics] = useState<Partial<AthleteProfile>>({});
  const [sleepPref, setSleepPref] = useState<SleepProfileData>({ sleep_need_min: 480, chronotype: 'neutral' });

  useEffect(() => {
    if (profile) setMetrics(profile);
  }, [profile]);

  function flash() {
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveMetrics() {
    setSaving(true);
    await api.put('/profile', metrics);
    qc.invalidateQueries({ queryKey: ['profile'] });
    flash();
  }

  async function saveSleep() {
    setSaving(true);
    await api.put('/profile/sleep', sleepPref);
    qc.invalidateQueries({ queryKey: ['sleep'] });
    flash();
  }

  const btnLabel = saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé' : 'Sauvegarder';

  return (
    <div className="stack">
      <h1 className="heading-1">Profil</h1>

      {/* Compte */}
      <div className="card-glass">
        <div className="section-label">Compte</div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="body-sm">Nom</span>
            <span className="mono">{user?.name}</span>
          </div>
          <div className="row between">
            <span className="body-sm">Email</span>
            <span className="mono">{user?.email}</span>
          </div>
          <div className="row between">
            <span className="body-sm">Rôle</span>
            <span className="badge badge--blue">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="row" style={{ gap: 8 }}>
        <button
          className={`btn ${tab === 'metrics' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => { setTab('metrics'); setSaved(false); }}
        >
          Métriques
        </button>
        <button
          className={`btn ${tab === 'sleep' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => { setTab('sleep'); setSaved(false); }}
        >
          Sommeil
        </button>
      </div>

      {tab === 'metrics' && (
        <div className="card">
          <div className="section-label">Métriques athlète</div>
          <div className="stack" style={{ gap: 10 }}>
            <NumField label="FTP (W)" value={metrics.ftp_w}
              onChange={v => setMetrics(m => ({ ...m, ftp_w: v }))} />
            <NumField label="FC seuil (bpm)" value={metrics.lthr_bpm}
              onChange={v => setMetrics(m => ({ ...m, lthr_bpm: v }))} />
            <NumField label="VMA (km/h)" value={metrics.vma_kmh} step={0.1}
              onChange={v => setMetrics(m => ({ ...m, vma_kmh: v }))} />
            <NumField label="CSS (s / 100m)" value={metrics.css_s_per_100m}
              onChange={v => setMetrics(m => ({ ...m, css_s_per_100m: v }))} />
            <NumField label="Poids (kg)" value={metrics.weight_kg} step={0.1}
              onChange={v => setMetrics(m => ({ ...m, weight_kg: v }))} />
            <NumField label="VO₂max" value={metrics.vo2max} step={0.1}
              onChange={v => setMetrics(m => ({ ...m, vo2max: v }))} />
            <button
              className={`btn full ${saved ? 'btn--secondary' : 'btn--primary'}`}
              onClick={saveMetrics}
              disabled={saving}
            >
              {btnLabel}
            </button>
          </div>
        </div>
      )}

      {tab === 'sleep' && (
        <div className="card">
          <div className="section-label">Profil sommeil</div>
          <div className="stack" style={{ gap: 10 }}>
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>
                Besoin de sommeil (h)
              </span>
              <input
                className="input"
                type="number"
                min={5}
                max={12}
                step={0.5}
                value={sleepPref.sleep_need_min / 60}
                onChange={e =>
                  setSleepPref(s => ({ ...s, sleep_need_min: Math.round(Number(e.target.value) * 60) }))
                }
              />
            </div>
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Chronotype</span>
              <select
                className="input"
                value={sleepPref.chronotype}
                onChange={e => setSleepPref(s => ({ ...s, chronotype: e.target.value }))}
              >
                <option value="early">Lève-tôt (matin)</option>
                <option value="neutral">Neutre</option>
                <option value="late">Couche-tard (soir)</option>
              </select>
            </div>
            <button
              className={`btn full ${saved ? 'btn--secondary' : 'btn--primary'}`}
              onClick={saveSleep}
              disabled={saving}
            >
              {btnLabel}
            </button>
          </div>
        </div>
      )}

      {/* Intégrations */}
      <div className="card">
        <div className="section-label">Intégrations</div>
        <div className="row between">
          <span className="body-md">Strava</span>
          <span className="badge badge--amber">Bientôt</span>
        </div>
        <hr className="divider" style={{ margin: '12px 0' }} />
        <div className="row between">
          <span className="body-md">Garmin (sommeil)</span>
          <span className="badge badge--amber">Phase 5</span>
        </div>
      </div>

      <button className="btn btn--danger full" onClick={logout}>
        Se déconnecter
      </button>
    </div>
  );
}

function NumField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  step?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>{label}</span>
      <input
        className="input"
        type="number"
        step={step}
        placeholder="—"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  );
}
