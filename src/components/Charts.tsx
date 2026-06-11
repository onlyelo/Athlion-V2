import { useState } from 'react';

const W = 320;

interface SeriesProps {
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  fmt?: (v: number) => string;
}

/** Courbe (aire + ligne) interactive avec tooltip au survol. */
export function LineChart({ data, labels, color = 'var(--plasma)', height = 90, fmt }: SeriesProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;

  const H = height;
  const pad = 8;
  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const x = (i: number) => (data.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (data.length - 1));
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);
  const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${H - pad} ${line} ${x(data.length - 1).toFixed(1)},${H - pad}`;
  const gid = `g${Math.round(min)}_${Math.round(max)}_${data.length}`;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - r.left) / r.width;
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1)))));
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <>
            <line x1={x(hover)} y1={pad} x2={x(hover)} y2={H - pad}
              stroke="var(--glass-border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(data[hover])} r="3.5" fill={color}
              stroke="var(--void)" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}>
          {labels?.[hover] ? <span style={{ color: 'var(--text-secondary)' }}>{labels[hover]} · </span> : null}
          {fmt ? fmt(data[hover]) : data[hover].toLocaleString('fr')}
        </div>
      )}
    </div>
  );
}

interface Bar { label: string; value: number; }

/** Barres verticales interactives. */
export function BarChart({ data, color = 'var(--plasma)', height = 90, fmt }: { data: Bar[]; color?: string; height?: number; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div style={{
              height: `${Math.max(2, (d.value / max) * 100)}%`,
              background: hover === i ? color : `color-mix(in srgb, ${color} 65%, transparent)`,
              borderRadius: '3px 3px 0 0',
              transition: 'background 0.15s ease',
            }} />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="chart-tooltip"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%`, top: 0 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{data[hover].label} · </span>
          {fmt ? fmt(data[hover].value) : data[hover].value.toLocaleString('fr')}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <div className="body-sm" style={{ color: 'var(--text-muted)', padding: '12px 0' }}>Pas encore de données</div>;
}
