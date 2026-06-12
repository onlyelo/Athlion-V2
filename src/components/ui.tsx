import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/* ── Hook count-up (0 → valeur, easing cubicOut) ─────────────────── */
export function useCountUp(target: number, duration = 800, delay = 100) {
  const [val, setVal] = useState(0);
  const reduce = usePrefersReducedMotion();
  useEffect(() => {
    if (reduce) { setVal(target); return; }
    if (!Number.isFinite(target)) { setVal(0); return; }
    let raf = 0;
    let start: number | undefined;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (start === undefined) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(easeOut(p) * target);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const id = window.setTimeout(() => { raf = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [target, duration, delay, reduce]);
  return val;
}

export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/* ── Skeleton ────────────────────────────────────────────────────── */
export function Skeleton({ w = '100%', h = 14, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/* ── Badge / Chip / Segmented (versions React) ───────────────────── */
type BadgeVariant = 'blue' | 'green' | 'orange' | 'violet' | 'red' | 'gray';
export function Badge({ children, variant = 'blue' }: { children: ReactNode; variant?: BadgeVariant }) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return <button type="button" className={`chip${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}

type SegOption<T extends string> = T | { value: T; label: ReactNode };
export function Segmented<T extends string>({ options, value, onChange }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => {
        const v = (typeof o === 'object' ? o.value : o) as T;
        const l = typeof o === 'object' ? o.label : o;
        return (
          <button key={v} type="button" className={`seg-btn${value === v ? ' active' : ''}`} onClick={() => onChange(v)}>{l}</button>
        );
      })}
    </div>
  );
}

/* ── Sparkline (72×24) ───────────────────────────────────────────── */
export function Sparkline({ data, color = 'var(--pulse)', w = 72, h = 24 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const uid = useMemo(() => 'sk' + Math.random().toString(36).slice(2, 7), []);
  if (!data || data.length < 2) return <div style={{ height: h }} />;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / (max - min || 1)) * h }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── MetricCard (tuile métrique avec count-up + sparkline) ───────── */
export function MetricCard({ label, value, unit, delta, deltaPos, sparkData, color = 'var(--pulse)', decimals = 0, animate = true }: {
  label: string; value: number | string; unit?: string; delta?: string; deltaPos?: boolean;
  sparkData?: number[]; color?: string; decimals?: number; animate?: boolean;
}) {
  const isNum = typeof value === 'number';
  const counted = useCountUp(isNum && animate ? (value as number) : 0);
  const display = isNum
    ? (animate ? counted : (value as number)).toLocaleString('fr', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
    : value;
  return (
    <div className="stat-tile">
      <div className="stat-tile__top">
        <span className="stat-tile__label">{label}</span>
        {delta !== undefined && (
          <span className={`delta-chip ${deltaPos ? 'delta-chip--up' : 'delta-chip--down'}`}>{deltaPos ? '↑' : '↓'} {delta}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="stat-tile__value">{display}</span>
        {unit && <span className="stat-tile__unit">{unit}</span>}
      </div>
      {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
    </div>
  );
}

/* ── CircularGauge (readiness) ───────────────────────────────────── */
export function CircularGauge({ value = 0, label = 'Forme du jour' }: { value?: number; label?: string }) {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    let raf = 0; let start: number | undefined;
    const dur = 1200; const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (start === undefined) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setShown(easeOut(p) * value);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const id = window.setTimeout(() => { raf = requestAnimationFrame(step); }, 300);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [value, reduce]);

  const r = 80, circ = 2 * Math.PI * r, fill = circ * (Math.max(0, Math.min(100, shown)) / 100);
  const color = value >= 80 ? 'var(--energy)' : value >= 60 ? 'var(--pulse)' : 'var(--effort)';
  const statusBg = value >= 80 ? 'var(--energy-soft)' : value >= 60 ? 'var(--pulse-soft)' : 'var(--effort-soft)';
  const statusTxt = value >= 80 ? 'Frais — Go ✓' : value >= 60 ? 'Correct' : value >= 40 ? 'Fatigue' : 'Repos conseillé';
  const rounded = Math.round(shown);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width="180" height="180" viewBox="0 0 200 200" role="img" aria-label={`Readiness ${Math.round(value)} sur 100`}>
        <title>Readiness {Math.round(value)}/100 — {statusTxt}</title>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} transform="rotate(-90 100 100)" />
        <text x="100" y="96" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="46" fontWeight="700" fill="var(--text-primary)" style={{ fontVariantNumeric: 'tabular-nums' }}>{rounded}</text>
        <text x="100" y="118" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="13" fill="var(--text-secondary)">/ 100</text>
      </svg>
      <div style={{ background: statusBg, padding: '5px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, color }}>{statusTxt}</div>
      <span className="label">{label}</span>
    </div>
  );
}

/* ── Hook : déclenche quand l'élément entre dans le viewport ─────── */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}
