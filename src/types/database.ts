export type ImageSource = 'upload' | 'url' | 'none';
export type ThemePreference = 'editorial_light' | 'noir_bistro' | 'botanical_sage';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  logo_storage_path: string | null;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  currency: CurrencyCode;
  theme_preference: ThemePreference;
  is_menu_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestaurantAdmin {
  id: string;
  restaurant_id: string;
  user_id: string;
  created_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  image_storage_path: string | null;
  image_source: ImageSource;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicMenuData {
  restaurant: Restaurant;
  categories: Array<{
    category: Category | null; // null represents uncategorized active items
    products: Product[];
  }>;
  totalActiveProducts: number;
}

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; label: string; locale: string }> = {
  INR: { symbol: '₹', label: 'INR (₹)', locale: 'en-IN' },
  USD: { symbol: '$', label: 'USD ($)', locale: 'en-US' },
  EUR: { symbol: '€', label: 'EUR (€)', locale: 'en-IE' },
  GBP: { symbol: '£', label: 'GBP (£)', locale: 'en-GB' },
  AED: { symbol: 'AED', label: 'AED', locale: 'en-AE' },
};

export function formatPrice(amount: number, currency: CurrencyCode = 'INR'): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.INR;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return `${meta.symbol}0.00`;
  }
  const hasDecimals = Math.round(numeric * 100) % 100 !== 0;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${meta.symbol}${numeric.toFixed(hasDecimals ? 2 : 0)}`;
  }
}
