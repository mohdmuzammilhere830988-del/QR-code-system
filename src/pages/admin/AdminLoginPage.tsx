import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, Mail, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sendPasswordReset, signInAdmin } from '../../services/authService';
import { LoginSpatialBackdrop } from '../../components/ui/MotionPrimitives';
import { SupabaseSetupNotice } from '../../components/admin/SupabaseSetupNotice';

export function AdminLoginPage() {
  const { isConfigured, user, restaurant, loading, isPasswordRecovery } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1113] text-zinc-300">
        <div className="text-sm font-medium">Verifying administrator session...</div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <Navigate to="/admin/reset-password" replace />;
  }

  if (user && restaurant) {
    return <Navigate to="/admin/overview" replace />;
  }

  if (user && !restaurant) {
    return <Navigate to="/admin/setup-restaurant" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter both your administrator email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInAdmin(email, password);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid administrator credentials. Please try again.';
      if (msg.toLowerCase().includes('invalid path')) {
        setError(
          'Invalid path specified in request URL. Check VITE_SUPABASE_URL in your Secrets/env: it must be only your root Project URL (https://your-project-ref.supabase.co) without any trailing path like /auth/v1 or /rest/v1.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter your administrator email address.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConfigured || showSetupGuide) {
    return (
      <div className="relative min-h-screen bg-[#F7F6F3] px-4 py-10 sm:px-8">
        {isConfigured && (
          <div className="mx-auto mb-4 max-w-3xl">
            <button
              type="button"
              onClick={() => setShowSetupGuide(false)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Administrator Login
            </button>
          </div>
        )}
        <SupabaseSetupNotice />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <LoginSpatialBackdrop />

      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/15 bg-white/[0.97] p-7 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-9">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111315] text-white shadow-sm">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-zinc-900">
                CarteQR Admin
              </h1>
              <p className="text-xs text-zinc-500">Restaurant Menu Management Console</p>
            </div>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Administrator Sign In
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Authorized restaurant owners only.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="admin-email" className="block text-xs font-medium text-zinc-700">
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                    className="h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 pr-3.5 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#1B4332] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="admin-password" className="block text-xs font-medium text-zinc-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setResetSent(false);
                      setMode('forgot');
                    }}
                    className="text-xs font-medium text-[#1B4332] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 pr-3.5 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#1B4332] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 h-11 w-full rounded-xl bg-[#1B4332] text-sm font-semibold text-white transition-colors hover:bg-[#143326] disabled:opacity-60"
              >
                {submitting ? 'Signing in...' : 'Sign In to Dashboard'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="mt-7 space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setResetSent(false);
                    setMode('login');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </button>
                <h2 className="mt-3 text-base font-semibold text-zinc-900">
                  Reset Administrator Password
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Receive a secure password recovery link via Supabase Auth.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {resetSent ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-[#15803D]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    If an administrator account exists for <strong>{email}</strong>, a password recovery email has been dispatched.
                  </span>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-medium text-zinc-700">
                      Administrator Email
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="owner@restaurant.com"
                        className="h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 pr-3.5 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#1B4332] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-11 w-full rounded-xl bg-[#1B4332] text-sm font-semibold text-white transition-colors hover:bg-[#143326] disabled:opacity-60"
                  >
                    {submitting ? 'Sending link...' : 'Send Recovery Link'}
                  </button>
                </>
              )}
            </form>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-[#E6E4DF] pt-4 text-[11px] text-zinc-500">
            <span>Public registration disabled</span>
            <button
              type="button"
              onClick={() => setShowSetupGuide(true)}
              className="font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Supabase setup guide
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
