// Shared frontend types (mirrors backend API shapes)
export interface Product {
  id: number;
  sku: string;
  slug: string;
  title: string;
  titleEn: string;
  titleAr: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  price: number;
  compareAtPrice: number | null;
  flashPrice: number | null;
  flashSaleEndsAt: string | null;
  discountPercent: number | null;
  stock: number;
  lowStockThreshold: number;
  category: { id: number; name: string; nameAr: string | null; slug: string } | null;
  brand: { id: number; name: string; slug: string } | null;
  images: { id: number; url: string; alt: string | null }[];
  thumbnail: string;
  variants: { id: number; name: string; size: string | null; color: string | null; price: number; stock: number; sku: string; imageUrl: string | null }[];
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  weightKg: number | null;
  dimensions: string | null;
  shippingNote: string | null;
  specifications: { label: string; value: string }[] | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  videoUrl: string | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  inFlashSale: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  nameEn: string;
  nameAr: string | null;
  slug: string;
  description?: string | null;
  imageUrl: string | null;
  bannerUrl?: string | null;
  productCount?: number;
  children?: { id: number; name: string; nameEn?: string; slug: string }[];
}

export interface OrderItemDto {
  id: number;
  productId: number | null;
  title: string;
  titleAr: string | null;
  sku: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl: string | null;
}

export type OrderStatus =
  | 'NEW' | 'CONFIRMED' | 'PROCESSING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURNED' | 'FAILED_DELIVERY' | 'COD_COLLECTED';

export interface OrderDto {
  id: number;
  orderNumber: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  emirate: string;
  area: string;
  address: string;
  building: string | null;
  apartment: string | null;
  landmark: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  status: OrderStatus;
  couponCode: string | null;
  riskFlags: { type: string; reason: string; detail?: string }[];
  isDemo: boolean;
  courierName: string | null;
  trackingNumber: string | null;
  adminNote: string | null;
  deliveryEstimate: string | null;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItemDto[];
  statusHistory: { status: OrderStatus; note: string | null; changedByName: string | null; createdAt: string }[];
}

export interface PublicSettings {
  'store.name': string;
  'store.nameAr': string;
  'store.tagline': string;
  'store.logo': string;
  'store.favicon': string;
  'store.email': string;
  'store.phone': string;
  'store.whatsapp': string;
  'store.currency': string;
  'store.country': string;
  'store.defaultLanguage': string;
  'store.workingHours': string;
  'shipping.zones': { name: string; emirates: string[]; fee: number; codFee: number }[];
  'shipping.freeShippingThreshold': number;
  'shipping.minOrderAmount': number;
  'shipping.deliveryEstimateDays': string;
  'shipping.codAvailable': boolean;
  'orders.prefix': string;
  'announcement.enabled': boolean;
  'announcement.text': string;
  'announcement.textAr': string;
  'announcement.link': string;
  'popups.salesEnabled': boolean;
  'popups.salesIntervalSec': number;
  'popups.salesDurationMs': number;
  'popups.salesMaxPerDay': number;
  'popups.salesMaskNames': boolean;
  'popups.discountEnabled': boolean;
  'popups.discountTitle': string;
  'popups.discountTitleAr': string;
  'popups.discountCode': string;
  'popups.discountDelaySec': number;
  'popups.discountFrequencyDays': number;
  'popups.exitIntentEnabled': boolean;
  'popups.newsletterEnabled': boolean;
  'popups.newsletterDelaySec': number;
  'popups.newsletterFrequencyDays': number;
  'theme.primaryColor': string;
  'theme.accentColor': string;
  'seo.title': string;
  'seo.titleAr': string;
  'seo.description': string;
  'seo.descriptionAr': string;
  'seo.ogImage': string;
  'social.instagram': string;
  'social.tiktok': string;
  'social.facebook': string;
  'social.youtube': string;
  'social.twitter': string;
  'footer.aboutText': string;
  'footer.aboutTextAr': string;
  'footer.copyright': string;
  'footer.copyrightAr': string;
  'checkout.emailRequired': boolean;
  'checkout.notesEnabled': boolean;
  'analytics.gaId': string;
  'analytics.metaPixelId': string;
  'analytics.tiktokPixelId': string;
  'maintenance.enabled': boolean;
  'maintenance.message': string;
  demoMode: boolean;
  [key: string]: unknown;
}

export interface HomepageSectionDto {
  id: number;
  type: string;
  title: string | null;
  titleAr: string | null;
  subtitle: string | null;
  subtitleAr: string | null;
  config: Record<string, unknown>;
  sortOrder: number;
  isEnabled?: boolean;
}

export interface CartItem {
  productId: number;
  variantId?: number | null;
  quantity: number;
  price: number;
  title: string;
  titleAr?: string | null;
  image?: string;
  slug?: string;
  stock?: number;
  variantName?: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface Pagination { page: number; limit: number; total: number; pages: number }
