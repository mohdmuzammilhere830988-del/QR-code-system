import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, Link as LinkIcon, Trash2, Upload, X } from 'lucide-react';
import type { Category, CurrencyCode, ImageSource, Product } from '../../types/database';
import { CURRENCY_META } from '../../types/database';
import { getErrorMessage } from '../../lib/supabase';
import { validateExternalImageUrl, validateImageFile } from '../../lib/validation';
import {
  createProduct,
  deleteStorageImageIfUnused,
  updateProduct,
  uploadImageWithProgress,
} from '../../services/productService';
import { ProductImage } from '../ui/ProductImage';
import { useToast } from '../../context/ToastContext';

interface ProductFormModalProps {
  open: boolean;
  restaurantId: string;
  currency: CurrencyCode;
  categories: Category[];
  editingProduct: Product | null;
  nextDisplayOrder: number;
  onClose: () => void;
  onSaved: (product: Product, isNew: boolean) => void;
}

export function ProductFormModal({
  open,
  restaurantId,
  currency,
  categories,
  editingProduct,
  nextDisplayOrder,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState<string>('0');
  const [isActive, setIsActive] = useState(true);

  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imageSource, setImageSource] = useState<ImageSource>('none');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);

  // Method B external URL input state
  const [externalUrlInput, setExternalUrlInput] = useState('');
  const [externalUrlError, setExternalUrlError] = useState<string | null>(null);
  const [externalImageLoadError, setExternalImageLoadError] = useState(false);

  // Method A upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Track newly uploaded files during modal session so we can clean up unused ones on cancel
  const [sessionUploadedPaths, setSessionUploadedPaths] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;

    if (editingProduct) {
      setName(editingProduct.name);
      setPrice(String(editingProduct.price));
      setCategoryId(editingProduct.category_id ?? '');
      setDescription(editingProduct.description ?? '');
      setDisplayOrder(String(editingProduct.display_order));
      setIsActive(editingProduct.is_active);
      setImageSource(editingProduct.image_source);
      setImageUrl(editingProduct.image_url);
      setImageStoragePath(editingProduct.image_storage_path);
      setImageTab(editingProduct.image_source === 'url' ? 'url' : 'upload');
      setExternalUrlInput(
        editingProduct.image_source === 'url' && editingProduct.image_url
          ? editingProduct.image_url
          : ''
      );
    } else {
      setName('');
      setPrice('');
      setCategoryId('');
      setDescription('');
      setDisplayOrder(String(nextDisplayOrder));
      setIsActive(true);
      setImageTab('upload');
      setImageSource('none');
      setImageUrl(null);
      setImageStoragePath(null);
      setExternalUrlInput('');
    }

    setExternalUrlError(null);
    setExternalImageLoadError(false);
    setUploadError(null);
    setUploadProgress(0);
    setFormError(null);
    setSessionUploadedPaths([]);
  }, [open, editingProduct, nextDisplayOrder]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const check = validateImageFile(file);
    if (!check.valid) {
      setUploadError(check.error ?? 'Invalid file.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(5);

    try {
      const result = await uploadImageWithProgress(
        restaurantId,
        'products',
        file,
        (pct) => setUploadProgress(pct)
      );

      setSessionUploadedPaths((prev) => [...prev, result.storagePath]);
      setImageSource('upload');
      setImageUrl(result.publicUrl);
      setImageStoragePath(result.storagePath);
      setExternalImageLoadError(false);
      setExternalUrlError(null);
    } catch (err) {
      setUploadError(getErrorMessage(err, 'Failed to upload image.'));
    } finally {
      setUploading(false);
    }
  };

  const handleApplyExternalUrl = () => {
    const res = validateExternalImageUrl(externalUrlInput);
    if (!res.valid || !res.normalized) {
      setExternalUrlError(res.error ?? 'Invalid image URL.');
      return;
    }
    setExternalUrlError(null);
    setExternalImageLoadError(false);
    setImageSource('url');
    setImageUrl(res.normalized);
    setImageStoragePath(null);
  };

  const handleExternalUrlChange = (val: string) => {
    setExternalUrlInput(val);
    if (!val.trim()) {
      setExternalUrlError(null);
      setExternalImageLoadError(false);
      if (imageSource === 'url') {
        setImageSource('none');
        setImageUrl(null);
      }
      return;
    }
    const res = validateExternalImageUrl(val);
    if (res.valid && res.normalized) {
      setExternalUrlError(null);
      setExternalImageLoadError(false);
      setImageSource('url');
      setImageUrl(res.normalized);
      setImageStoragePath(null);
    }
  };

  const handleClearImage = () => {
    setImageSource('none');
    setImageUrl(null);
    setImageStoragePath(null);
    setExternalUrlInput('');
    setExternalUrlError(null);
    setExternalImageLoadError(false);
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleCancel = async () => {
    // Cleanup any orphaned files uploaded in this cancelled session
    for (const path of sessionUploadedPaths) {
      try {
        await deleteStorageImageIfUnused(restaurantId, path);
      } catch {
        // ignore cleanup failures
      }
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Product name is required.');
      return;
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFormError('Please enter a valid non-negative price.');
      return;
    }

    if (imageTab === 'url' && externalUrlInput.trim()) {
      const res = validateExternalImageUrl(externalUrlInput);
      if (!res.valid) {
        setExternalUrlError(res.error ?? 'Please enter a valid public image URL.');
        setFormError('Fix the external image URL before saving.');
        return;
      }
      if (externalImageLoadError) {
        setFormError('The provided image URL could not be loaded. Replace it or remove the image.');
        return;
      }
    }

    const parsedOrder = Number.parseInt(displayOrder, 10);
    const safeOrder = Number.isFinite(parsedOrder) ? parsedOrder : 0;

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        description: description.trim() || null,
        price: parsedPrice,
        category_id: categoryId || null,
        image_url: imageUrl,
        image_storage_path: imageStoragePath,
        image_source: imageSource,
        is_active: isActive,
        display_order: safeOrder,
      };

      let saved: Product;
      if (editingProduct) {
        saved = await updateProduct(editingProduct.id, restaurantId, payload);
        // Clean up replaced storage file if old file differs from new one
        if (
          editingProduct.image_storage_path &&
          editingProduct.image_storage_path !== imageStoragePath
        ) {
          try {
            await deleteStorageImageIfUnused(
              restaurantId,
              editingProduct.image_storage_path,
              editingProduct.id
            );
          } catch {
            // non-fatal
          }
        }
        // Also clean up any intermediate uploads from this session not kept
        for (const p of sessionUploadedPaths) {
          if (p !== imageStoragePath) {
            try {
              await deleteStorageImageIfUnused(restaurantId, p, editingProduct.id);
            } catch {
              // ignore
            }
          }
        }
        showToast({ type: 'success', title: 'Product updated', description: saved.name });
        onSaved(saved, false);
      } else {
        saved = await createProduct(restaurantId, payload);
        for (const p of sessionUploadedPaths) {
          if (p !== imageStoragePath) {
            try {
              await deleteStorageImageIfUnused(restaurantId, p, saved.id);
            } catch {
              // ignore
            }
          }
        }
        showToast({ type: 'success', title: 'Product created', description: saved.name });
        onSaved(saved, true);
      }
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Unable to save product.'));
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = CURRENCY_META[currency]?.symbol ?? '₹';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={saving || uploading ? undefined : handleCancel}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E6E4DF] bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6E4DF] px-6 py-4">
              <h2 id="product-modal-title" className="text-base font-semibold text-zinc-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving || uploading}
                aria-label="Close product form"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
              <div className="space-y-6 p-6">
                {formError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[#B91C1C]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Product Image Section (Method A & Method B) */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-zinc-900">
                      Product Image
                    </label>
                    <div className="inline-flex rounded-lg border border-[#E6E4DF] bg-[#F7F6F3] p-0.5">
                      <button
                        type="button"
                        onClick={() => setImageTab('upload')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          imageTab === 'upload'
                            ? 'bg-white text-zinc-900 shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Device File
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageTab('url')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          imageTab === 'url'
                            ? 'bg-white text-zinc-900 shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        External Image URL
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                    {/* Uncropped Preview Box (strictly object-contain) */}
                    <div className="space-y-2">
                      <ProductImage
                        src={imageUrl}
                        alt={name || 'Product preview'}
                        containerClassName="h-44 w-full"
                        onImageLoad={() => setExternalImageLoadError(false)}
                        onImageError={() => {
                          if (imageSource === 'url' && imageUrl) {
                            setExternalImageLoadError(true);
                          }
                        }}
                      />
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={handleClearImage}
                          disabled={uploading}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E6E4DF] bg-white py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[#B91C1C]" />
                          Remove image
                        </button>
                      )}
                    </div>

                    {/* Active Method Panel */}
                    <div className="flex flex-col justify-center">
                      {imageTab === 'upload' ? (
                        <div className="rounded-xl border border-dashed border-zinc-300 bg-[#F7F6F3] p-4">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            onChange={handleFileSelected}
                            className="hidden"
                          />
                          <p className="text-xs font-medium text-zinc-800">
                            Upload directly to Supabase Storage
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Supports JPG, JPEG, PNG, and WEBP up to 5 MB. Images are never cropped.
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1B4332] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#143326] disabled:opacity-60"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {imageSource === 'upload' && imageUrl ? 'Replace Image' : 'Choose Image'}
                            </button>
                          </div>

                          {uploading && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs text-zinc-600">
                                <span>Uploading...</span>
                                <span className="font-mono tabular-nums">{uploadProgress}%</span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                                <div
                                  className="h-full bg-[#1B4332] transition-all duration-150"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {uploadError && (
                            <p className="mt-2.5 text-xs font-medium text-[#B91C1C]">
                              {uploadError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-4">
                          <label
                            htmlFor="external-image-url"
                            className="block text-xs font-medium text-zinc-800"
                          >
                            Public Image URL (HTTP / HTTPS)
                          </label>
                          <div className="mt-2 flex gap-2">
                            <input
                              id="external-image-url"
                              type="url"
                              value={externalUrlInput}
                              onChange={(e) => handleExternalUrlChange(e.target.value)}
                              placeholder="https://example.com/dish.jpg"
                              className="h-9 min-w-0 flex-1 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#1B4332] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleApplyExternalUrl}
                              className="h-9 rounded-lg border border-[#E6E4DF] bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0"
                            >
                              Preview
                            </button>
                          </div>
                          {externalUrlError && (
                            <p className="mt-2 text-xs font-medium text-[#B91C1C]">
                              {externalUrlError}
                            </p>
                          )}
                          {externalImageLoadError && !externalUrlError && (
                            <p className="mt-2 text-xs font-medium text-[#B91C1C]">
                              Unable to load an image from this URL. Verify the link is publicly accessible.
                            </p>
                          )}
                          <p className="mt-2 text-[11px] text-zinc-500">
                            Images display at their full aspect ratio using object-fit: contain.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Core Fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="prod-name" className="block text-xs font-medium text-zinc-700">
                      Product Name
                    </label>
                    <input
                      id="prod-name"
                      type="text"
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Truffle Mushroom Risotto"
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-price" className="block text-xs font-medium text-zinc-700">
                      Price ({currencySymbol})
                    </label>
                    <input
                      id="prod-price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 font-mono text-sm tabular-nums text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-category" className="block text-xs font-medium text-zinc-700">
                      Category
                    </label>
                    <select
                      id="prod-category"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} {!cat.is_active ? '(Hidden)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="prod-desc" className="block text-xs font-medium text-zinc-700">
                      Description (optional)
                    </label>
                    <textarea
                      id="prod-desc"
                      rows={3}
                      maxLength={600}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ingredients, preparation notes, or portion details"
                      className="mt-1.5 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-order" className="block text-xs font-medium text-zinc-700">
                      Display Order
                    </label>
                    <input
                      id="prod-order"
                      type="number"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#E6E4DF] bg-white px-3.5 font-mono text-sm tabular-nums text-zinc-900 focus:border-[#1B4332] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] px-4 py-2.5 w-full">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 accent-[#1B4332]"
                      />
                      <span className="text-sm font-medium text-zinc-900">
                        Available on public menu
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-[#E6E4DF] bg-[#F7F6F3]/60 px-6 py-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving || uploading}
                  className="h-10 rounded-xl border border-[#E6E4DF] bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="h-10 rounded-xl bg-[#1B4332] px-5 text-sm font-medium text-white transition-colors hover:bg-[#143326] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
