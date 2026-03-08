import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ReservationsPage } from '@/pages/ReservationsPage';
import { FloorPlanPage } from '@/pages/FloorPlanPage';
import { GuestsPage } from '@/pages/GuestsPage';
import { WaitlistPage } from '@/pages/WaitlistPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { VouchersPage } from '@/pages/VouchersPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { UsersPage } from '@/pages/UsersPage';
import { ReportsPage } from '@/pages/ReportsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <span className="text-sm font-extrabold text-white">Y</span>
          </div>
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
          <Route path="/floor-plan" element={<FloorPlanPage />} />
          <Route path="/guests" element={<GuestsPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/vouchers" element={<VouchersPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
