import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { ResetPasswordPage } from './pages/admin/ResetPasswordPage';
import { AdminProvisionPage } from './pages/admin/AdminProvisionPage';
import { OverviewPage } from './pages/admin/OverviewPage';
import { MenuManagementPage } from './pages/admin/MenuManagementPage';
import { CategoriesPage } from './pages/admin/CategoriesPage';
import { QrCodePage } from './pages/admin/QrCodePage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { PublicMenuPage } from './pages/public/PublicMenuPage';

function RequireAdminAuth() {
  const { isConfigured, user, restaurant, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] text-sm font-medium text-zinc-600">
        Loading workspace...
      </div>
    );
  }

  if (!isConfigured || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (isPasswordRecovery) {
    return <Navigate to="/admin/reset-password" replace />;
  }

  if (!restaurant) {
    return <Navigate to="/admin/setup-restaurant" replace />;
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* Public Universal QR Menu (strictly customer-only) */}
              <Route path="/menu/:slug" element={<PublicMenuPage />} />

              {/* Admin Authentication & Initial Provisioning */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin/setup-restaurant" element={<AdminProvisionPage />} />

              {/* Protected Administrator Dashboard */}
              <Route path="/admin" element={<RequireAdminAuth />}>
                <Route index element={<Navigate to="/admin/overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="menu" element={<MenuManagementPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="qr" element={<QrCodePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Root & Fallback Routing */}
              <Route path="/" element={<Navigate to="/admin/overview" replace />} />
              <Route path="*" element={<Navigate to="/admin/login" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
