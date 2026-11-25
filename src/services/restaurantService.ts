import { requireSupabase } from '../lib/supabase';
import type {
  Category,
  CurrencyCode,
  Product,
  PublicMenuData,
  Restaurant,
  ThemePreference,
} from '../types/database';

export interface RestaurantSettingsUpdate {
  name?: string;
  slug?: string;
  logo_url?: string | null;
  logo_storage_path?: string | null;
  description?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  currency?: CurrencyCode;
  theme_preference?: ThemePreference;
  is_menu_active?: boolean;
}

export async function updateRestaurantSettings(
  restaurantId: string,
  updates: RestaurantSettingsUpdate
): Promise<Restaurant> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.slug !== undefined) payload.slug = updates.slug.trim().toLowerCase();
  if (updates.logo_url !== undefined) payload.logo_url = updates.logo_url;
  if (updates.logo_storage_path !== undefined) payload.logo_storage_path = updates.logo_storage_path;
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
  if (updates.contact_phone !== undefined) payload.contact_phone = updates.contact_phone?.trim() || null;
  if (updates.contact_email !== undefined) payload.contact_email = updates.contact_email?.trim() || null;
  if (updates.address !== undefined) payload.address = updates.address?.trim() || null;
  if (updates.currency !== undefined) payload.currency = updates.currency;
  if (updates.theme_preference !== undefined) payload.theme_preference = updates.theme_preference;
  if (updates.is_menu_active !== undefined) payload.is_menu_active = updates.is_menu_active;

  const { data, error } = await client
    .from('restaurants')
    .update(payload)
    .eq('id', restaurantId)
    .select()
    .single();

  if (error) throw error;
  return data as Restaurant;
}

export async function isSlugAvailable(slug: string, currentRestaurantId: string): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('restaurants')
    .select('id')
    .eq('slug', slug.trim().toLowerCase())
    .neq('id', currentRestaurantId)
    .maybeSingle();

  if (error) throw error;
  return data === null;
}

export async function getPublicMenuBySlug(slug: string): Promise<PublicMenuData | null> {
  const client = requireSupabase();
  const cleanSlug = slug.trim().toLowerCase();

  const { data: restaurant, error: restError } = await client
    .from('restaurants')
    .select(
      'id, name, slug, logo_url, description, contact_phone, contact_email, address, currency, theme_preference, is_menu_active, created_at, updated_at'
    )
    .eq('slug', cleanSlug)
    .eq('is_menu_active', true)
    .maybeSingle();

  if (restError) throw restError;
  if (!restaurant) return null;

  const [catRes, prodRes] = await Promise.all([
    client
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    client
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;

  const categories = (catRes.data ?? []) as Category[];
  const products = (prodRes.data ?? []).map((p) => ({
    ...(p as Product),
    price: Number((p as Product).price),
  }));

  const grouped: PublicMenuData['categories'] = [];
  const activeCategoryIds = new Set(categories.map((c) => c.id));

  for (const cat of categories) {
    const items = products.filter((p) => p.category_id === cat.id);
    // Hide categories that have no active products
    if (items.length > 0) {
      grouped.push({ category: cat, products: items });
    }
  }

  // Uncategorized active items (if any exist with category_id = null)
  const uncategorized = products.filter(
    (p) => p.category_id === null || !activeCategoryIds.has(p.category_id)
  );
  // Only include items whose category_id is strictly null (if category was inactive, RLS already hides it)
  const strictlyUncategorized = uncategorized.filter((p) => p.category_id === null);
  if (strictlyUncategorized.length > 0) {
    grouped.push({ category: null, products: strictlyUncategorized });
  }

  const totalActiveProducts = grouped.reduce((sum, g) => sum + g.products.length, 0);

  return {
    restaurant: restaurant as Restaurant,
    categories: grouped,
    totalActiveProducts,
  };
}
