-- ============================================================================
-- CarteQR: Restaurant Digital QR Menu System
-- Complete PostgreSQL Schema, Indexes, Triggers, RLS Policies & Storage Rules
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Automatic updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Tables

-- A. Restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 80),
  logo_url TEXT NULL CHECK (logo_url IS NULL OR logo_url ~* '^https?://'),
  logo_storage_path TEXT NULL,
  description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 600),
  contact_phone TEXT NULL CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40),
  contact_email TEXT NULL CHECK (contact_email IS NULL OR char_length(contact_email) <= 120),
  address TEXT NULL CHECK (address IS NULL OR char_length(address) <= 300),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED')),
  theme_preference TEXT NOT NULL DEFAULT 'editorial_light' CHECK (theme_preference IN ('editorial_light', 'noir_bistro', 'botanical_sage')),
  is_menu_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B. Restaurant Administrators (Strict 1-to-1 admin per restaurant for v1)
CREATE TABLE IF NOT EXISTS public.restaurant_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- C. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 400),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- D. Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NULL CHECK (description IS NULL OR char_length(description) <= 600),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT NULL CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  image_storage_path TEXT NULL,
  image_source TEXT NOT NULL DEFAULT 'none' CHECK (image_source IN ('upload', 'url', 'none')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurant_admins_user_id ON public.restaurant_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order ON public.categories(restaurant_id, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_order ON public.products(restaurant_id, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- 5. Triggers
DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Authorization Helper Function (prevents recursive RLS checks)
CREATE OR REPLACE FUNCTION public.is_restaurant_admin(target_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_admins ra
    WHERE ra.restaurant_id = target_restaurant_id
      AND ra.user_id = auth.uid()
  );
$$;

-- Helper for storage object paths formatted as "<restaurant_uuid>/..."
CREATE OR REPLACE FUNCTION public.is_restaurant_storage_owner(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folder_part TEXT;
  rest_uuid UUID;
BEGIN
  folder_part := (storage.foldername(object_name))[1];
  IF folder_part IS NULL THEN
    RETURN FALSE;
  END IF;
  rest_uuid := folder_part::UUID;
  RETURN public.is_restaurant_admin(rest_uuid);
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN FALSE;
END;
$$;

-- 7. Initial Restaurant Provisioning RPC (only for authenticated Supabase Auth admin with no restaurant yet)
CREATE OR REPLACE FUNCTION public.provision_initial_restaurant(
  p_name TEXT,
  p_slug TEXT,
  p_currency TEXT DEFAULT 'INR',
  p_description TEXT DEFAULT NULL
)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_restaurant public.restaurants;
  v_clean_slug TEXT := lower(trim(p_slug));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.restaurant_admins WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'This administrator account is already linked to a restaurant';
  END IF;

  INSERT INTO public.restaurants (name, slug, currency, description)
  VALUES (trim(p_name), v_clean_slug, COALESCE(NULLIF(trim(p_currency), ''), 'INR'), NULLIF(trim(p_description), ''))
  RETURNING * INTO v_restaurant;

  INSERT INTO public.restaurant_admins (restaurant_id, user_id)
  VALUES (v_restaurant.id, v_user_id);

  RETURN v_restaurant;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_initial_restaurant(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_initial_restaurant(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_admin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_storage_owner(TEXT) TO anon, authenticated;

-- 8. Explicit Schema & Table Privileges (Least-Privilege, paired with RLS below)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON TABLE public.restaurants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.restaurants TO anon, authenticated;
GRANT UPDATE ON TABLE public.restaurants TO authenticated;

REVOKE ALL ON TABLE public.restaurant_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.restaurant_admins TO authenticated;

REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;

REVOKE ALL ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;

-- 9. Row Level Security (RLS)
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Restaurants Policies
DROP POLICY IF EXISTS "Public read active restaurants" ON public.restaurants;
CREATE POLICY "Public read active restaurants"
  ON public.restaurants
  FOR SELECT
  TO anon, authenticated
  USING (is_menu_active = TRUE);

DROP POLICY IF EXISTS "Admin read own restaurant" ON public.restaurants;
CREATE POLICY "Admin read own restaurant"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_admin(id));

DROP POLICY IF EXISTS "Admin update own restaurant" ON public.restaurants;
CREATE POLICY "Admin update own restaurant"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_admin(id))
  WITH CHECK (public.is_restaurant_admin(id));

-- Restaurant Admins Policies (Read own link only; no client insert/update/delete to prevent escalation)
DROP POLICY IF EXISTS "Admin read own membership" ON public.restaurant_admins;
CREATE POLICY "Admin read own membership"
  ON public.restaurant_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Categories Policies
DROP POLICY IF EXISTS "Public read active categories of active restaurants" ON public.categories;
CREATE POLICY "Public read active categories of active restaurants"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.is_menu_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Admin read own categories" ON public.categories;
CREATE POLICY "Admin read own categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

DROP POLICY IF EXISTS "Admin insert own categories" ON public.categories;
CREATE POLICY "Admin insert own categories"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_admin(restaurant_id));

DROP POLICY IF EXISTS "Admin update own categories" ON public.categories;
CREATE POLICY "Admin update own categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_admin(restaurant_id))
  WITH CHECK (public.is_restaurant_admin(restaurant_id));

DROP POLICY IF EXISTS "Admin delete own categories" ON public.categories;
CREATE POLICY "Admin delete own categories"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

-- Products Policies
DROP POLICY IF EXISTS "Public read active products of active restaurants" ON public.products;
CREATE POLICY "Public read active products of active restaurants"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.is_menu_active = TRUE
    )
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = category_id AND c.is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Admin read own products" ON public.products;
CREATE POLICY "Admin read own products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

DROP POLICY IF EXISTS "Admin insert own products" ON public.products;
CREATE POLICY "Admin insert own products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_restaurant_admin(restaurant_id)
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = category_id AND c.restaurant_id = products.restaurant_id
      )
    )
  );

DROP POLICY IF EXISTS "Admin update own products" ON public.products;
CREATE POLICY "Admin update own products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_admin(restaurant_id))
  WITH CHECK (
    public.is_restaurant_admin(restaurant_id)
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = category_id AND c.restaurant_id = products.restaurant_id
      )
    )
  );

DROP POLICY IF EXISTS "Admin delete own products" ON public.products;
CREATE POLICY "Admin delete own products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

-- 9. Supabase Storage Bucket & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read menu images" ON storage.objects;
CREATE POLICY "Public read menu images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Restaurant admin upload images" ON storage.objects;
CREATE POLICY "Restaurant admin upload images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.is_restaurant_storage_owner(name)
  );

DROP POLICY IF EXISTS "Restaurant admin update images" ON storage.objects;
CREATE POLICY "Restaurant admin update images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND public.is_restaurant_storage_owner(name)
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.is_restaurant_storage_owner(name)
  );

DROP POLICY IF EXISTS "Restaurant admin delete images" ON storage.objects;
CREATE POLICY "Restaurant admin delete images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND public.is_restaurant_storage_owner(name)
  );

-- ============================================================================
-- OPTIONAL MANUAL PROVISIONING REFERENCE:
-- After creating your admin user in Supabase Dashboard -> Authentication -> Users,
-- you can either sign in at /admin/login and initialize your restaurant once,
-- OR manually link them via SQL:
--
-- INSERT INTO public.restaurants (name, slug, currency)
-- VALUES ('Your Restaurant Name', 'your-restaurant-slug', 'INR')
-- RETURNING id;
--
-- INSERT INTO public.restaurant_admins (restaurant_id, user_id)
-- VALUES ('<RESTAURANT_UUID>', '<AUTH_USER_UUID>');
-- ============================================================================
