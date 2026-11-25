# Supabase Setup Guide — CarteQR Digital Menu Platform

Follow these exact steps to connect your real Supabase backend:

## 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy your **Project URL** and **anon / public key** from **Project Settings -> API**.
   - **Never** expose the `service_role` key in frontend code or `VITE_*` variables.

## 2. Configure Environment Variables
Add these two variables to your `.env` (or AI Studio Secrets panel):
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

## 3. Run the Database & Storage Migration
1. Open the **SQL Editor** in your Supabase Dashboard.
2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql` and run it.
3. This provisions:
   - `restaurants`, `restaurant_admins`, `categories`, and `products` tables
   - Indexes, `CHECK` constraints, `ON DELETE SET NULL` foreign key integrity, and `updated_at` triggers
   - Row Level Security (RLS) policies for strict admin isolation and read-only public menus
   - `menu-images` public Storage bucket with per-restaurant folder upload/delete policies
   - `provision_initial_restaurant` RPC for first-time restaurant creation

## 4. Provision the Administrator Account
Public registration is disabled by design. To create the sole administrator account:
1. In Supabase Dashboard, go to **Authentication -> Users -> Add user -> Create new user**.
2. Enter the administrator's email and a strong password (check **Auto Confirm User**).
3. Also under **Authentication -> URL Configuration**, add your app's reset URL to **Redirect URLs**:
   - `https://your-app-domain.com/admin/reset-password`
4. Sign in at `/admin/login`. On first sign-in, initialize your restaurant name and permanent QR slug (or link it via SQL using the comment block at the bottom of `001_initial_schema.sql`).
