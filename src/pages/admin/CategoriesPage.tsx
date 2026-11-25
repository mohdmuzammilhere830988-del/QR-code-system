import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Edit2,
  Eye,
  EyeOff,
  FolderPlus,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../lib/supabase';
import {
  createCategory,
  deleteCategorySafely,
  listCategories,
  reorderCategories,
  updateCategory,
} from '../../services/categoryService';
import { listProducts } from '../../services/productService';
import type { Category, Product } from '../../types/database';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageTransition } from '../../components/ui/MotionPrimitives';

export function CategoriesPage() {
  const { restaurant } = useAuth();
  const { showToast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Safe Delete modal state
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteStrategy, setDeleteStrategy] = useState<'nullify' | 'reassign'>('nullify');
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadData = useCallback(async () => {
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
      setError(getErrorMessage(err, 'Unable to load categories.'));
    } finally {
      setLoading(false);
    }
  }, [restaurant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!restaurant) return null;

  const productCountByCategory = new Map<string, number>();
  for (const p of products) {
    if (p.category_id) {
      productCountByCategory.set(p.category_id, (productCountByCategory.get(p.category_id) ?? 0) + 1);
    }
  }

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description ?? '');
    setIsActive(cat.is_active);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateCategory(editing.id, restaurant.id, {
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        });
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast({ type: 'success', title: 'Category updated', description: updated.name });
      } else {
        const nextOrder =
          categories.length > 0 ? Math.max(...categories.map((c) => c.display_order)) + 1 : 0;
        const created = await createCategory(restaurant.id, {
          name: name.trim(),
          description: description.trim() || null,
          display_order: nextOrder,
          is_active: isActive,
        });
        setCategories((prev) => [...prev, created]);
        showToast({ type: 'success', title: 'Category created', description: created.name });
      }
      setModalOpen(false);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Save failed',
        description: getErrorMessage(err, 'Unable to save category.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const updated = await updateCategory(cat.id, restaurant.id, { is_active: !cat.is_active });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast({
        type: 'info',
        title: updated.is_active ? 'Category enabled' : 'Category hidden',
        description: updated.name,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Update failed',
        description: getErrorMessage(err, 'Could not update category status.'),
      });
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((c, idx) => ({ ...c, display_order: idx }));

    setCategories(normalized);
    try {
      await reorderCategories(
        restaurant.id,
        normalized.map((c) => c.id)
      );
      showToast({ type: 'success', title: 'Category order saved' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Reorder failed',
        description: getErrorMessage(err, 'Could not save category order.'),
      });
      loadData();
    }
  };

  const openDeleteDialog = (cat: Category) => {
    const remaining = categories.filter((c) => c.id !== cat.id);
    setDeletingCategory(cat);
    setDeleteStrategy('nullify');
    setReassignTargetId(remaining[0]?.id ?? '');
  };

  const confirmDelete = async () => {
    if (!deletingCategory) return;
    if (deleteStrategy === 'reassign' && !reassignTargetId) {
      showToast({ type: 'error', title: 'Select a target category for reassignment.' });
      return;
    }

    setDeletingBusy(true);
    try {
      const action =
        deleteStrategy === 'reassign'
          ? ({ mode: 'reassign', targetCategoryId: reassignTargetId } as const)
          : ({ mode: 'nullify' } as const);

      await deleteCategorySafely(deletingCategory.id, restaurant.id, action);

      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      setProducts((prev) =>
        prev.map((p) => {
          if (p.category_id !== deletingCategory.id) return p;
          return {
            ...p,
            category_id: action.mode === 'reassign' ? action.targetCategoryId : null,
          };
        })
      );
      showToast({
        type: 'success',
        title: 'Category deleted safely',
        description: 'All associated products were preserved.',
      });
      setDeletingCategory(null);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: getErrorMessage(err, 'Unable to delete category.'),
      });
    } finally {
      setDeletingBusy(false);
    }
  };

  const deletingProductCount = deletingCategory
    ? productCountByCategory.get(deletingCategory.id) ?? 0
    : 0;
  const remainingCategories = deletingCategory
    ? categories.filter((c) => c.id !== deletingCategory.id)
    : [];

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">
            Organize menu sections in the exact order displayed to guests.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white transition-colors hover:bg-[#143326] whitespace-nowrap shrink-0"
        >
          <FolderPlus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E6E4DF] bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            <div className="h-14 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-14 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-14 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : categories.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-semibold text-zinc-900">No categories created yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create categories such as Starters, Mains, Desserts, or Beverages to structure your menu.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white hover:bg-[#143326]"
            >
              <FolderPlus className="h-4 w-4" />
              Create First Category
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E4DF]">
            {categories.map((cat, idx) => {
              const count = productCountByCategory.get(cat.id) ?? 0;
              return (
                <div
                  key={cat.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#F7F6F3]/60 sm:px-6"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move ${cat.name} up`}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[#E6E4DF] bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 1)}
                        disabled={idx === categories.length - 1}
                        aria-label={`Move ${cat.name} down`}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[#E6E4DF] bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-zinc-900">{cat.name}</h3>
                        <span className="text-xs text-zinc-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-xs tabular-nums text-zinc-500">
                          {count} {count === 1 ? 'product' : 'products'}
                        </span>
                        <span className="text-xs text-zinc-400" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            cat.is_active ? 'text-[#15803D]' : 'text-zinc-500'
                          }`}
                        >
                          {cat.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{cat.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      {cat.is_active ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5 text-[#15803D]" />
                          Enable
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      aria-label={`Edit ${cat.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E4DF] bg-white text-zinc-700 hover:bg-zinc-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteDialog(cat)}
                      aria-label={`Delete ${cat.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E4DF] bg-white text-[#B91C1C] hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => (saving ? undefined : setModalOpen(false))}
              className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-[#E6E4DF] bg-white p-6 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
                <h2 className="text-base font-semibold text-zinc-900">
                  {editing ? 'Edit Category' : 'Add Category'}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close modal"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="cat-name" className="block text-xs font-medium text-zinc-700">
                    Category Name
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Wood-Fired Pizzas"
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="cat-desc" className="block text-xs font-medium text-zinc-700">
                    Description (optional)
                  </label>
                  <textarea
                    id="cat-desc"
                    rows={2}
                    maxLength={400}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief note shown beneath the category heading"
                    className="mt-1.5 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-[#1B4332]"
                  />
                  <span className="text-sm font-medium text-zinc-900">
                    Visible on public QR menu
                  </span>
                </label>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                    className="h-10 rounded-xl border border-[#E6E4DF] bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-[#1B4332] px-5 text-sm font-medium text-white hover:bg-[#143326] disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Safe Category Deletion Dialog */}
      <ConfirmDialog
        open={Boolean(deletingCategory)}
        title={`Delete "${deletingCategory?.name ?? ''}"?`}
        description={
          deletingProductCount > 0
            ? `This category contains ${deletingProductCount} ${
                deletingProductCount === 1 ? 'product' : 'products'
              }. Deleting the category will never delete those products.`
            : 'No products are currently assigned to this category.'
        }
        confirmLabel="Delete Category"
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingCategory(null)}
      >
        {deletingProductCount > 0 && (
          <div className="space-y-3 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-4">
            <p className="text-xs font-semibold text-zinc-800">
              How should associated products be handled?
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-700">
              <input
                type="radio"
                name="delete-strategy"
                checked={deleteStrategy === 'nullify'}
                onChange={() => setDeleteStrategy('nullify')}
                className="mt-0.5 accent-[#1B4332]"
              />
              <span>Keep products as Uncategorized</span>
            </label>

            {remainingCategories.length > 0 && (
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-700">
                  <input
                    type="radio"
                    name="delete-strategy"
                    checked={deleteStrategy === 'reassign'}
                    onChange={() => setDeleteStrategy('reassign')}
                    className="mt-0.5 accent-[#1B4332]"
                  />
                  <span>Reassign products to another category</span>
                </label>

                {deleteStrategy === 'reassign' && (
                  <select
                    value={reassignTargetId}
                    onChange={(e) => setReassignTargetId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                  >
                    {remainingCategories.map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>
    </PageTransition>
  );
}
