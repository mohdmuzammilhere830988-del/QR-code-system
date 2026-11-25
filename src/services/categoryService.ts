import { requireSupabase } from '../lib/supabase';
import type { Category } from '../types/database';

export interface CategoryInput {
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

export async function listCategories(restaurantId: string): Promise<Category[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(restaurantId: string, input: CategoryInput): Promise<Category> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('categories')
    .insert({
      restaurant_id: restaurantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      display_order: input.display_order,
      is_active: input.is_active,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  categoryId: string,
  restaurantId: string,
  updates: Partial<CategoryInput>
): Promise<Category> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
  if (updates.display_order !== undefined) payload.display_order = updates.display_order;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { data, error } = await client
    .from('categories')
    .update(payload)
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function reorderCategories(
  restaurantId: string,
  orderedCategoryIds: string[]
): Promise<void> {
  const client = requireSupabase();
  const updates = orderedCategoryIds.map((id, index) =>
    client
      .from('categories')
      .update({ display_order: index })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export type CategoryDeleteAction =
  | { mode: 'nullify' }
  | { mode: 'reassign'; targetCategoryId: string };

export async function deleteCategorySafely(
  categoryId: string,
  restaurantId: string,
  action: CategoryDeleteAction
): Promise<void> {
  const client = requireSupabase();

  if (action.mode === 'reassign') {
    const { error: reassignErr } = await client
      .from('products')
      .update({ category_id: action.targetCategoryId })
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId);

    if (reassignErr) throw reassignErr;
  } else {
    const { error: nullifyErr } = await client
      .from('products')
      .update({ category_id: null })
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId);

    if (nullifyErr) throw nullifyErr;
  }

  const { error: deleteErr } = await client
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId);

  if (deleteErr) throw deleteErr;
}
