import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ReservationsPage } from '@/pages/ReservationsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialize, initialized]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/floor-plan" element={<Placeholder title="Tloris" desc="Floor plan editor - coming next" />} />
          <Route path="/guests" element={<Placeholder title="Gosti" desc="Guest CRM - coming next" />} />
          <Route path="/waitlist" element={<Placeholder title="Čakalna vrsta" desc="Waitlist management - coming next" />} />
          <Route path="/settings" element={<Placeholder title="Nastavitve" desc="Restaurant settings - coming next" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 text-sm">{desc}</p>
    </div>
  );
}
