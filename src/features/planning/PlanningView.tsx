import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface TrainingSession {
  id: string;
  date: string;
  sport: string | null;
  name: string | null;
  status: string;
  duration_min: number | null;
  distance_m: number | null;
  tss: number | null;
  intensity_zone: string | null;
  completion_ratio: number | null;
}

const SPORT_ICON: Record<string, string> = { run: '🏃', bike: '🚴', swim: '🏊', strength: '💪' };
const SPORT_CSS: Record<string, string> = { run: 'run', bike: 'bike', swim: 'swim', strength: 'nutrition' };
const STATUS_BADGE: Record<string, string> = {
  planned: 'badge--blue',
  completed: 'badge--green',
  missed: 'badge--red',
  partial: 'badge--amber',
};
const STATUS_FR: Record<string, string> = {
  planned: 'planifiée',
  completed: 'terminée',
  missed: 'manquée',
  partial: 'partielle',
};

export function PlanningView() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: today,
    sport: 'run',
    name: '',
    duration_min: 60,
    intensity_zone: 'Z2',
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<TrainingSession[]>('/training/sessions'),
  });

  async function addSession() {
    setSaving(true);
    await api.post('/training/sessions', { ...form, name: form.name || undefined });
    await qc.invalidateQueries({ queryKey: ['sessions'] });
    await qc.invalidateQueries({ queryKey: ['dashboard'] });
    setAdding(false);
    setSaving(false);
    setForm(f => ({ ...f, name: '', date: today }));
  }

  const sorted = sessions ? [...sessions].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const upcoming = sorted.filter(s => s.date >= today && s.status === 'planned');
  const past = sorted.filter(s => s.date < today || s.status !== 'planned');

  return (
    <div className="stack">
      <div className="row between">
        <h1 className="heading-1">Planning</h1>
        <button
          className={`btn btn--sm ${adding ? 'btn--ghost' : 'btn--primary'}`}
          onClick={() => setAdding(a => !a)}
        >
          {adding ? 'Annuler' : '+ Séance'}
        </button>
      </div>

      {/* Formulaire ajout */}
      {adding && (
        <div className="card">
          <div className="section-label">Nouvelle séance</div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="grid grid-2">
              <div>
                <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Sport</span>
                <select
                  className="input"
                  value={form.sport}
                  onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
                >
                  <option value="run">Course à pied</option>
                  <option value="bike">Vélo</option>
                  <option value="swim">Natation</option>
                  <option value="strength">Renforcement</option>
                </select>
              </div>
            </div>
            <div>
              <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>
                Nom de la séance
              </span>
              <input
                className="input"
                placeholder="ex : Footing Z2, Seuil 4×1km…"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-2">
              <div>
                <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Durée (min)</span>
                <input
                  className="input"
                  type="number"
                  min={5}
                  value={form.duration_min}
                  onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))}
                />
              </div>
              <div>
                <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Zone</span>
                <select
                  className="input"
                  value={form.intensity_zone}
                  onChange={e => setForm(f => ({ ...f, intensity_zone: e.target.value }))}
                >
                  {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(z => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              className="btn btn--primary full"
              onClick={addSession}
              disabled={saving}
            >
              {saving ? 'Ajout…' : 'Ajouter la séance'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <span className="label">Chargement…</span>}

      {/* Séances à venir */}
      {upcoming.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 0 }}>À venir</div>
          <div className="stack" style={{ gap: 8 }}>
            {upcoming.map(s => <SessionRow key={s.id} s={s} />)}
          </div>
        </>
      )}

      {/* Historique */}
      {past.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 0 }}>Historique · 28j</div>
          <div className="stack" style={{ gap: 8 }}>
            {past.slice(0, 20).map(s => <SessionRow key={s.id} s={s} />)}
          </div>
        </>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <span className="body-sm">Aucune séance sur les 28 derniers jours.</span>
          <br />
          <span className="body-sm" style={{ color: 'var(--text-muted)' }}>
            Planifie ta première séance ci-dessus.
          </span>
        </div>
      )}
    </div>
  );
}

function SessionRow({ s }: { s: TrainingSession }) {
  const sport = s.sport ?? 'run';
  const km = s.distance_m ? (s.distance_m / 1000).toFixed(1) : null;

  return (
    <div className="activity-item">
      <div className={`activity-icon activity-icon--${SPORT_CSS[sport] ?? 'run'}`}>
        {SPORT_ICON[sport] ?? '🏅'}
      </div>
      <div className="activity-info">
        <div className="activity-title">{s.name || sport}</div>
        <div className="activity-sub">
          {s.date}
          {s.duration_min ? ` · ${s.duration_min} min` : ''}
          {km ? ` · ${km} km` : ''}
          {s.intensity_zone ? ` · ${s.intensity_zone}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge--blue'}`}>
          {STATUS_FR[s.status] ?? s.status}
        </span>
        {s.tss != null && (
          <span className="mono" style={{ fontSize: 11 }}>TSS {Math.round(s.tss)}</span>
        )}
        {s.completion_ratio != null && (
          <span className="mono" style={{ fontSize: 11 }}>
            {Math.round(s.completion_ratio * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
