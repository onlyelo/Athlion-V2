export function Placeholder({ title, phase, desc }: { title: string; phase: string; desc: string }) {
  return (
    <div className="stack">
      <div className="row between">
        <h1 className="heading-1">{title}</h1>
        <span className="badge badge--blue">{phase}</span>
      </div>
      <div className="card-glass">
        <p className="body-md text-secondary">{desc}</p>
      </div>
    </div>
  );
}
