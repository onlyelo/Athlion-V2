import { useAuth } from '../../contexts/AuthContext';

export function ProfileView() {
  const { user, logout } = useAuth();
  return (
    <div className="stack">
      <h1 className="heading-1">Profil</h1>

      <div className="card-glass">
        <div className="section-label">Compte</div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row between"><span className="body-sm">Nom</span><span className="mono">{user?.name}</span></div>
          <div className="row between"><span className="body-sm">Email</span><span className="mono">{user?.email}</span></div>
          <div className="row between"><span className="body-sm">Rôle</span><span className="badge badge--blue">{user?.role}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="section-label">Intégrations</div>
        <div className="row between">
          <span className="body-md">Strava</span>
          <span className="badge badge--amber">Bientôt</span>
        </div>
        <hr className="divider" style={{ margin: '12px 0' }} />
        <div className="row between">
          <span className="body-md">Garmin (sommeil)</span>
          <span className="badge badge--amber">Phase 5</span>
        </div>
      </div>

      <button className="btn btn--danger full" onClick={logout}>Se déconnecter</button>
    </div>
  );
}
