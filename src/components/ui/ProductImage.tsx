import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { sanitizeSafeHttpUrl } from '../../lib/validation';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  darkSurface?: boolean;
  onImageError?: () => void;
  onImageLoad?: () => void;
}

/**
 * Displays product photography with strict object-fit: contain so images
 * are NEVER cropped, stretched, distorted, or zoomed—preserving full visibility
 * for both portrait and landscape images.
 */
export function ProductImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  darkSurface = false,
  onImageError,
  onImageLoad,
}: ProductImageProps) {
  const safeSrc = sanitizeSafeHttpUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const hasError = !safeSrc || failedSrc === safeSrc;
  const isLoaded = Boolean(safeSrc && loadedSrc === safeSrc);

  const backdrop = darkSurface
    ? 'bg-[#1B1D20] border-white/[0.06]'
    : 'bg-[#F2F0EB] border-[#E6E4DF]';

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl border p-2.5 ${backdrop} ${containerClassName}`}
    >
      {hasError ? (
        <div className="flex flex-col items-center justify-center gap-1.5 text-center">
          <UtensilsCrossed
            className={`h-6 w-6 ${darkSurface ? 'text-zinc-600' : 'text-zinc-400'}`}
            strokeWidth={1.5}
          />
          <span
            className={`text-[11px] font-medium ${
              darkSurface ? 'text-zinc-500' : 'text-zinc-500'
            }`}
          >
            No image
          </span>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div
              className={`absolute inset-2.5 animate-pulse rounded-lg ${
                darkSurface ? 'bg-zinc-800' : 'bg-zinc-200/70'
              }`}
            />
          )}
          <img
            src={safeSrc}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => {
              setLoadedSrc(safeSrc);
              onImageLoad?.();
            }}
            onError={() => {
              setFailedSrc(safeSrc);
              onImageError?.();
            }}
            className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            } ${className}`}
          />
        </>
      )}
    </div>
  );
}
