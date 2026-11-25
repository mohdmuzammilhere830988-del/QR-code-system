import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, LogOut, RefreshCw, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../lib/supabase';
import { normalizeSlug, validateSlug } from '../../lib/validation';
import { provisionInitialRestaurant } from '../../services/authService';
import { CURRENCY_META, type CurrencyCode } from '../../types/database';
import { LoginSpatialBackdrop } from '../../components/ui/MotionPrimitives';

export function AdminProvisionPage() {
  const { user, restaurant, loading, authError, refreshRestaurant, signOut } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1113] text-zinc-300">
        <div className="text-sm">Loading administrator account...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (restaurant) {
    return <Navigate to="/admin/overview" replace />;
  }

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) {
      setSlug(normalizeSlug(val));
    }
  };

  const handleRetryAccess = async () => {
    setRetrying(true);
    setError(null);
    try {
      await refreshRestaurant();
    } finally {
      setRetrying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Restaurant name must be at least 2 characters.');
      return;
    }

    const cleanSlug = normalizeSlug(slug);
    const slugCheck = validateSlug(cleanSlug);
    if (!slugCheck.valid) {
      setError(slugCheck.error ?? 'Invalid slug.');
      return;
    }

    setSubmitting(true);
    try {
      await provisionInitialRestaurant({
        name: name.trim(),
        slug: cleanSlug,
        currency,
        description: description.trim() || undefined,
      });
      await refreshRestaurant();
      showToast({
        type: 'success',
        title: 'Restaurant initialized',
        description: 'Your QR menu workspace is ready.',
      });
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to initialize restaurant. Ensure the SQL migration has been executed.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = error ?? authError;
  const looksLikeMissingSchema = Boolean(
    displayError &&
      /does not exist|schema cache|could not find the (table|function)/i.test(displayError)
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <LoginSpatialBackdrop />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/15 bg-white/[0.97] p-7 shadow-2xl sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111315] text-white">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">
                Initialize Your Restaurant
              </h1>
              <p className="text-xs text-zinc-500">
                Signed in as {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DF] px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>

        {displayError && (
          <div className="mt-5 space-y-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-[#B91C1C]">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">{displayError}</p>
                {looksLikeMissingSchema && (
                  <p className="text-red-700/90">
                    The database schema has not been installed yet. Run the full SQL migration script in your Supabase Dashboard SQL Editor, then click Retry.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRetryAccess}
                disabled={retrying}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-[#B91C1C] hover:bg-red-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="init-name" className="block text-xs font-medium text-zinc-700">
              Restaurant Name
            </label>
            <input
              id="init-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Saffron & Oak Bistro"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="init-slug" className="block text-xs font-medium text-zinc-700">
              Permanent QR Menu Slug
            </label>
            <div className="mt-1.5 flex items-center rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 focus-within:border-[#1B4332] focus-within:bg-white">
              <span className="pl-3.5 font-mono text-xs text-zinc-500">/menu/</span>
              <input
                id="init-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(normalizeSlug(e.target.value));
                }}
                placeholder="saffron-oak-bistro"
                className="h-11 min-w-0 flex-1 bg-transparent pr-3.5 font-mono text-sm text-zinc-900 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              This forms your permanent universal QR destination URL.
            </p>
          </div>

          <div>
            <label htmlFor="init-currency" className="block text-xs font-medium text-zinc-700">
              Menu Currency
            </label>
            <select
              id="init-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-3 text-sm text-zinc-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
            >
              {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_META[code].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="init-desc" className="block text-xs font-medium text-zinc-700">
              Short Description (optional)
            </label>
            <textarea
              id="init-desc"
              rows={2}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Seasonal kitchen & artisanal coffee"
              className="mt-1.5 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-[#1B4332] text-sm font-semibold text-white transition-colors hover:bg-[#143326] disabled:opacity-60"
          >
            {submitting ? 'Creating Restaurant...' : 'Create Restaurant Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
