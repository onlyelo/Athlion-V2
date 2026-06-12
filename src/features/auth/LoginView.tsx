import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function LoginView() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de connexion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center" style={{ alignItems: 'stretch', justifyItems: 'stretch', placeItems: 'center' }}>
      <div className="login-wrap">
        <div style={{ marginBottom: 48 }}>
          <div className="login-logo">A</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Athlion</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>Coaching endurance piloté par tes données</p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 40 }}>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 8 }}>Email</label>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 8 }}>Mot de passe</label>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <span className="badge badge--red" style={{ alignSelf: 'flex-start' }}>{error}</span>}
            <button className="btn btn--primary btn--full" disabled={busy} type="submit">
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>Accès réservé · coaching Athlion</p>
          </div>
        </form>
      </div>
    </div>
  );
}
