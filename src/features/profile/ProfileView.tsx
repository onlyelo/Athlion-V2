import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ACCENTS, type Accent } from '../../contexts/ThemeContext';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge, Segmented } from '../../components/ui';

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

interface SleepProfileData { sleep_need_min: number; chronotype: string; }

const initials = (name?: string) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export function ProfileView() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'metrics' | 'sleep'>('metrics');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<AthleteProfile | null>('/profile') });

  const [metrics, setMetrics] = useState<Partial<AthleteProfile>>({});
  const [sleepPref, setSleepPref] = useState<SleepProfileData>({ sleep_need_min: 480, chronotype: 'neutral' });

  useEffect(() => { if (profile) setMetrics(profile); }, [profile]);

  function flash() { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  async function saveMetrics() { setSaving(true); await api.put('/profile', metrics); qc.invalidateQueries({ queryKey: ['profile'] }); flash(); }
  async function saveSleep() { setSaving(true); await api.put('/profile/sleep', sleepPref); qc.invalidateQueries({ queryKey: ['sleep'] }); flash(); }

  const btnLabel = saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé' : 'Sauvegarder';

  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 className="heading-1">Profil</h1>

      {/* Carte compte */}
      <div className="card-hero profile-card">
        <div className="profile-avatar">{initials(user?.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', marginBottom: 3 }}>{user?.name}</div>
          <div className="body-sm" style={{ marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          {user?.role && <Badge variant="blue">{user.role}</Badge>}
        </div>
      </div>

      {/* Onglets Métriques / Sommeil */}
      <Segmented
        options={[{ value: 'metrics', label: 'Métriques' }, { value: 'sleep', label: 'Sommeil' }]}
        value={tab}
        onChange={(v) => { setTab(v); setSaved(false); }}
      />

      {tab === 'metrics' ? (
        <div className="card">
          <NumField label="FTP (W)" value={metrics.ftp_w} onChange={v => setMetrics(m => ({ ...m, ftp_w: v }))} />
          <NumField label="FC seuil (bpm)" value={metrics.lthr_bpm} onChange={v => setMetrics(m => ({ ...m, lthr_bpm: v }))} />
          <NumField label="VMA (km/h)" value={metrics.vma_kmh} step={0.1} onChange={v => setMetrics(m => ({ ...m, vma_kmh: v }))} />
          <NumField label="CSS (s / 100m)" value={metrics.css_s_per_100m} onChange={v => setMetrics(m => ({ ...m, css_s_per_100m: v }))} />
          <NumField label="Poids (kg)" value={metrics.weight_kg} step={0.1} onChange={v => setMetrics(m => ({ ...m, weight_kg: v }))} />
          <NumField label="VO₂max" value={metrics.vo2max} step={0.1} onChange={v => setMetrics(m => ({ ...m, vo2max: v }))} />
          <button className={`btn full ${saved ? 'btn--secondary' : 'btn--primary'}`} style={{ marginTop: 14 }} onClick={saveMetrics} disabled={saving}>{btnLabel}</button>
        </div>
      ) : (
        <div className="card">
          <div className="metric-row" style={{ display: 'block' }}>
            <span className="body-sm" style={{ display: 'block', marginBottom: 8 }}>Besoin de sommeil (h)</span>
            <input className="input input--box" type="number" min={5} max={12} step={0.5}
              value={sleepPref.sleep_need_min / 60}
              onChange={e => setSleepPref(s => ({ ...s, sleep_need_min: Math.round(Number(e.target.value) * 60) }))} />
          </div>
          <div style={{ padding: '12px 0' }}>
            <span className="body-sm" style={{ display: 'block', marginBottom: 8 }}>Chronotype</span>
            <Segmented
              options={[{ value: 'early', label: 'Lève-tôt' }, { value: 'neutral', label: 'Neutre' }, { value: 'late', label: 'Couche-tard' }]}
              value={sleepPref.chronotype}
              onChange={(v) => setSleepPref(s => ({ ...s, chronotype: v }))}
            />
          </div>
          <button className={`btn full ${saved ? 'btn--secondary' : 'btn--primary'}`} style={{ marginTop: 8 }} onClick={saveSleep} disabled={saving}>{btnLabel}</button>
        </div>
      )}

      {/* Apparence */}
      <AppearanceSettings />

      {/* Intégrations */}
      <div className="section-label">Intégrations</div>
      <StravaCard />
      <GarminCard />

      <button className="btn btn--danger full" onClick={logout} style={{ marginTop: 4 }}>
        <Icon name="logout" size={16} /> Se déconnecter
      </button>
    </div>
  );
}

/* ── Apparence : thème + accents ─────────────────────────────────── */
function AppearanceSettings() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  return (
    <div className="card">
      <div className="section-label">Apparence</div>
      <div className="setting-row">
        <label>Thème</label>
        <div style={{ width: 200 }}>
          <Segmented
            options={[{ value: 'dark', label: '🌙 Sombre' }, { value: 'light', label: '☀️ Clair' }]}
            value={theme}
            onChange={setTheme}
          />
        </div>
      </div>
      <div className="setting-row">
        <label>Couleur d'accent</label>
        <div className="accent-swatches">
          {ACCENTS.map((a: Accent) => (
            <button key={a} type="button" aria-label={a} className={`swatch swatch--${a}${accent === a ? ' active' : ''}`} onClick={() => setAccent(a)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Strava ──────────────────────────────────────────────────────── */
function StravaCard() {
  const { data: status } = useQuery({ queryKey: ['strava-status'], queryFn: () => api.get<{ connected: boolean; cached: number; last_sync: string | null }>('/strava/status') });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function connect() { const { url } = await api.get<{ url: string }>('/strava/connect'); window.location.href = url; }
  async function sync() { setBusy(true); try { await api.post('/strava/sync'); await qc.invalidateQueries({ queryKey: ['strava-status'] }); await qc.invalidateQueries({ queryKey: ['strava-summary'] }); await qc.invalidateQueries({ queryKey: ['dashboard'] }); } finally { setBusy(false); } }

  return (
    <div className="card row between">
      <div className="row" style={{ gap: 12 }}>
        <div className="integration-logo" style={{ background: '#FC4C02' }}>S</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Strava</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: status?.connected ? 'var(--energy-dark)' : 'var(--text-tertiary)' }}>
            {status?.connected ? `✓ Connecté · ${status.cached} activités` : 'Non connecté'}
          </div>
        </div>
      </div>
      {status?.connected
        ? <button className="btn btn--secondary btn--sm" onClick={sync} disabled={busy}>{busy ? <span className="spin" /> : <><Icon name="refresh" size={13} /> Sync</>}</button>
        : <button className="btn btn--primary btn--sm" onClick={connect}>Connecter</button>}
    </div>
  );
}

/* ── Garmin (logique inchangée, en-tête restylé) ─────────────────── */
function GarminCard() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [mfaSession, setMfaSession] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const { data } = useQuery({
    queryKey: ['garmin-status'],
    queryFn: () => api.get<{ connected: boolean; profile_name: string | null; last_sync_at: string | null }>('/garmin/status'),
  });

  function refetchSleep() {
    qc.invalidateQueries({ queryKey: ['garmin-status'] });
    qc.invalidateQueries({ queryKey: ['sleep'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  }

  async function connect() {
    setBusy(true); setMsg(null); setErr(false);
    try {
      const r = await api.post<{ connected?: boolean; imported?: number; mfa_required?: boolean; session_id?: string }>('/garmin/connect', { email, password });
      if (r.mfa_required && r.session_id) { setMfaSession(r.session_id); setMsg('Garmin t’a envoyé un code de vérification — saisis-le ci-dessous.'); return; }
      setPassword(''); setMsg(`Connecté — ${r.imported} nuits importées.`); refetchSleep();
    } catch (e) { setErr(true); setMsg(e instanceof Error ? e.message : 'Échec de connexion.'); }
    finally { setBusy(false); }
  }
  async function submitMfa() {
    setBusy(true); setErr(false);
    try { const r = await api.post<{ imported: number }>('/garmin/mfa', { session_id: mfaSession, code }); setMfaSession(null); setCode(''); setPassword(''); setMsg(`Connecté — ${r.imported} nuits importées.`); refetchSleep(); }
    catch (e) { setErr(true); setMsg(e instanceof Error ? e.message : 'Code invalide.'); }
    finally { setBusy(false); }
  }
  async function sync() {
    setBusy(true); setErr(false);
    try { const r = await api.post<{ imported: number }>('/garmin/sync'); setMsg(`${r.imported} nuits synchronisées.`); refetchSleep(); }
    catch (e) { setErr(true); setMsg(e instanceof Error ? e.message : 'Échec.'); }
    finally { setBusy(false); }
  }
  async function disconnect() { await api.del('/garmin/disconnect').catch(() => {}); setMsg(null); qc.invalidateQueries({ queryKey: ['garmin-status'] }); }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="integration-logo" style={{ background: '#1F3167' }}><Icon name="watch" size={18} color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Garmin · Sommeil</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: data?.connected ? 'var(--energy-dark)' : 'var(--text-tertiary)' }}>
              {data?.connected ? `✓ ${data.profile_name || 'Connecté'}` : 'Non connecté'}
            </div>
          </div>
        </div>
      </div>

      {data?.connected ? (
        <div className="stack" style={{ gap: 10 }}>
          {data.last_sync_at && (
            <div className="row between" style={{ paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
              <span className="body-sm">Dernière synchro</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(data.last_sync_at).toLocaleString('fr')}</span>
            </div>
          )}
          {msg && <span className={`body-sm ${err ? 'text-danger' : 'text-pulse'}`}>{msg}</span>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--secondary btn--sm full" onClick={sync} disabled={busy}>{busy ? <span className="spin" /> : <><Icon name="refresh" size={13} /> Synchroniser</>}</button>
            <button className="btn btn--danger btn--sm full" onClick={disconnect}>Déconnecter</button>
          </div>
        </div>
      ) : mfaSession ? (
        <div className="stack" style={{ gap: 8 }}>
          <span className="body-sm">🔐 Double authentification — entre le code reçu (SMS, email ou appli).</span>
          <input className="input input--box" inputMode="numeric" placeholder="Code de vérification" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitMfa(); }} autoFocus />
          {msg && <span className={`body-sm ${err ? 'text-danger' : 'text-pulse'}`}>{msg}</span>}
          <button className="btn btn--primary full" onClick={submitMfa} disabled={busy || !code}>{busy ? <span className="spin" /> : 'Valider le code'}</button>
          <button className="btn btn--ghost btn--sm" onClick={() => { setMfaSession(null); setCode(''); setMsg(null); }}>Annuler</button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <span className="body-sm">Importe ton sommeil réel (durée, phases, FC repos) depuis ton compte Garmin Connect.</span>
          <input className="input input--box" type="email" placeholder="Email Garmin" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input input--box" type="password" placeholder="Mot de passe Garmin" value={password} onChange={e => setPassword(e.target.value)} />
          {msg && <span className={`body-sm ${err ? 'text-danger' : 'text-pulse'}`}>{msg}</span>}
          <button className="btn btn--primary full" onClick={connect} disabled={busy || !email || !password}>{busy ? <span className="spin" /> : <><Icon name="watch" size={15} /> Connecter Garmin</>}</button>
          <span className="body-sm" style={{ color: 'var(--text-tertiary)' }}>🔒 Tes identifiants servent uniquement à obtenir un jeton sécurisé ; le mot de passe n'est jamais conservé. La double authentification est gérée.</span>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, step = 1, onChange }: { label: string; value: number | null | undefined; step?: number; onChange: (v: number | null) => void }) {
  return (
    <div className="metric-row">
      <span className="body-sm">{label}</span>
      <input
        className="input"
        type="number" step={step} placeholder="—"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        style={{ width: 110, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}
      />
    </div>
  );
}
