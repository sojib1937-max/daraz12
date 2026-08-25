// Shop / Category / Search — one component, driven by query params.
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SlidersHorizontal, X, Search as SearchIcon, Package } from 'lucide-react';
import { api } from '../lib/api';
import { useT, useLang } from '../i18n';
import { useDebounce, useDocumentTitle, useScrollTop } from '../hooks';
import { ProductCard, ProductCardSkeleton } from '../components/storefront/ProductCard';
import { EmptyState, Pagination } from '../components/ui';
import type { Category, Pagination as Pag, Product } from '../lib/types';

const SORTS = [
  { v: 'newest', label: 'shop.sortNewest' },
  { v: 'price_asc', label: 'shop.sortPriceAsc' },
  { v: 'price_desc', label: 'shop.sortPriceDesc' },
  { v: 'popular', label: 'shop.sortPopular' },
  { v: 'rating', label: 'shop.sortRating' },
];

export function Shop() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const params = new URLSearchParams(location.search);

  const isCategory = !!slug;
  const isSearch = location.pathname === '/search';

  const [products, setProducts] = useState<Product[] | null>(null);
  const [pagination, setPagination] = useState<Pag | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [categoryMeta, setCategoryMeta] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const debouncedQ = useDebounce(q, 400);
  const sort = params.get('sort') || 'newest';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const brand = params.get('brand') || '';
  const category = params.get('category') || slug || '';

  useScrollTop();

  useEffect(() => {
    api.get<Category[]>('/api/categories').then(setCategories).catch(() => undefined);
    api.get<{ id: number; name: string; slug: string }[]>('/api/brands').then(setBrands).catch(() => undefined);
    if (isCategory && slug) {
      api.get<Category>(`/api/categories/${slug}`).then(setCategoryMeta).catch(() => undefined);
    }
  }, [isCategory, slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', '12');
    qs.set('sort', sort);
    if (debouncedQ) qs.set('q', debouncedQ);
    if (category) qs.set('category', category);
    if (brand) qs.set('brand', brand);
    if (min) qs.set('min', min);
    if (max) qs.set('max', max);
    api
      .get<{ items: Product[]; pagination: Pag }>(`/api/products?${qs.toString()}`)
      .then((d) => {
        if (!cancelled) {
          setProducts(d.items);
          setPagination(d.pagination);
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, sort, debouncedQ, category, brand, min, max, lang]);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    const base = isCategory ? `/category/${slug}` : isSearch ? '/search' : '/shop';
    navigate(`${base}?${next.toString()}`);
  };

  const title = useMemo(() => {
    if (isCategory) return categoryMeta?.name || t('shop.title');
    if (isSearch && q) return `"${q}"`;
    return t('shop.title');
  }, [isCategory, isSearch, q, categoryMeta, t]);

  useDocumentTitle(`${title} — DesertCart UAE`);

  const filterBar = (
    <FilterBar
      categories={categories}
      brands={brands}
      sort={sort}
      min={min}
      max={max}
      brand={brand}
      category={category}
      updateParams={updateParams}
      t={t}
      onClose={() => setFiltersOpen(false)}
    />
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
      <nav className="text-xs text-ink/45 mb-4 flex items-center gap-1.5 flex-wrap" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">{t('nav.home')}</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-brand-700">{t('nav.shop')}</Link>
        {isCategory && categoryMeta && (
          <>
            <span>/</span>
            <span className="text-ink/70 font-semibold">{categoryMeta.name}</span>
          </>
        )}
        {isSearch && q && (
          <>
            <span>/</span>
            <span className="text-ink/70 font-semibold">{q}</span>
          </>
        )}
      </nav>

      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-extrabold text-ink">
          {isCategory && categoryMeta?.name ? categoryMeta.name : title}
        </h1>
        <button className="btn-outline lg:hidden !py-2.5 !px-4 text-sm" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={16} /> {t('shop.filters')}
        </button>
      </div>

      {categoryMeta?.description && (
        <p className="text-sm text-ink/55 mb-6 max-w-3xl">{categoryMeta.description}</p>
      )}

      <div className="flex gap-8">
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">{filterBar}</div>
        </aside>

        {filtersOpen && (
          <div className="fixed inset-0 z-[85] lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={() => setFiltersOpen(false)} />
            <div className="absolute inset-y-0 start-0 w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto animate-slide-in-left">
              <div className="flex items-center justify-between p-4 border-b border-ink/8 sticky top-0 bg-white z-10">
                <span className="font-bold">{t('shop.filters')}</span>
                <button onClick={() => setFiltersOpen(false)} className="p-2 rounded-lg hover:bg-ink/5" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">{filterBar}</div>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 text-sm text-ink/50">
            <span>
              {pagination ? t('shop.results', { n: pagination.total }) : '…'}
            </span>
            <select
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="input !w-auto !py-2 !text-sm lg:hidden"
              aria-label={t('shop.sort')}
            >
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>{t(s.label)}</option>
              ))}
            </select>
          </div>

          {error ? (
            <EmptyState icon={<Package />} title="Failed to load products" subtitle={error} />
          ) : loading && !products ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {[...Array(8)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products && products.length === 0 ? (
            <EmptyState
              icon={<SearchIcon />}
              title={t('shop.noResults')}
              subtitle={t('shop.noResultsSub')}
              action={
                <button className="btn-outline !py-2.5 !px-5 text-sm" onClick={() => navigate(isCategory ? '/shop' : '/shop')}>
                  {t('shop.clear')}
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
                {products?.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
              </div>
              {pagination && <Pagination page={pagination.page} pages={pagination.pages} onChange={(p) => updateParams({ page: String(p) })} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  categories, brands, sort, min, max, brand, category, updateParams, t, onClose,
}: {
  categories: Category[];
  brands: { id: number; name: string; slug: string }[];
  sort: string;
  min: string;
  max: string;
  brand: string;
  category: string;
  updateParams: (patch: Record<string, string | null>) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const [minV, setMinV] = useState(min);
  const [maxV, setMaxV] = useState(max);
  const activeCount = [brand, min, max, sort !== 'newest' ? sort : ''].filter(Boolean).length;

  return (
    <div className="grid gap-6">
      <div>
        <p className="label">{t('shop.sort')}</p>
        <div className="grid gap-1">
          {SORTS.map((s) => (
            <button
              key={s.v}
              onClick={() => updateParams({ sort: s.v })}
              className={`text-start px-3 py-2 rounded-lg text-sm font-medium ${sort === s.v ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink/65 hover:bg-ink/5'}`}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">{t('shop.category')}</p>
        <div className="grid gap-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => updateParams({ category: null })}
            className={`text-start px-3 py-1.5 rounded-lg text-sm ${!category ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink/65 hover:bg-ink/5'}`}
          >
            {t('shop.allProducts')}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => updateParams({ category: c.slug })}
              className={`text-start px-3 py-1.5 rounded-lg text-sm ${category === c.slug ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink/65 hover:bg-ink/5'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {brands.length > 0 && (
        <div>
          <p className="label">{t('shop.brand')}</p>
          <div className="grid gap-1">
            <button
              onClick={() => updateParams({ brand: null })}
              className={`text-start px-3 py-1.5 rounded-lg text-sm ${!brand ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink/65 hover:bg-ink/5'}`}
            >
              All
            </button>
            {brands.map((b) => (
              <button
                key={b.slug}
                onClick={() => updateParams({ brand: b.slug })}
                className={`text-start px-3 py-1.5 rounded-lg text-sm ${brand === b.slug ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink/65 hover:bg-ink/5'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="label">{t('shop.priceRange')}</p>
        <div className="flex items-center gap-2">
          <input type="number" value={minV} onChange={(e) => setMinV(e.target.value)} placeholder={t('shop.minPrice')} className="input !py-2 text-sm" min={0} />
          <span className="text-ink/30">–</span>
          <input type="number" value={maxV} onChange={(e) => setMaxV(e.target.value)} placeholder={t('shop.maxPrice')} className="input !py-2 text-sm" min={0} />
        </div>
        <button
          className="btn-primary w-full !py-2.5 text-sm mt-3"
          onClick={() => {
            updateParams({ min: minV, max: maxV });
            onClose();
          }}
        >
          {t('shop.apply')}
        </button>
        {activeCount > 0 && (
          <button className="w-full text-center text-xs font-semibold text-ink/45 hover:text-red-500 mt-2" onClick={() => updateParams({ brand: null, min: null, max: null, sort: 'newest' })}>
            {t('shop.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
