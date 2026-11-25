import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { AlertCircle, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { getErrorMessage, isSupabaseConfigured } from '../../lib/supabase';
import { sanitizeSafeHttpUrl } from '../../lib/validation';
import { getPublicMenuBySlug } from '../../services/restaurantService';
import { formatPrice, type PublicMenuData, type ThemePreference } from '../../types/database';
import { ProductImage } from '../../components/ui/ProductImage';

interface ThemeTokens {
  pageBg: string;
  headerBg: string;
  navBg: string;
  cardBg: string;
  border: string;
  headingText: string;
  bodyText: string;
  mutedText: string;
  activeTab: string;
  inactiveTab: string;
  darkImageSurface: boolean;
}

const THEMES: Record<ThemePreference, ThemeTokens> = {
  editorial_light: {
    pageBg: 'bg-[#F8F7F4]',
    headerBg: 'bg-[#F8F7F4]',
    navBg: 'bg-[#F8F7F4]/95',
    cardBg: 'bg-white',
    border: 'border-[#E6E4DF]',
    headingText: 'text-zinc-900',
    bodyText: 'text-zinc-700',
    mutedText: 'text-zinc-500',
    activeTab: 'bg-[#1B4332] text-white',
    inactiveTab: 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04]',
    darkImageSurface: false,
  },
  noir_bistro: {
    pageBg: 'bg-[#111315]',
    headerBg: 'bg-[#111315]',
    navBg: 'bg-[#111315]/95',
    cardBg: 'bg-[#181B1F]',
    border: 'border-white/10',
    headingText: 'text-[#F4F4F0]',
    bodyText: 'text-zinc-300',
    mutedText: 'text-zinc-400',
    activeTab: 'bg-[#D4A373] text-[#111315]',
    inactiveTab: 'text-zinc-400 hover:text-white hover:bg-white/[0.06]',
    darkImageSurface: true,
  },
  botanical_sage: {
    pageBg: 'bg-[#F2F5F2]',
    headerBg: 'bg-[#F2F5F2]',
    navBg: 'bg-[#F2F5F2]/95',
    cardBg: 'bg-white',
    border: 'border-[#DCE3DC]',
    headingText: 'text-[#14261C]',
    bodyText: 'text-[#2D4236]',
    mutedText: 'text-[#5A6E61]',
    activeTab: 'bg-[#1B4332] text-white',
    inactiveTab: 'text-[#42574A] hover:text-[#14261C] hover:bg-[#1B4332]/[0.06]',
    darkImageSurface: false,
  },
};

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const prefersReducedMotion = useReducedMotion();

  const [menuData, setMenuData] = useState<PublicMenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const loadMenu = useCallback(async () => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Menu service is not configured yet.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await getPublicMenuBySlug(slug);
      if (!data) {
        setNotFound(true);
        setMenuData(null);
      } else {
        setMenuData(data);
        if (data.categories.length > 0) {
          const firstId = data.categories[0].category?.id ?? 'uncategorized';
          setActiveSectionId(firstId);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load menu right now.'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Update document title cleanly for restaurant guests
  useEffect(() => {
    if (menuData?.restaurant.name) {
      document.title = `${menuData.restaurant.name} — Menu`;
    }
  }, [menuData]);

  // Observe category sections to sync active category tab while scrolling
  useEffect(() => {
    if (!menuData || menuData.categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-section');
            if (id) setActiveSectionId(id);
            break;
          }
        }
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0.01 }
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [menuData]);

  const scrollToCategory = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const target = sectionRefs.current.get(sectionId);
    if (target) {
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-zinc-200" />
            <div className="h-7 w-56 animate-pulse rounded-lg bg-zinc-200" />
            <div className="h-4 w-72 animate-pulse rounded-lg bg-zinc-200" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-[#E6E4DF] bg-white p-4">
                <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
                <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-zinc-200" />
                <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#E6E4DF] bg-white p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-zinc-500" />
          <h1 className="mt-4 font-display text-xl font-semibold text-zinc-900">
            Unable to Load Menu
          </h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
          <button
            type="button"
            onClick={loadMenu}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white hover:bg-[#143326]"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !menuData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#E6E4DF] bg-white p-8 text-center">
          <UtensilsCrossed className="mx-auto h-8 w-8 text-zinc-400" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-xl font-semibold text-zinc-900">
            Menu Unavailable
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            This digital menu is currently unavailable or could not be found.
          </p>
        </div>
      </div>
    );
  }

  const { restaurant, categories, totalActiveProducts } = menuData;
  const theme = THEMES[restaurant.theme_preference] ?? THEMES.editorial_light;
  const safeLogo = sanitizeSafeHttpUrl(restaurant.logo_url);

  return (
    <div className={`min-h-screen ${theme.pageBg} ${theme.headingText}`}>
      {/* Restaurant Identity Header */}
      <header className={`${theme.headerBg} border-b ${theme.border} px-4 py-7 sm:px-8 sm:py-10`}>
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          {safeLogo && (
            <div
              className={`mb-4 flex h-20 w-24 items-center justify-center overflow-hidden rounded-2xl border p-2 ${theme.cardBg} ${theme.border}`}
            >
              <img
                src={safeLogo}
                alt={restaurant.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p className={`mt-2.5 max-w-xl text-sm leading-relaxed ${theme.bodyText}`}>
              {restaurant.description}
            </p>
          )}
        </div>
      </header>

      {/* Compact Sticky Category Navigation (<= 15% mobile viewport height) */}
      {categories.length > 0 && (
        <nav
          aria-label="Menu categories"
          className={`sticky top-0 z-20 border-b ${theme.border} ${theme.navBg} backdrop-blur-md`}
        >
          <div className="no-scrollbar mx-auto flex max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-8">
            {categories.map(({ category }) => {
              const id = category?.id ?? 'uncategorized';
              const label = category?.name ?? 'More Selections';
              const isSelected = activeSectionId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToCategory(id)}
                  className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isSelected ? theme.activeTab : theme.inactiveTab
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Menu Sections */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        {totalActiveProducts === 0 ? (
          <div className={`rounded-2xl border ${theme.border} ${theme.cardBg} px-6 py-14 text-center`}>
            <UtensilsCrossed className={`mx-auto h-8 w-8 ${theme.mutedText}`} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-xl font-semibold">Menu Coming Soon</h2>
            <p className={`mt-2 text-sm ${theme.mutedText}`}>
              Our menu is currently being prepared. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map(({ category, products }) => {
              const sectionId = category?.id ?? 'uncategorized';
              const sectionTitle = category?.name ?? 'More Selections';
              return (
                <section
                  key={sectionId}
                  data-category-section={sectionId}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(sectionId, el);
                    else sectionRefs.current.delete(sectionId);
                  }}
                  className="scroll-mt-20"
                >
                  <div className={`border-b ${theme.border} pb-3`}>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">
                      {sectionTitle}
                    </h2>
                    {category?.description && (
                      <p className={`mt-1 text-sm ${theme.mutedText}`}>{category.description}</p>
                    )}
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => (
                      <article
                        key={product.id}
                        className={`flex flex-col overflow-hidden rounded-2xl border ${theme.border} ${theme.cardBg} p-3.5 transition-transform duration-200 hover:-translate-y-0.5`}
                      >
                        {/* Uncropped full-visibility product photography */}
                        <ProductImage
                          src={product.image_url}
                          alt={product.name}
                          darkSurface={theme.darkImageSurface}
                          containerClassName="h-52 w-full sm:h-56"
                        />

                        <div className="flex flex-1 flex-col pt-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-base font-semibold leading-snug">
                              {product.name}
                            </h3>
                            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                              {formatPrice(product.price, restaurant.currency)}
                            </span>
                          </div>

                          {product.description && (
                            <p className={`mt-1.5 text-sm leading-relaxed ${theme.mutedText}`}>
                              {product.description}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Quiet Optional Restaurant Contact Footer */}
      {(restaurant.address || restaurant.contact_phone || restaurant.contact_email) && (
        <footer className={`mt-10 border-t ${theme.border} px-4 py-8 sm:px-8`}>
          <div className={`mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs ${theme.mutedText}`}>
            {restaurant.address && <span>{restaurant.address}</span>}
            {restaurant.contact_phone && (
              <>
                {restaurant.address && <span aria-hidden="true">·</span>}
                <span className="font-mono">{restaurant.contact_phone}</span>
              </>
            )}
            {restaurant.contact_email && (
              <>
                {(restaurant.address || restaurant.contact_phone) && <span aria-hidden="true">·</span>}
                <span>{restaurant.contact_email}</span>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
