import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { DashboardData } from '../../types';

export function DashboardView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
  });

  if (isLoading) return <span className="label">Chargement de l'état…</span>;
  if (error) return <span className="badge badge--red">Erreur de chargement</span>;
  if (!data) return null;

  const { state, totals, history } = data;
  const km = (Number(totals.total_distance_m) / 1000).toFixed(0);
  const hours = Math.round(totals.total_duration_min / 60);
  const maxCtl = Math.max(1, ...history.map((h) => Number(h.ctl)));

  return (
    <div className="stack">
      {/* Readiness */}
      <div className="card-glass">
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

      {/* Charge */}
      <div className="grid grid-2">
        <Metric label="Fitness (CTL)" value={state.ctl} color="blue" />
        <Metric label="Fatigue (ATL)" value={state.atl} color="amber" />
        <Metric label="Dette sommeil" value={`${Math.round(state.sleep_debt_min / 60)}`} unit="h" color="red" />
        <Metric label="Forme (TSB)" value={state.tsb} color="green" />
      </div>

      {/* Totaux cumulés */}
      <div className="card">
        <div className="section-label">Cumul</div>
        <div className="row between">
          <Tot value={km} unit="km" label="Distance" />
          <Tot value={`${hours}`} unit="h" label="Durée" />
          <Tot value={`${totals.total_sessions}`} unit="" label="Séances" />
        </div>
      </div>

      {/* Historique charge (14j) */}
      <div className="card">
        <div className="section-label">Charge — 14 jours</div>
        <div className="spark">
          {history.map((h) => (
            <span key={h.date} style={{ height: `${(Number(h.ctl) / maxCtl) * 100}%` }} title={`${h.date} · CTL ${h.ctl}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, color }: { label: string; value: number | string; unit?: string; color: string }) {
  return (
    <div className={`metric-card metric-card--${color}`}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}<span className="metric-card__unit">{unit}</span></div>
    </div>
  );
}

function Tot({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="heading-1">{value}<span className="metric-card__unit">{unit}</span></div>
      <span className="label">{label}</span>
    </div>
  );
}

function readinessLabel(r: number) {
  if (r >= 75) return 'Frais — go';
  if (r >= 50) return 'Correct';
  if (r >= 30) return 'Fatigue';
  return 'Repos conseillé';
}
