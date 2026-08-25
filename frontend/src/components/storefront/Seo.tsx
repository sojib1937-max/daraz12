// SEO helpers: JSON-LD structured data + meta tags.
import { useEffect } from 'react';
import type { Product } from '../../lib/types';
import { useSite } from '../../store';

/** Organization structured data (site-wide). */
export function OrganizationJsonLd() {
  const { settings } = useSite();
  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: settings?.['store.name'] || 'DesertCart',
      url: window.location.origin,
      logo: settings?.['store.logo'] ? String(settings['store.logo']) : `${window.location.origin}/icons/icon-512.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: settings?.['store.phone'] || '',
        contactType: 'customer service',
        areaServed: 'AE',
        availableLanguage: ['en', 'ar'],
      },
      sameAs: [settings?.['social.instagram'], settings?.['social.facebook'], settings?.['social.tiktok']].filter(Boolean),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = JSON.stringify(data);
    el.dataset.seo = 'organization';
    document.head.appendChild(el);
    return () => {
      document.querySelectorAll('script[data-seo="organization"]').forEach((n) => n.remove());
    };
  }, [settings]);
  return null;
}

/** Product + Breadcrumb structured data. */
export function ProductJsonLd({ product }: { product: Product }) {
  const { settings } = useSite();
  useEffect(() => {
    const base = window.location.origin;
    const productData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      image: product.images.map((i) => (i.url.startsWith('http') ? i.url : `${base}${i.url}`)),
      description: product.description || product.title,
      sku: product.sku,
      brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
      aggregateRating: product.ratingCount > 0
        ? { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount }
        : undefined,
      offers: {
        '@type': 'Offer',
        url: `${base}/product/${product.slug}`,
        priceCurrency: String(settings?.['store.currency'] || 'AED'),
        price: (product.flashPrice ?? product.price).toFixed(2),
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    };
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: base },
        ...(product.category
          ? [{ '@type': 'ListItem', position: 2, name: product.category.name, item: `${base}/category/${product.category.slug}` }]
          : []),
        { '@type': 'ListItem', position: product.category ? 3 : 2, name: product.title, item: `${base}/product/${product.slug}` },
      ],
    };
    const s1 = document.createElement('script');
    s1.type = 'application/ld+json';
    s1.text = JSON.stringify(productData);
    s1.dataset.seo = 'product';
    const s2 = document.createElement('script');
    s2.type = 'application/ld+json';
    s2.text = JSON.stringify(breadcrumb);
    s2.dataset.seo = 'breadcrumb';
    document.head.append(s1, s2);
    return () => {
      document.querySelectorAll('script[data-seo="product"], script[data-seo="breadcrumb"]').forEach((n) => n.remove());
    };
  }, [product, settings]);
  return null;
}

/** Generic page meta title/description + Open Graph. */
export function useSeoMeta(opts: { title: string; description?: string; image?: string; type?: string }) {
  useEffect(() => {
    document.title = opts.title;
    const set = (attr: string, content: string, selector?: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector || `meta[${attr}]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, '');
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    set('name', opts.description || '', 'meta[name="description"]');
    set('property', opts.description || '', 'meta[property="og:description"]');
    set('property', opts.title, 'meta[property="og:title"]');
    set('property', opts.type || 'website', 'meta[property="og:type"]');
    if (opts.image) set('property', opts.image, 'meta[property="og:image"]');
    set('name', 'twitter:card', 'meta[name="twitter:card"]');
    set('name', 'twitter:title', 'meta[name="twitter:title"]');
    set('name', opts.description || '', 'meta[name="twitter:description"]');
    // canonical
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`;
  }, [opts.title, opts.description, opts.image, opts.type]);
}
