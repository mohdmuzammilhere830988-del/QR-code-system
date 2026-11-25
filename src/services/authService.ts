import type { Session, User } from '@supabase/supabase-js';
import { requireSupabase } from '../lib/supabase';
import type { CurrencyCode, Restaurant } from '../types/database';

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOutAdmin() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const client = requireSupabase();
  const redirectTo = `${window.location.origin}/admin/reset-password`;
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw error;
}

export async function updateAdminPassword(newPassword: string) {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function fetchAdminRestaurant(user: User): Promise<Restaurant | null> {
  const client = requireSupabase();
  const { data: adminLink, error: linkError } = await client
    .from('restaurant_admins')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!adminLink) return null;

  const { data: restaurant, error: restError } = await client
    .from('restaurants')
    .select('*')
    .eq('id', adminLink.restaurant_id)
    .single();

  if (restError) throw restError;
  return restaurant as Restaurant;
}

export async function provisionInitialRestaurant(input: {
  name: string;
  slug: string;
  currency: CurrencyCode;
  description?: string;
}): Promise<Restaurant> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('provision_initial_restaurant', {
    p_name: input.name.trim(),
    p_slug: input.slug.trim().toLowerCase(),
    p_currency: input.currency,
    p_description: input.description?.trim() || null,
  });
  if (error) throw error;
  return data as Restaurant;
}
