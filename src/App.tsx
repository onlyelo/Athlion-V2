import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { SleepView } from './features/sleep/SleepView';
import { PlanningView } from './features/planning/PlanningView';
import { NutritionView } from './features/nutrition/NutritionView';
import { CoachView } from './features/coach/CoachView';
import { ProfileView } from './features/profile/ProfileView';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center"><span className="label">Chargement…</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route index element={<DashboardView />} />
              <Route path="sleep" element={<SleepView />} />
              <Route path="planning" element={<PlanningView />} />
              <Route path="nutrition" element={<NutritionView />} />
              <Route path="coach" element={<CoachView />} />
              <Route path="profile" element={<ProfileView />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
