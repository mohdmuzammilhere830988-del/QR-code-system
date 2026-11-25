import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../lib/supabase';
import { listCategories } from '../../services/categoryService';
import {
  deleteProduct,
  duplicateProduct,
  listProducts,
  reorderProducts,
  updateProduct,
} from '../../services/productService';
import { formatPrice, type Category, type Product } from '../../types/database';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageTransition } from '../../components/ui/MotionPrimitives';
import { ProductImage } from '../../components/ui/ProductImage';
import { ProductFormModal } from '../../components/admin/ProductFormModal';

export function MenuManagementPage() {
  const { restaurant } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Delete Confirm
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([
        listProducts(restaurant.id),
        listCategories(restaurant.id),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load menu products.'));
    } finally {
      setLoading(false);
    }
  }, [restaurant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter === 'uncategorized' && p.category_id !== null) return false;
      if (
        categoryFilter !== 'all' &&
        categoryFilter !== 'uncategorized' &&
        p.category_id !== categoryFilter
      ) {
        return false;
      }
      if (statusFilter === 'active' && !p.is_active) return false;
      if (statusFilter === 'inactive' && p.is_active) return false;
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [products, categoryFilter, statusFilter, searchQuery]);

  const isFiltered =
    searchQuery.trim() !== '' || categoryFilter !== 'all' || statusFilter !== 'all';

  if (!restaurant) return null;

  const nextDisplayOrder =
    products.length > 0 ? Math.max(...products.map((p) => p.display_order)) + 1 : 0;

  const handleSaved = (saved: Product, isNew: boolean) => {
    setProducts((prev) => {
      const next = isNew
        ? [...prev, saved]
        : prev.map((p) => (p.id === saved.id ? saved : p));
      return next.sort((a, b) => a.display_order - b.display_order);
    });
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const updated = await updateProduct(product.id, restaurant.id, {
        is_active: !product.is_active,
      });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast({
        type: 'info',
        title: updated.is_active ? 'Product activated' : 'Product deactivated',
        description: updated.name,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Status update failed',
        description: getErrorMessage(err, 'Unable to update product.'),
      });
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const created = await duplicateProduct(product, restaurant.id, nextDisplayOrder);
      setProducts((prev) => [...prev, created]);
      showToast({
        type: 'success',
        title: 'Product duplicated',
        description: `${created.name} created as inactive draft.`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Duplication failed',
        description: getErrorMessage(err, 'Unable to duplicate product.'),
      });
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (isFiltered) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const reordered = [...products];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((p, idx) => ({ ...p, display_order: idx }));

    setProducts(normalized);
    try {
      await reorderProducts(
        restaurant.id,
        normalized.map((p) => p.id)
      );
      showToast({ type: 'success', title: 'Product order updated' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Reorder failed',
        description: getErrorMessage(err, 'Unable to update order.'),
      });
      loadData();
    }
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    setDeletingBusy(true);
    try {
      await deleteProduct(deletingProduct, restaurant.id);
      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      showToast({
        type: 'success',
        title: 'Product deleted',
        description: deletingProduct.name,
      });
      setDeletingProduct(null);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: getErrorMessage(err, 'Unable to delete product.'),
      });
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E6E4DF] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[210px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="h-10 w-full rounded-xl border border-[#E6E4DF] bg-[#F7F6F3]/60 pr-3.5 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#1B4332] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-[#E6E4DF] bg-white px-3 text-sm text-zinc-800 focus:border-[#1B4332] focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-0.5">
            {(['all', 'active', 'inactive'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white transition-colors hover:bg-[#143326] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Products List */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E4DF] bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-semibold text-zinc-900">
              {products.length === 0 ? 'Your menu catalog is empty' : 'No matching products'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {products.length === 0
                ? 'Add your first dish or beverage with uncropped photography and pricing.'
                : 'Try clearing your search or category filter.'}
            </p>
            {products.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(true);
                }}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white hover:bg-[#143326]"
              >
                <Plus className="h-4 w-4" />
                Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#E6E4DF]">
            {filteredProducts.map((product, idx) => (
              <div
                key={product.id}
                className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-[#F7F6F3]/60 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {!isFiltered && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move ${product.name} up`}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[#E6E4DF] bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 1)}
                        disabled={idx === filteredProducts.length - 1}
                        aria-label={`Move ${product.name} down`}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[#E6E4DF] bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Strictly object-contain image preview */}
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    containerClassName="h-20 w-24 shrink-0 p-1.5"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="truncate text-sm font-semibold text-zinc-900">
                        {product.name}
                      </h3>
                      <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                        {formatPrice(product.price, restaurant.currency)}
                      </span>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span>
                        {product.category_id
                          ? categoryMap.get(product.category_id) ?? 'Uncategorized'
                          : 'Uncategorized'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-medium ${
                          product.is_active ? 'text-[#15803D]' : 'text-zinc-500'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {product.image_source !== 'none' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {product.image_source === 'upload' ? 'Uploaded image' : 'External URL'}
                          </span>
                        </>
                      )}
                    </div>

                    {product.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Row Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(product)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    {product.is_active ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5 text-[#15803D]" />
                        Activate
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicate(product)}
                    title="Duplicate product"
                    aria-label={`Duplicate ${product.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E4DF] bg-white text-zinc-700 hover:bg-zinc-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(product);
                      setFormOpen(true);
                    }}
                    title="Edit product"
                    aria-label={`Edit ${product.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E4DF] bg-white text-zinc-700 hover:bg-zinc-50"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingProduct(product)}
                    title="Delete product"
                    aria-label={`Delete ${product.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E4DF] bg-white text-[#B91C1C] hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        restaurantId={restaurant.id}
        currency={restaurant.currency}
        categories={categories}
        editingProduct={editingProduct}
        nextDisplayOrder={nextDisplayOrder}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title={`Delete "${deletingProduct?.name ?? ''}"?`}
        description="This item will be permanently removed from your menu catalog and public QR menu."
        confirmLabel="Delete Product"
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingProduct(null)}
      />
    </PageTransition>
  );
}
