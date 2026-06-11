import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface CoachMsg { role: 'user' | 'coach'; content: string; created_at: string; }
interface CoachData {
  cadence: 'day' | '3days';
  last_analysis_at: string | null;
  due: boolean;
  messages: CoachMsg[];
  insights: Array<{ scope: string; content: string; questions: string[]; created_at: string }>;
}

export function CoachView() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({ queryKey: ['coach'], queryFn: () => api.get<CoachData>('/coach') });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data?.messages.length, busy, analyzing]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setBusy(true);
    // Optimiste : on affiche le message tout de suite
    qc.setQueryData<CoachData>(['coach'], (d) => d ? { ...d, messages: [...d.messages, { role: 'user', content: message, created_at: new Date().toISOString() }] } : d);
    try {
      await api.post('/coach/chat', { message });
      await qc.invalidateQueries({ queryKey: ['coach'] });
    } finally { setBusy(false); }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      await api.post('/coach/analyze');
      await qc.invalidateQueries({ queryKey: ['coach'] });
    } finally { setAnalyzing(false); }
  }

  async function setCadence(cadence: 'day' | '3days') {
    qc.setQueryData<CoachData>(['coach'], (d) => d ? { ...d, cadence } : d);
    await api.put('/coach/settings', { cadence });
  }

  if (isLoading) return <span className="label">Chargement du coach…</span>;
  const messages = data?.messages ?? [];

  return (
    <div className="stack">
      <div className="row between">
        <h1 className="heading-1">Coach IA</h1>
        <div className="segmented">
          <button className={`seg-btn${data?.cadence === 'day' ? ' seg-btn--active' : ''}`} onClick={() => setCadence('day')}>Quotidien</button>
          <button className={`seg-btn${data?.cadence === '3days' ? ' seg-btn--active' : ''}`} onClick={() => setCadence('3days')}>Tous les 3j</button>
        </div>
      </div>

      {/* Analyse récurrente */}
      <div className="card-glass">
        <div className="row between">
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Analyse {data?.cadence === '3days' ? '/ 3 jours' : 'quotidienne'}</div>
            <span className="body-sm">
              {data?.last_analysis_at ? `Dernière : ${new Date(data.last_analysis_at).toLocaleDateString('fr')}` : 'Jamais analysée'}
              {data?.due ? ' · à faire' : ''}
            </span>
          </div>
          <button className={`btn btn--sm ${data?.due ? 'btn--primary' : 'btn--glass'}`} onClick={analyze} disabled={analyzing}>
            {analyzing ? <span className="spin" /> : '✦ Analyser'}
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div className="stack" style={{ gap: 10 }}>
        {messages.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <span className="body-sm">Pose une question à ton coach, ou lance une analyse.<br />Il connaît ta charge, ton sommeil et tes séances.</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.role}`}>
            <Rich text={m.content} />
          </div>
        ))}
        {(busy || analyzing) && (
          <div className="bubble bubble--coach"><span className="spin" /> <span className="body-sm" style={{ marginLeft: 6 }}>le coach réfléchit…</span></div>
        )}
        <div ref={endRef} />
      </div>

      {/* Saisie */}
      <div className="coach-input">
        <input
          className="input"
          placeholder="Demande conseil à ton coach…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn btn--primary" onClick={send} disabled={busy || !input.trim()}>➤</button>
      </div>
    </div>
  );
}

/** Rendu texte avec **gras** et sauts de ligne. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} style={{ margin: i ? '4px 0 0' : 0 }}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-plasma">{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>
          )}
        </p>
      ))}
    </>
  );
}
