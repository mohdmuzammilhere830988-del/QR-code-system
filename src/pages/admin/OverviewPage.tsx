import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FolderKanban,
  QrCode,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getPublicMenuUrl, isPrivateAiStudioDevOrigin } from '../../lib/qr';
import { getErrorMessage } from '../../lib/supabase';
import { listCategories } from '../../services/categoryService';
import { listProducts } from '../../services/productService';
import { formatPrice, type Category, type Product } from '../../types/database';
import { PageTransition, SkeletonCard } from '../../components/ui/MotionPrimitives';
import { ProductImage } from '../../components/ui/ProductImage';

export function OverviewPage() {
  const { restaurant } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStats = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        listCategories(restaurant.id),
        listProducts(restaurant.id),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load dashboard statistics.'));
    } finally {
      setLoading(false);
    }
  }, [restaurant]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!restaurant) return null;

  const totalProducts = products.length;
  const totalCategories = categories.length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const inactiveProducts = totalProducts - activeProducts;
  const menuUrl = getPublicMenuUrl(restaurant.slug);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      showToast({ type: 'success', title: 'Menu URL copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', title: 'Copy failed', description: 'Copy the URL manually.' });
    }
  };

  return (
    <PageTransition className="space-y-6">
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadStats}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-red-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-5">
            <p className="text-xs font-medium text-zinc-500">Total Products</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">
              {totalProducts}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Stored in menu catalog</p>
          </div>

          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-5">
            <p className="text-xs font-medium text-zinc-500">Total Categories</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">
              {totalCategories}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">
              {categories.filter((c) => c.is_active).length} active on menu
            </p>
          </div>

          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-5">
            <p className="text-xs font-medium text-zinc-500">Active Products</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums text-[#15803D]">
              {activeProducts}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Visible to QR guests</p>
          </div>

          <div className="rounded-2xl border border-[#E6E4DF] bg-white p-5">
            <p className="text-xs font-medium text-zinc-500">Inactive Products</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums text-zinc-700">
              {inactiveProducts}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Hidden from public menu</p>
          </div>
        </div>
      )}

      {/* QR Menu Status Banner + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500">Universal QR Menu Status</p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {restaurant.is_menu_active ? 'Public Menu Active' : 'Public Menu Paused'}
                </h2>
                <span className="text-xs text-zinc-400" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`text-xs font-semibold ${
                    restaurant.is_menu_active ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}
                >
                  {restaurant.is_menu_active ? 'Live for scanning' : 'Hidden from guests'}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                Your permanent menu URL remains constant across every product, price, and category update.
              </p>
            </div>

            <Link
              to="/admin/qr"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B4332] px-4 text-xs font-medium text-white transition-colors hover:bg-[#143326] whitespace-nowrap shrink-0"
            >
              <QrCode className="h-4 w-4" />
              Manage QR Code
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] px-3.5 py-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800">
              {menuUrl}
            </span>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#15803D]" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {isPrivateAiStudioDevOrigin(menuUrl) ? (
              <Link
                to={`/menu/${encodeURIComponent(restaurant.slug)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                <span>Open</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                <span>Open</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6E4DF] bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">Quick Actions</h2>
          <div className="mt-4 space-y-2.5">
            <Link
              to="/admin/menu"
              className="flex items-center justify-between rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#F7F6F3]"
            >
              <span className="flex items-center gap-2.5">
                <UtensilsCrossed className="h-4 w-4 text-[#1B4332]" />
                Manage Menu Items
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
            <Link
              to="/admin/categories"
              className="flex items-center justify-between rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#F7F6F3]"
            >
              <span className="flex items-center gap-2.5">
                <FolderKanban className="h-4 w-4 text-[#1B4332]" />
                Organize Categories
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
            <Link
              to="/admin/settings"
              className="flex items-center justify-between rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-[#F7F6F3]"
            >
              <span className="flex items-center gap-2.5">
                <QrCode className="h-4 w-4 text-[#1B4332]" />
                Restaurant &amp; Theme Settings
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recently Updated Products */}
      <div className="rounded-2xl border border-[#E6E4DF] bg-white">
        <div className="flex items-center justify-between border-b border-[#E6E4DF] px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Recently Updated Products</h2>
          <Link
            to="/admin/menu"
            className="text-xs font-medium text-[#1B4332] hover:underline"
          >
            View all products
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            <div className="h-12 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-12 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : recentProducts.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-zinc-900">No menu items yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Create your first category and add dishes in Menu Management to publish your QR menu.
            </p>
            <Link
              to="/admin/menu"
              className="mt-4 inline-flex h-9 items-center rounded-xl bg-[#1B4332] px-4 text-xs font-medium text-white hover:bg-[#143326]"
            >
              Add First Product
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E4DF]">
            {recentProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-[#F7F6F3]/60"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    containerClassName="h-12 w-12 shrink-0 p-1"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{product.name}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      <span>
                        {product.category_id
                          ? categoryMap.get(product.category_id) ?? 'Uncategorized'
                          : 'Uncategorized'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span className={product.is_active ? 'text-[#15803D]' : 'text-zinc-500'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                    {formatPrice(product.price, restaurant.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
