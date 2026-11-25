import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { getErrorMessage, isSupabaseConfigured } from '../../lib/supabase';
import { sanitizeSafeHttpUrl } from '../../lib/validation';
import { getPublicMenuBySlug } from '../../services/restaurantService';
import { formatPrice, type PublicMenuData, type ThemePreference } from '../../types/database';
import { ProductImage } from '../../components/ui/ProductImage';

interface ThemeTokens {
  pageBg: string;
  heroBg: string;
  heroGlow: string;
  navBg: string;
  cardBg: string;
  cardShadow: string;
  imageBackdrop: string;
  border: string;
  headingText: string;
  bodyText: string;
  mutedText: string;
  accentText: string;
  activeTab: string;
  inactiveTab: string;
  darkImageSurface: boolean;
}

const THEMES: Record<ThemePreference, ThemeTokens> = {
  editorial_light: {
    pageBg: 'bg-[#F7F5F0]',
    heroBg: 'bg-gradient-to-b from-[#EFECE4] via-[#F5F3EC] to-[#F7F5F0]',
    heroGlow:
      'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(27, 67, 50, 0.08), transparent 70%)',
    navBg: 'bg-[#F7F5F0]/90',
    cardBg: 'bg-white',
    cardShadow: 'shadow-[0_4px_20px_-6px_rgba(24,24,27,0.06)] hover:shadow-[0_12px_28px_-8px_rgba(24,24,27,0.12)]',
    imageBackdrop: 'bg-gradient-to-b from-[#F4F1EA] to-[#ECE8DF]',
    border: 'border-[#E5E0D5]',
    headingText: 'text-[#18181B]',
    bodyText: 'text-[#3F3F46]',
    mutedText: 'text-[#71717A]',
    accentText: 'text-[#1B4332]',
    activeTab: 'bg-[#1B4332] text-white shadow-xs',
    inactiveTab: 'text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04]',
    darkImageSurface: false,
  },
  noir_bistro: {
    pageBg: 'bg-[#0E1012]',
    heroBg: 'bg-gradient-to-b from-[#171A1E] via-[#121417] to-[#0E1012]',
    heroGlow:
      'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(212, 163, 115, 0.12), transparent 70%)',
    navBg: 'bg-[#0E1012]/90',
    cardBg: 'bg-[#16191D]',
    cardShadow: 'shadow-[0_6px_24px_-6px_rgba(0,0,0,0.45)] hover:shadow-[0_14px_32px_-8px_rgba(0,0,0,0.65)]',
    imageBackdrop: 'bg-gradient-to-b from-[#1E2228] to-[#171A1E]',
    border: 'border-white/10',
    headingText: 'text-[#F5F3EE]',
    bodyText: 'text-[#D4D4D8]',
    mutedText: 'text-[#A1A1AA]',
    accentText: 'text-[#D4A373]',
    activeTab: 'bg-[#D4A373] text-[#111315] shadow-xs',
    inactiveTab: 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.06]',
    darkImageSurface: true,
  },
  botanical_sage: {
    pageBg: 'bg-[#F0F4F0]',
    heroBg: 'bg-gradient-to-b from-[#E3EBE3] via-[#ECF1EC] to-[#F0F4F0]',
    heroGlow:
      'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(27, 67, 50, 0.11), transparent 70%)',
    navBg: 'bg-[#F0F4F0]/90',
    cardBg: 'bg-white',
    cardShadow: 'shadow-[0_4px_20px_-6px_rgba(20,38,28,0.06)] hover:shadow-[0_12px_28px_-8px_rgba(20,38,28,0.12)]',
    imageBackdrop: 'bg-gradient-to-b from-[#EDF2ED] to-[#E3EAE3]',
    border: 'border-[#D5E0D5]',
    headingText: 'text-[#14261C]',
    bodyText: 'text-[#2D4236]',
    mutedText: 'text-[#5A6E61]',
    accentText: 'text-[#1B4332]',
    activeTab: 'bg-[#1B4332] text-white shadow-xs',
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

  useEffect(() => {
    if (menuData?.restaurant.name) {
      document.title = `${menuData.restaurant.name} — Menu`;
    }
  }, [menuData]);

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
      <div className="min-h-screen bg-[#F7F5F0] px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-[#E5E0D5]" />
            <div className="h-9 w-64 animate-pulse rounded-lg bg-[#E5E0D5]" />
            <div className="h-4 w-80 animate-pulse rounded-lg bg-[#E5E0D5]" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-[#E5E0D5] bg-white p-4">
                <div className="h-52 animate-pulse rounded-xl bg-[#F2EFE8]" />
                <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-[#E5E0D5]" />
                <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-[#E5E0D5]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-[#E5E0D5] bg-white p-8 text-center shadow-sm">
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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-[#E5E0D5] bg-white p-8 text-center shadow-sm">
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
      {/* Editorial Hospitality Masthead */}
      <header className={`relative overflow-hidden border-b ${theme.border} ${theme.heroBg}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: theme.heroGlow }}
        />

        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-10 text-center sm:px-8 sm:py-14"
        >
          {/* Logo or Subtle Architectural Crest */}
          {safeLogo ? (
            <div
              className={`mb-5 flex h-24 w-28 items-center justify-center overflow-hidden rounded-2xl border p-2.5 shadow-sm ${theme.cardBg} ${theme.border}`}
            >
              <img
                src={safeLogo}
                alt={restaurant.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div
              className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border ${theme.cardBg} ${theme.border} ${theme.accentText} shadow-xs`}
            >
              <UtensilsCrossed className="h-5 w-5" strokeWidth={1.6} />
            </div>
          )}

          <h1 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {restaurant.name}
          </h1>

          {/* Fine Editorial Ornament Rule */}
          <div className="my-4 flex items-center gap-3">
            <span className={`h-px w-12 border-t ${theme.border}`} />
            <span className={`h-1.5 w-1.5 rotate-45 border ${theme.border}`} />
            <span className={`h-px w-12 border-t ${theme.border}`} />
          </div>

          {restaurant.description ? (
            <p className={`max-w-xl text-sm leading-relaxed sm:text-base ${theme.bodyText}`}>
              {restaurant.description}
            </p>
          ) : (
            <p className={`text-sm ${theme.mutedText}`}>
              Digital Menu
            </p>
          )}

          {/* Quiet Menu Count Summary (unboxed typography) */}
          {totalActiveProducts > 0 && (
            <p className={`mt-4 text-xs font-medium tracking-wide ${theme.mutedText}`}>
              <span className="font-mono tabular-nums">{totalActiveProducts}</span>{' '}
              {totalActiveProducts === 1 ? 'selection' : 'selections'}
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">{categories.length}</span>{' '}
              {categories.length === 1 ? 'section' : 'sections'}
            </p>
          )}
        </motion.div>
      </header>

      {/* Compact Sticky Category Navigation (<= 15% mobile viewport height) */}
      {categories.length > 0 && (
        <nav
          aria-label="Menu categories"
          className={`sticky top-0 z-20 border-b ${theme.border} ${theme.navBg} backdrop-blur-md`}
        >
          <div className="no-scrollbar mx-auto flex max-w-5xl items-center justify-start gap-1.5 overflow-x-auto px-4 py-2.5 sm:justify-center sm:px-8">
            {categories.map(({ category }) => {
              const id = category?.id ?? 'uncategorized';
              const label = category?.name ?? 'Menu Selections';
              const isSelected = activeSectionId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToCategory(id)}
                  className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
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

      {/* Main Menu Showcase */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-12">
        {totalActiveProducts === 0 ? (
          <div
            className={`rounded-3xl border ${theme.border} ${theme.cardBg} px-6 py-16 text-center shadow-xs`}
          >
            <UtensilsCrossed className={`mx-auto h-8 w-8 ${theme.mutedText}`} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-2xl font-semibold">Menu Coming Soon</h2>
            <p className={`mt-2 text-sm ${theme.mutedText}`}>
              Our menu is currently being prepared. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-14">
            {categories.map(({ category, products }) => {
              const sectionId = category?.id ?? 'uncategorized';
              const sectionTitle = category?.name ?? 'Menu Selections';
              const isSingleFeature = products.length === 1;
              const isTwoColumn = products.length === 2;

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
                  {/* Category Heading */}
                  <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b ${theme.border} pb-3.5`}>
                    <div>
                      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                        {sectionTitle}
                      </h2>
                      {category?.description && (
                        <p className={`mt-1 text-sm ${theme.mutedText}`}>{category.description}</p>
                      )}
                    </div>
                    <span className={`font-mono text-xs tabular-nums ${theme.mutedText}`}>
                      {products.length} {products.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Smart Responsive Grid: Signature feature layout for 1 item, balanced 2-col or 3-col for multiple */}
                  {isSingleFeature ? (
                    <div className="mt-6">
                      {products.map((product) => (
                        <article
                          key={product.id}
                          className={`grid overflow-hidden rounded-3xl border ${theme.border} ${theme.cardBg} ${theme.cardShadow} transition-all duration-200 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}
                        >
                          <div className={`p-4 sm:p-5 ${theme.imageBackdrop}`}>
                            <ProductImage
                              src={product.image_url}
                              alt={product.name}
                              darkSurface={theme.darkImageSurface}
                              containerClassName="h-64 w-full border-0 bg-transparent p-2 sm:h-72"
                            />
                          </div>
                          <div className="flex flex-col justify-center p-6 sm:p-8">
                            <div className="flex items-baseline justify-between gap-4">
                              <h3 className="font-display text-2xl font-semibold leading-snug">
                                {product.name}
                              </h3>
                              <span
                                className={`shrink-0 font-mono text-lg font-semibold tabular-nums ${theme.accentText}`}
                              >
                                {formatPrice(product.price, restaurant.currency)}
                              </span>
                            </div>
                            {product.description && (
                              <p className={`mt-3 text-sm leading-relaxed sm:text-base ${theme.bodyText}`}>
                                {product.description}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`mt-6 grid gap-6 ${
                        isTwoColumn
                          ? 'sm:grid-cols-2'
                          : 'sm:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {products.map((product) => (
                        <article
                          key={product.id}
                          className={`group flex flex-col overflow-hidden rounded-3xl border ${theme.border} ${theme.cardBg} ${theme.cardShadow} transition-all duration-200 hover:-translate-y-0.5`}
                        >
                          {/* Uncropped full-visibility dish photography stage */}
                          <div className={`p-3.5 ${theme.imageBackdrop}`}>
                            <ProductImage
                              src={product.image_url}
                              alt={product.name}
                              darkSurface={theme.darkImageSurface}
                              containerClassName="h-52 w-full border-0 bg-transparent p-1.5 sm:h-56"
                            />
                          </div>

                          <div className="flex flex-1 flex-col p-5">
                            <div className="flex items-baseline justify-between gap-3">
                              <h3 className="font-display text-lg font-semibold leading-snug">
                                {product.name}
                              </h3>
                              <span
                                className={`shrink-0 font-mono text-base font-semibold tabular-nums ${theme.accentText}`}
                              >
                                {formatPrice(product.price, restaurant.currency)}
                              </span>
                            </div>

                            {product.description && (
                              <p className={`mt-2 text-sm leading-relaxed ${theme.mutedText}`}>
                                {product.description}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Hospitality Footer */}
      <footer className={`mt-12 border-t ${theme.border} px-4 py-9 sm:px-8`}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
          <p className="font-display text-base font-semibold">{restaurant.name}</p>
          {(restaurant.address || restaurant.contact_phone || restaurant.contact_email) && (
            <div
              className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs ${theme.mutedText}`}
            >
              {restaurant.address && <span>{restaurant.address}</span>}
              {restaurant.contact_phone && (
                <>
                  {restaurant.address && <span aria-hidden="true">·</span>}
                  <span className="font-mono">{restaurant.contact_phone}</span>
                </>
              )}
              {restaurant.contact_email && (
                <>
                  {(restaurant.address || restaurant.contact_phone) && (
                    <span aria-hidden="true">·</span>
                  )}
                  <span>{restaurant.contact_email}</span>
                </>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
