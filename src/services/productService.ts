import { requireSupabase, supabaseConfigDetails } from '../lib/supabase';
import { validateImageFile } from '../lib/validation';
import type { ImageSource, Product } from '../types/database';

export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  image_source: ImageSource;
  is_active: boolean;
  display_order: number;
}

const STORAGE_BUCKET = 'menu-images';

export async function listProducts(restaurantId: string): Promise<Product[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as Product),
    price: Number((row as Product).price),
  }));
}

export async function createProduct(restaurantId: string, input: ProductInput): Promise<Product> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('products')
    .insert({
      restaurant_id: restaurantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: Number(input.price.toFixed(2)),
      category_id: input.category_id || null,
      image_url: input.image_url,
      image_storage_path: input.image_storage_path,
      image_source: input.image_source,
      is_active: input.is_active,
      display_order: input.display_order,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...(data as Product), price: Number((data as Product).price) };
}

export async function updateProduct(
  productId: string,
  restaurantId: string,
  updates: Partial<ProductInput>
): Promise<Product> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
  if (updates.price !== undefined) payload.price = Number(updates.price.toFixed(2));
  if (updates.category_id !== undefined) payload.category_id = updates.category_id || null;
  if (updates.image_url !== undefined) payload.image_url = updates.image_url;
  if (updates.image_storage_path !== undefined) payload.image_storage_path = updates.image_storage_path;
  if (updates.image_source !== undefined) payload.image_source = updates.image_source;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;
  if (updates.display_order !== undefined) payload.display_order = updates.display_order;

  const { data, error } = await client
    .from('products')
    .update(payload)
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();

  if (error) throw error;
  return { ...(data as Product), price: Number((data as Product).price) };
}

export async function duplicateProduct(
  source: Product,
  restaurantId: string,
  nextOrder: number
): Promise<Product> {
  return createProduct(restaurantId, {
    name: `${source.name} (Copy)`,
    description: source.description,
    price: source.price,
    category_id: source.category_id,
    image_url: source.image_url,
    image_storage_path: source.image_storage_path,
    image_source: source.image_source,
    is_active: false,
    display_order: nextOrder,
  });
}

async function isStoragePathReferencedElsewhere(
  restaurantId: string,
  storagePath: string,
  excludeProductId?: string
): Promise<boolean> {
  const client = requireSupabase();
  let query = client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('image_storage_path', storagePath);

  if (excludeProductId) {
    query = query.neq('id', excludeProductId);
  }
  const { count } = await query;
  return (count ?? 0) > 0;
}

export async function deleteStorageImageIfUnused(
  restaurantId: string,
  storagePath: string | null,
  excludeProductId?: string
): Promise<void> {
  if (!storagePath) return;
  const stillUsed = await isStoragePathReferencedElsewhere(
    restaurantId,
    storagePath,
    excludeProductId
  );
  if (!stillUsed) {
    await deleteStorageImage(storagePath);
  }
}

export async function deleteProduct(product: Product, restaurantId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('products')
    .delete()
    .eq('id', product.id)
    .eq('restaurant_id', restaurantId);

  if (error) throw error;

  if (product.image_storage_path) {
    try {
      await deleteStorageImageIfUnused(restaurantId, product.image_storage_path, product.id);
    } catch {
      // Non-fatal cleanup error; product record is already deleted
    }
  }
}

export async function reorderProducts(
  restaurantId: string,
  orderedProductIds: string[]
): Promise<void> {
  const client = requireSupabase();
  const updates = orderedProductIds.map((id, index) =>
    client
      .from('products')
      .update({ display_order: index })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function uploadImageWithProgress(
  restaurantId: string,
  folder: 'products' | 'logo',
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; publicUrl: string }> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Your administrator session has expired. Please sign in again.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ext === 'jpeg' ? 'jpg' : ext;
  const storagePath = `${restaurantId}/${folder}/${crypto.randomUUID()}.${safeExt}`;
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const uploadEndpoint = `${supabaseConfigDetails.url.replace(/\/+$/, '')}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadEndpoint, true);
    xhr.setRequestHeader('Authorization', `Bearer ${sessionData.session.access_token}`);
    xhr.setRequestHeader('apikey', supabaseConfigDetails.anonKey);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', file.type || `image/${safeExt}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        let message = `Image upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message || parsed?.error) {
            message = parsed.message || parsed.error;
          }
        } catch {
          // keep fallback message
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading image to Supabase Storage.'));
    };

    xhr.send(file);
  });

  const { data: publicData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: publicData.publicUrl,
  };
}

export async function deleteStorageImage(storagePath: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.storage.from(STORAGE_BUCKET).remove([storagePath]);
  if (error) throw error;
}
