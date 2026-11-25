import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateAdminPassword } from '../../services/authService';
import { LoginSpatialBackdrop } from '../../components/ui/MotionPrimitives';

export function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updateAdminPassword(password);
      setUpdated(true);
      setTimeout(() => navigate('/admin/overview', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <LoginSpatialBackdrop />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.97] p-7 shadow-2xl sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111315] text-white">
            <Lock className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Set New Password</h1>
            <p className="text-xs text-zinc-500">Administrator account recovery</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-600">Validating recovery session...</p>
        ) : !session ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-[#B45309]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your recovery link is missing or expired. Request a fresh password reset link from the login page.
              </span>
            </div>
            <Link
              to="/admin/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#1B4332] text-sm font-medium text-white hover:bg-[#143326]"
            >
              Return to Login
            </Link>
          </div>
        ) : updated ? (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-[#15803D]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Password updated successfully. Redirecting to dashboard...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#B91C1C]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-zinc-700">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-zinc-700">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-xl bg-[#1B4332] text-sm font-semibold text-white hover:bg-[#143326] disabled:opacity-60"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
