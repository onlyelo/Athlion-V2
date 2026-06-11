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
    <div className="center">
      <div className="card-glass login-card">
        <div className="app__brand mt-lg" style={{ justifyContent: 'center' }}>
          <img src="/logo-athlion.png" alt="" />
          Athlion
        </div>
        <p className="body-sm" style={{ textAlign: 'center', marginTop: 4 }}>
          Coaching endurance piloté par tes données
        </p>

        <form onSubmit={submit} className="stack mt-xl">
          <div>
            <label className="label">Email</label>
            <input className="input mt-lg" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input mt-lg" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <span className="badge badge--red">{error}</span>}
          <button className="btn btn--primary btn--lg full mt-lg" disabled={busy} type="submit">
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
