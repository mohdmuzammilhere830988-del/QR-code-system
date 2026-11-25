import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Link as LinkIcon, Save, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getPublicMenuUrl } from '../../lib/qr';
import { getErrorMessage } from '../../lib/supabase';
import {
  normalizeSlug,
  validateExternalImageUrl,
  validateImageFile,
  validateSlug,
} from '../../lib/validation';
import { deleteStorageImage, uploadImageWithProgress } from '../../services/productService';
import { isSlugAvailable, updateRestaurantSettings } from '../../services/restaurantService';
import {
  CURRENCY_META,
  type CurrencyCode,
  type ThemePreference,
} from '../../types/database';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageTransition } from '../../components/ui/MotionPrimitives';
import { ProductImage } from '../../components/ui/ProductImage';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; summary: string }> = [
  {
    value: 'editorial_light',
    label: 'Editorial Alabaster',
    summary: 'Warm off-white paper with botanical pine accents',
  },
  {
    value: 'noir_bistro',
    label: 'Noir Bistro',
    summary: 'Deep charcoal evening canvas with warm brass accents',
  },
  {
    value: 'botanical_sage',
    label: 'Botanical Sage',
    summary: 'Soft mineral sage surfaces with crisp dark ink',
  },
];

export function SettingsPage() {
  const { restaurant, setRestaurant } = useAuth();
  const { showToast } = useToast();
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isMenuActive, setIsMenuActive] = useState(true);
  const [themePreference, setThemePreference] = useState<ThemePreference>('editorial_light');

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSlugOpen, setConfirmSlugOpen] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setSlug(restaurant.slug);
    setCurrency(restaurant.currency);
    setDescription(restaurant.description ?? '');
    setContactPhone(restaurant.contact_phone ?? '');
    setContactEmail(restaurant.contact_email ?? '');
    setAddress(restaurant.address ?? '');
    setIsMenuActive(restaurant.is_menu_active);
    setThemePreference(restaurant.theme_preference);
    setLogoUrl(restaurant.logo_url);
    setLogoStoragePath(restaurant.logo_storage_path);
    setLogoUrlInput(
      restaurant.logo_url && !restaurant.logo_storage_path ? restaurant.logo_url : ''
    );
  }, [restaurant]);

  if (!restaurant) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const check = validateImageFile(file);
    if (!check.valid) {
      setLogoError(check.error ?? 'Invalid logo file.');
      return;
    }

    setLogoError(null);
    setLogoUploading(true);
    setLogoProgress(5);
    try {
      const res = await uploadImageWithProgress(
        restaurant.id,
        'logo',
        file,
        (pct) => setLogoProgress(pct)
      );
      setLogoUrl(res.publicUrl);
      setLogoStoragePath(res.storagePath);
      setLogoUrlInput('');
    } catch (err) {
      setLogoError(getErrorMessage(err, 'Logo upload failed.'));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleApplyLogoUrl = () => {
    const res = validateExternalImageUrl(logoUrlInput);
    if (!res.valid || !res.normalized) {
      setLogoError(res.error ?? 'Invalid logo URL.');
      return;
    }
    setLogoError(null);
    setLogoUrl(res.normalized);
    setLogoStoragePath(null);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoStoragePath(null);
    setLogoUrlInput('');
    setLogoError(null);
  };

  const performSave = async () => {
    setFormError(null);

    if (name.trim().length < 2) {
      setFormError('Restaurant name must be at least 2 characters.');
      return;
    }

    const cleanSlug = normalizeSlug(slug);
    const slugCheck = validateSlug(cleanSlug);
    if (!slugCheck.valid) {
      setFormError(slugCheck.error ?? 'Invalid restaurant slug.');
      return;
    }

    setSaving(true);
    try {
      if (cleanSlug !== restaurant.slug) {
        const available = await isSlugAvailable(cleanSlug, restaurant.id);
        if (!available) {
          setFormError('That restaurant slug is already taken. Choose another unique slug.');
          setSaving(false);
          return;
        }
      }

      const previousLogoStoragePath = restaurant.logo_storage_path;

      const updated = await updateRestaurantSettings(restaurant.id, {
        name: name.trim(),
        slug: cleanSlug,
        logo_url: logoUrl,
        logo_storage_path: logoStoragePath,
        description: description.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        address: address.trim() || null,
        currency,
        theme_preference: themePreference,
        is_menu_active: isMenuActive,
      });

      if (
        previousLogoStoragePath &&
        previousLogoStoragePath !== logoStoragePath
      ) {
        try {
          await deleteStorageImage(previousLogoStoragePath);
        } catch {
          // non-fatal
        }
      }

      setRestaurant(updated);
      setConfirmSlugOpen(false);
      showToast({
        type: 'success',
        title: 'Restaurant settings saved',
        description: 'Changes are live on your public menu.',
      });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Unable to save restaurant settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = normalizeSlug(slug);
    if (cleanSlug !== restaurant.slug) {
      setConfirmSlugOpen(true);
      return;
    }
    performSave();
  };

  const cleanSlugPreview = normalizeSlug(slug) || restaurant.slug;

  return (
    <PageTransition>
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Restaurant Identity & Logo */}
        <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900">Restaurant Profile</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Displayed at the top of your public QR menu.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-700">Restaurant Logo</p>
              <ProductImage
                src={logoUrl}
                alt={name || 'Restaurant logo'}
                containerClassName="h-40 w-full"
              />
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E6E4DF] py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#B91C1C]" />
                  Remove Logo
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rest-name" className="block text-xs font-medium text-zinc-700">
                    Restaurant Name
                  </label>
                  <input
                    id="rest-name"
                    type="text"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="rest-currency" className="block text-xs font-medium text-zinc-700">
                    Currency
                  </label>
                  <select
                    id="rest-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                  >
                    {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_META[code].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="rest-desc" className="block text-xs font-medium text-zinc-700">
                  Description (optional)
                </label>
                <textarea
                  id="rest-desc"
                  rows={2}
                  maxLength={600}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Cuisine focus, hours, or hospitality welcome note"
                  className="mt-1.5 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                />
              </div>

              {/* Logo upload or external URL */}
              <div className="rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-800">Update Logo</span>
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white border border-[#E6E4DF] px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Logo File
                    </button>
                  </div>
                </div>

                {logoUploading && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full bg-[#1B4332] transition-all"
                      style={{ width: `${logoProgress}%` }}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="url"
                      value={logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      placeholder="Or paste public https:// logo URL"
                      className="h-9 w-full rounded-lg border border-[#E6E4DF] bg-white pr-3 pl-8 text-xs text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyLogoUrl}
                    className="h-9 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap"
                  >
                    Apply URL
                  </button>
                </div>

                {logoError && <p className="text-xs font-medium text-[#B91C1C]">{logoError}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* QR Destination Slug & Menu Visibility */}
        <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900">
            Permanent QR Slug &amp; Visibility
          </h2>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="rest-slug" className="block text-xs font-medium text-zinc-700">
                Restaurant Slug
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-[#E6E4DF] bg-white focus-within:border-[#1B4332]">
                <span className="pl-3.5 font-mono text-xs text-zinc-500">/menu/</span>
                <input
                  id="rest-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                  className="h-10 min-w-0 flex-1 bg-transparent pr-3.5 font-mono text-sm text-zinc-900 focus:outline-none"
                />
              </div>
              <p className="mt-1.5 truncate font-mono text-[11px] text-zinc-500">
                {getPublicMenuUrl(cleanSlugPreview)}
              </p>
              {cleanSlugPreview !== restaurant.slug && (
                <p className="mt-1 text-xs font-medium text-[#B45309]">
                  Warning: Changing the slug alters the public QR destination URL.
                </p>
              )}
            </div>

            <div className="flex items-center">
              <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-4">
                <input
                  type="checkbox"
                  checked={isMenuActive}
                  onChange={(e) => setIsMenuActive(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[#1B4332]"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900">Menu Publicly Active</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    When disabled, scanning the QR code shows an unavailable notice.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Contact Details & Theme */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">
              Contact Information (optional)
            </h2>

            <div>
              <label htmlFor="rest-phone" className="block text-xs font-medium text-zinc-700">
                Phone Number
              </label>
              <input
                id="rest-phone"
                type="text"
                maxLength={40}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rest-email" className="block text-xs font-medium text-zinc-700">
                Public Email
              </label>
              <input
                id="rest-email"
                type="email"
                maxLength={120}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@restaurant.com"
                className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rest-address" className="block text-xs font-medium text-zinc-700">
                Address
              </label>
              <textarea
                id="rest-address"
                rows={2}
                maxLength={300}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, neighborhood, city"
                className="mt-1.5 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Customer Menu Theme</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Choose the color atmosphere for your public QR menu.
              </p>
            </div>

            <div className="space-y-2.5">
              {THEME_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    themePreference === opt.value
                      ? 'border-[#1B4332] bg-[#1B4332]/[0.04]'
                      : 'border-[#E6E4DF] bg-white hover:bg-[#F7F6F3]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="theme-pref"
                    value={opt.value}
                    checked={themePreference === opt.value}
                    onChange={() => setThemePreference(opt.value)}
                    className="mt-0.5 accent-[#1B4332]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{opt.summary}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || logoUploading}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1B4332] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#143326] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving Settings...' : 'Save Restaurant Settings'}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmSlugOpen}
        title="Change Permanent QR Destination?"
        description={`Updating the slug from "${restaurant.slug}" to "${cleanSlugPreview}" changes your public QR URL. Any existing printed QR codes pointing to /menu/${restaurant.slug} will stop resolving to this menu.`}
        confirmLabel="Update Slug & Save"
        loading={saving}
        onConfirm={performSave}
        onCancel={() => setConfirmSlugOpen(false)}
      />
    </PageTransition>
  );
}
