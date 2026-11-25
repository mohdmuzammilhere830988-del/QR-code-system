import QRCode from 'qrcode';

const PUBLIC_BASE_STORAGE_KEY = 'carteqr_public_base_url';

export function normalizeBaseOrigin(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isPrivateAiStudioDevOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname.startsWith('ais-dev-') && parsed.hostname.endsWith('.run.app');
  } catch {
    return false;
  }
}

export function suggestSharedAiStudioOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    if (parsed.hostname.startsWith('ais-dev-')) {
      return `${parsed.protocol}//${parsed.hostname.replace(/^ais-dev-/, 'ais-pre-')}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function getStoredPublicBaseUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(PUBLIC_BASE_STORAGE_KEY);
    return stored ? normalizeBaseOrigin(stored) : null;
  } catch {
    return null;
  }
}

export function setStoredPublicBaseUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!url) {
      window.localStorage.removeItem(PUBLIC_BASE_STORAGE_KEY);
    } else {
      const clean = normalizeBaseOrigin(url);
      if (clean) {
        window.localStorage.setItem(PUBLIC_BASE_STORAGE_KEY, clean);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function getDefaultPublicOrigin(): string {
  const envUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (envUrl) {
    const normalized = normalizeBaseOrigin(envUrl);
    if (normalized) return normalized;
  }

  const stored = getStoredPublicBaseUrl();
  if (stored) return stored;

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function getPublicMenuUrl(slug: string, baseOrigin?: string): string {
  const origin = baseOrigin ? normalizeBaseOrigin(baseOrigin) ?? getDefaultPublicOrigin() : getDefaultPublicOrigin();
  if (!origin) {
    return `/menu/${encodeURIComponent(slug)}`;
  }
  return `${origin}/menu/${encodeURIComponent(slug)}`;
}


export interface QrRenderOptions {
  url: string;
  size?: number;
  logoUrl?: string | null;
  includeLogo?: boolean;
  darkColor?: string;
  lightColor?: string;
}

export async function generateQrSvgString({
  url,
  darkColor = '#111315',
  lightColor = '#FFFFFF',
}: QrRenderOptions): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
}

function loadImageWithCors(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load restaurant logo for QR center'));
    img.src = src;
  });
}

export async function generateQrPngDataUrl({
  url,
  size = 1024,
  logoUrl,
  includeLogo = false,
  darkColor = '#111315',
  lightColor = '#FFFFFF',
}: QrRenderOptions): Promise<{ dataUrl: string; logoApplied: boolean }> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 3,
    errorCorrectionLevel: 'H',
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });

  let logoApplied = false;

  if (includeLogo && logoUrl) {
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const logoImg = await loadImageWithCors(logoUrl);
        // Keep center badge <= 18% of QR canvas width so H-level error correction scans reliably
        const badgeSize = Math.round(size * 0.18);
        const pad = Math.round(size * 0.02);
        const boxSize = badgeSize + pad * 2;
        const x = Math.round((size - boxSize) / 2);
        const y = Math.round((size - boxSize) / 2);
        const radius = Math.round(boxSize * 0.16);

        ctx.save();
        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.roundRect(x, y, boxSize, boxSize, radius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = Math.max(2, Math.round(size * 0.003));
        ctx.stroke();

        // Draw logo preserving aspect ratio (contain) inside badgeSize
        const aspect = logoImg.naturalWidth / Math.max(1, logoImg.naturalHeight);
        let drawW = badgeSize;
        let drawH = badgeSize;
        if (aspect > 1) {
          drawH = badgeSize / aspect;
        } else {
          drawW = badgeSize * aspect;
        }
        const imgX = x + pad + (badgeSize - drawW) / 2;
        const imgY = y + pad + (badgeSize - drawH) / 2;
        ctx.drawImage(logoImg, imgX, imgY, drawW, drawH);
        ctx.restore();
        logoApplied = true;
      }
    } catch {
      // Fallback cleanly to scannable QR without logo if CORS blocks external logo canvas export
      logoApplied = false;
    }
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    logoApplied,
  };
}

export function triggerFileDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadQrPng(options: QrRenderOptions, slug: string): Promise<{ logoApplied: boolean }> {
  const { dataUrl, logoApplied } = await generateQrPngDataUrl({ ...options, size: 1200 });
  triggerFileDownload(dataUrl, `${slug}-menu-qr.png`);
  return { logoApplied };
}

export async function downloadQrSvg(options: QrRenderOptions, slug: string): Promise<void> {
  const svgString = await generateQrSvgString(options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  triggerFileDownload(blobUrl, `${slug}-menu-qr.svg`);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
