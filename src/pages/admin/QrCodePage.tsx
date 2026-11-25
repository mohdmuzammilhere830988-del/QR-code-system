import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Printer,
  QrCode as QrCodeIcon,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  downloadQrPng,
  downloadQrSvg,
  generateQrPngDataUrl,
  getDefaultPublicOrigin,
  getPublicMenuUrl,
  isPrivateAiStudioDevOrigin,
  normalizeBaseOrigin,
  setStoredPublicBaseUrl,
  suggestSharedAiStudioOrigin,
} from '../../lib/qr';
import { sanitizeSafeHttpUrl } from '../../lib/validation';
import { PageTransition } from '../../components/ui/MotionPrimitives';

export function QrCodePage() {
  const { restaurant } = useAuth();
  const { showToast } = useToast();

  const [baseOrigin, setBaseOrigin] = useState<string>(() => getDefaultPublicOrigin());
  const [baseOriginInput, setBaseOriginInput] = useState<string>(() => getDefaultPublicOrigin());
  const [baseOriginError, setBaseOriginError] = useState<string | null>(null);

  const [includeLogo, setIncludeLogo] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');
  const [logoApplied, setLogoApplied] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [copied, setCopied] = useState(false);

  const menuUrl = restaurant ? getPublicMenuUrl(restaurant.slug, baseOrigin) : '';
  const safeLogoUrl = sanitizeSafeHttpUrl(restaurant?.logo_url);
  const isPrivatePreviewUrl = isPrivateAiStudioDevOrigin(baseOrigin);
  const sharedSuggestion =
    typeof window !== 'undefined' ? suggestSharedAiStudioOrigin(window.location.origin) : null;

  useEffect(() => {
    if (!restaurant) return;
    let active = true;
    setGenerating(true);

    generateQrPngDataUrl({
      url: menuUrl,
      size: 720,
      logoUrl: safeLogoUrl,
      includeLogo: includeLogo && Boolean(safeLogoUrl),
    })
      .then((res) => {
        if (!active) return;
        setQrPreviewUrl(res.dataUrl);
        setLogoApplied(res.logoApplied);
      })
      .catch(() => {
        if (!active) return;
        showToast({ type: 'error', title: 'Unable to generate QR preview' });
      })
      .finally(() => {
        if (active) setGenerating(false);
      });

    return () => {
      active = false;
    };
  }, [restaurant, menuUrl, safeLogoUrl, includeLogo, showToast]);

  if (!restaurant) return null;

  const handleApplyBaseOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeBaseOrigin(baseOriginInput);
    if (!clean) {
      setBaseOriginError('Enter a valid public domain starting with https:// (e.g. https://your-app.vercel.app)');
      return;
    }
    setBaseOriginError(null);
    setBaseOrigin(clean);
    setBaseOriginInput(clean);
    setStoredPublicBaseUrl(clean);
    showToast({
      type: 'success',
      title: 'QR public domain updated',
      description: clean,
    });
  };

  const handleUseSharedUrl = () => {
    if (!sharedSuggestion) return;
    setBaseOriginError(null);
    setBaseOrigin(sharedSuggestion);
    setBaseOriginInput(sharedSuggestion);
    setStoredPublicBaseUrl(sharedSuggestion);
    showToast({
      type: 'info',
      title: 'Switched to Shared App URL',
      description: 'Ensure the app is published/shared publicly or deployed to a public host for phone scanning.',
    });
  };

  const handleResetOrigin = () => {
    setStoredPublicBaseUrl(null);
    const fallback = getDefaultPublicOrigin();
    setBaseOriginError(null);
    setBaseOrigin(fallback);
    setBaseOriginInput(fallback);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      showToast({ type: 'success', title: 'Permanent menu URL copied' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', title: 'Clipboard blocked', description: 'Copy URL manually.' });
    }
  };

  const handleDownloadPng = async () => {
    try {
      const res = await downloadQrPng(
        {
          url: menuUrl,
          logoUrl: safeLogoUrl,
          includeLogo: includeLogo && Boolean(safeLogoUrl),
        },
        restaurant.slug
      );
      showToast({
        type: 'success',
        title: 'PNG downloaded',
        description:
          includeLogo && safeLogoUrl && !res.logoApplied
            ? 'External logo blocked CORS export; clean scannable QR PNG saved.'
            : `${restaurant.slug}-menu-qr.png`,
      });
    } catch {
      showToast({ type: 'error', title: 'PNG download failed' });
    }
  };

  const handleDownloadSvg = async () => {
    try {
      await downloadQrSvg({ url: menuUrl }, restaurant.slug);
      showToast({
        type: 'success',
        title: 'SVG downloaded',
        description: `${restaurant.slug}-menu-qr.svg`,
      });
    } catch {
      showToast({ type: 'error', title: 'SVG download failed' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <PageTransition className="space-y-6">
      <div className="no-print grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* QR Preview Card */}
        <div className="flex flex-col items-center rounded-2xl border border-[#E6E4DF] bg-white p-6 text-center">
          <div className="flex aspect-square w-full max-w-[290px] items-center justify-center rounded-2xl border border-[#E6E4DF] bg-white p-4">
            {generating ? (
              <div className="h-full w-full animate-pulse rounded-xl bg-zinc-100" />
            ) : qrPreviewUrl ? (
              <img
                src={qrPreviewUrl}
                alt={`Universal QR Code for ${restaurant.name}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <QrCodeIcon className="h-16 w-16 text-zinc-300" />
            )}
          </div>

          <p className="mt-4 text-base font-semibold text-zinc-900">{restaurant.name}</p>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">/menu/{restaurant.slug}</p>

          {safeLogoUrl && (
            <label className="mt-4 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] px-3.5 py-2.5 text-left">
              <div>
                <p className="text-xs font-medium text-zinc-900">Center Restaurant Logo</p>
                <p className="text-[11px] text-zinc-500">
                  Uses High (30%) error correction
                </p>
              </div>
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-[#1B4332]"
              />
            </label>
          )}

          {includeLogo && safeLogoUrl && !generating && !logoApplied && (
            <p className="mt-2 text-[11px] text-[#B45309]">
              External logo host blocks canvas embedding. Upload your logo in Settings to embed it in the QR.
            </p>
          )}
        </div>

        {/* Controls & Export Details */}
        <div className="min-w-0 space-y-5">
          {isPrivatePreviewUrl && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
                <div className="space-y-2 text-xs leading-relaxed text-amber-950">
                  <p className="text-sm font-semibold text-amber-950">
                    Private Preview URL Detected (Returns 403 on Phones)
                  </p>
                  <p>
                    Google AI Studio&apos;s <code className="font-mono">ais-dev-*</code> preview URL is restricted to your logged-in editor session, so scanning it on a mobile phone produces a 403 error.
                  </p>
                  <p>
                    To scan from phones, deploy this app to a public host (such as Vercel, Netlify, or public Cloud Run) and paste your public domain below—or click Preview Menu to test in your current browser.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sharedSuggestion && (
                      <button
                        type="button"
                        onClick={handleUseSharedUrl}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-medium text-amber-950 hover:bg-amber-100/60"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Switch QR to Shared URL (ais-pre)
                      </button>
                    )}
                    <Link
                      to={`/menu/${encodeURIComponent(restaurant.slug)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1B4332] px-3 text-xs font-medium text-white hover:bg-[#143326]"
                    >
                      <span>Test Menu in This Browser</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-900">
              Permanent Universal QR Destination
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Print this code once for tables, tents, and storefronts. Adding dishes, editing prices, replacing photos, or reordering categories updates the menu immediately without changing this QR code.
            </p>

            {/* Public Base Domain Configurator */}
            <form onSubmit={handleApplyBaseOrigin} className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="qr-base-domain" className="text-xs font-medium text-zinc-700">
                  Public App Domain for QR Code
                </label>
                {typeof window !== 'undefined' && baseOrigin !== window.location.origin && (
                  <button
                    type="button"
                    onClick={handleResetOrigin}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to current origin
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  id="qr-base-domain"
                  type="url"
                  value={baseOriginInput}
                  onChange={(e) => setBaseOriginInput(e.target.value)}
                  placeholder="https://your-deployed-domain.com"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-3 font-mono text-xs text-zinc-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-9 rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0"
                >
                  Apply Domain
                </button>
              </div>
              {baseOriginError && (
                <p className="text-xs font-medium text-[#B91C1C]">{baseOriginError}</p>
              )}
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800">
                {menuUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#15803D]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy URL'}
              </button>
              {isPrivatePreviewUrl ? (
                <Link
                  to={`/menu/${encodeURIComponent(restaurant.slug)}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
                >
                  <span>Open Menu</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
                >
                  <span>Open Menu</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Export Buttons */}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={generating}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white transition-colors hover:bg-[#143326] disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                disabled={generating}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6E4DF] bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                Download SVG
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={generating}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6E4DF] bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60 whitespace-nowrap"
              >
                <Printer className="h-4 w-4" />
                Print Table Tent
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[#E6E4DF] bg-white p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1B4332]" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Scannability &amp; Public Privacy Guaranteed
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Generated with Error Correction Level H (30% recovery) for low-light dining rooms. Customers scanning this code see only active categories and active items—no admin tools, login prompts, or hidden drafts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Poster View (hidden on screen, active on print) */}
      <div className="print-only-qr hidden flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white p-12 text-center">
        {safeLogoUrl && (
          <img
            src={safeLogoUrl}
            alt={restaurant.name}
            referrerPolicy="no-referrer"
            className="mb-4 h-16 w-auto max-w-[180px] object-contain"
          />
        )}
        <h2 className="font-display text-3xl font-semibold text-zinc-900">{restaurant.name}</h2>
        <p className="mt-2 text-sm text-zinc-600">Scan with your phone camera to view our menu</p>
        {qrPreviewUrl && (
          <div className="my-8 rounded-2xl border border-zinc-200 p-5">
            <img
              src={qrPreviewUrl}
              alt={`Menu QR for ${restaurant.name}`}
              className="h-72 w-72 object-contain"
            />
          </div>
        )}
        <p className="font-mono text-xs text-zinc-500">{menuUrl}</p>
      </div>
    </PageTransition>
  );
}
