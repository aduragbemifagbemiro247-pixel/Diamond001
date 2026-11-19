export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order: number;
  is_active?: number;
  product_count?: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  price_override_kobo: number | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_stock: number;
  low_stock_threshold?: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  name: string;
  slug: string;
  sku: string;
  description: string;
  regular_price_kobo: number;
  sale_price_kobo: number | null;
  is_featured: boolean;
  is_bestseller: boolean;
  status: 'draft' | 'published' | 'hidden';
  low_stock_threshold: number;
  return_policy_override?: string | null;
  created_at: string;
  images: ProductImage[];
  variants: ProductVariant[];
  total_available_stock: number;
}

export interface PaymentMethodOption {
  id: 'paystack' | 'flutterwave' | 'bank_transfer' | 'cash_on_delivery';
  label: string;
  mode?: 'test' | 'live';
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  instructions?: string;
}

export interface StorefrontData {
  settings: {
    general: {
      store_name: string;
      store_logo_text: string;
      location: string;
      currency: string;
      timezone: string;
      business_email: string;
      business_phone: string;
      whatsapp_number: string;
      social_links: {
        instagram?: string;
        x?: string;
        facebook?: string;
      };
    };
    delivery: {
      nigeria_enabled: boolean;
      international_enabled: boolean;
      default_fee_kobo: number;
      default_payable_on_arrival: boolean;
      notes: string;
    };
    returns: {
      enabled: boolean;
      deadline_days: number;
      conditions: string;
    };
  };
  content: Record<
    string,
    {
      title: string;
      body: Record<string, unknown>;
      updated_at: string;
    }
  >;
  categories: Category[];
  payment_methods: PaymentMethodOption[];
}

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantSku: string;
  size: string;
  color: string;
  unitPriceKobo: number;
  imageUrl: string;
  quantity: number;
  maxStock: number;
}

export interface CustomerUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  whatsapp_number?: string | null;
  role: string;
  status?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'super_admin' | 'store_manager' | 'product_manager' | 'order_manager' | 'content_manager';
  is_active: boolean;
  permissions: string[];
}

export function formatNGN(kobo: number | null | undefined): string {
  const naira = (Number(kobo || 0) / 100);
  return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getEffectivePriceKobo(product: Product, variant?: ProductVariant | null): number {
  if (variant?.price_override_kobo !== null && variant?.price_override_kobo !== undefined) {
    return variant.price_override_kobo;
  }
  if (product.sale_price_kobo !== null && product.sale_price_kobo < product.regular_price_kobo) {
    return product.sale_price_kobo;
  }
  return product.regular_price_kobo;
}

export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}
