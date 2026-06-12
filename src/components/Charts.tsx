import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView, usePrefersReducedMotion } from './ui';

const W = 320;

interface SeriesProps {
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  fmt?: (v: number) => string;
}

/** Lissage type Catmull-Rom → courbe douce. */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i].x - pts[i - 1].x) * 0.42;
    d += ` C ${(pts[i - 1].x + dx).toFixed(1)},${pts[i - 1].y.toFixed(1)} ${(pts[i].x - dx).toFixed(1)},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
  }
  return d;
}

/** Courbe (aire + ligne) lissée, draw-on à l'entrée + tooltip au survol. */
export function LineChart({ data, labels, color = 'var(--pulse)', height = 90, fmt }: SeriesProps) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduce = usePrefersReducedMotion();
  const uid = useMemo(() => 'ln' + Math.random().toString(36).slice(2, 7), []);
  const lineRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => { if (lineRef.current) setLen(lineRef.current.getTotalLength()); }, [data, height]);

  if (!data.length) return <Empty />;

  const H = height, pad = 8, pB = labels ? 22 : 8;
  const max = Math.max(...data) * 1.05;
  const min = Math.min(...data, 0) * 0.98;
  const range = max - min || 1;
  const x = (i: number) => (data.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (data.length - 1));
  const y = (v: number) => pad + (1 - (v - min) / range) * (H - pad - pB);
  const pts = data.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)},${H - pB} L ${pts[0].x.toFixed(1)},${H - pB} Z`;
  const drawn = reduce || inView;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
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
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${uid})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }} />
        <path ref={lineRef} d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={len ? { strokeDasharray: len, strokeDashoffset: drawn ? 0 : len, transition: 'stroke-dashoffset 0.6s ease-out' } : undefined} />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill={color}
          style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.3s ease 0.55s' }} />
        {hover !== null && (
          <>
            <line x1={x(hover)} y1={pad} x2={x(hover)} y2={H - pB} stroke="var(--border-medium)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(data[hover])} r="3.5" fill={color} stroke="var(--bg-card)" strokeWidth="1.5" />
          </>
        )}
        {labels && labels.map((l, i) => {
          const idx = Math.round((i * (data.length - 1)) / (labels.length - 1));
          return <text key={i} x={x(idx)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)" fontFamily="Inter,sans-serif">{l}</text>;
        })}
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

/** Barres verticales — montée spring staggered + tooltip. */
export function BarChart({ data, color = 'var(--pulse)', height = 80, fmt }: { data: Bar[]; color?: string; height?: number; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduce = usePrefersReducedMotion();
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map(d => d.value), 1);
  const grown = reduce || inView;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const pct = Math.max(3, (d.value / max) * 100);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3, height: '100%' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div style={{
                width: '100%',
                height: grown ? `${pct}%` : '0%',
                background: isLast || hover === i ? color : `color-mix(in srgb, ${color} 45%, transparent)`,
                borderRadius: '4px 4px 2px 2px', minHeight: 3,
                transition: `height 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 50}ms, background 0.15s ease`,
              }} />
            </div>
          );
        })}
      </div>
      {data.some(d => d.label) && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {data.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{d.label}</span>)}
        </div>
      )}
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${((hover + 0.5) / data.length) * 100}%`, top: 0 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{data[hover].label} · </span>
          {fmt ? fmt(data[hover].value) : data[hover].value.toLocaleString('fr')}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <div className="body-sm" style={{ color: 'var(--text-tertiary)', padding: '12px 0' }}>Pas encore de données</div>;
}
