import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Product, apiFetch } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/layout/ProductCard';
import { SeoHead } from '../../components/common/SeoHead';

export const ShopPage: React.FC = () => {
  const { slug: routeCategorySlug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { storefront } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<{ sizes: string[]; colors: { color: string; color_hex: string }[] }>({
    sizes: [],
    colors: [],
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeCategory = routeCategorySlug || searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'latest';
  const size = searchParams.get('size') || '';
  const color = searchParams.get('color') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';
  const onSale = searchParams.get('onSale') === 'true';
  const page = Number(searchParams.get('page') || 1);

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = new URLSearchParams();
    if (activeCategory) qs.set('category', activeCategory);
    if (search) qs.set('search', search);
    if (sort) qs.set('sort', sort);
    if (size) qs.set('size', size);
    if (color) qs.set('color', color);
    if (minPrice) qs.set('minPrice', minPrice);
    if (maxPrice) qs.set('maxPrice', maxPrice);
    if (inStock) qs.set('inStock', 'true');
    if (onSale) qs.set('onSale', 'true');
    qs.set('page', String(page));
    qs.set('limit', '12');

    apiFetch<{
      items: Product[];
      pagination: { page: number; total: number; total_pages: number };
      facets: { sizes: string[]; colors: { color: string; color_hex: string }[] };
    }>(`/api/products?${qs.toString()}`)
      .then((res) => {
        if (!active) return;
        setProducts(res.items);
        setPagination(res.pagination);
        setFacets(res.facets);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeCategory, search, sort, size, color, minPrice, maxPrice, inStock, onSale, page]);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const categoryObj = storefront?.categories.find((c) => c.slug === activeCategory);
  const pageHeading = categoryObj ? categoryObj.name : 'Shop Collection';

  const filterPanel = (
    <div className="space-y-6">
      {!routeCategorySlug && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#101820]">Category</h3>
          <div className="mt-3 space-y-2 text-sm">
            <button
              type="button"
              onClick={() => updateParam('category', null)}
              className={`block text-left w-full ${!activeCategory ? 'font-semibold text-[#101820]' : 'text-[#707782] hover:text-[#101820]'}`}
            >
              All Collections
            </button>
            {storefront?.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => updateParam('category', c.slug)}
                className={`block text-left w-full ${activeCategory === c.slug ? 'font-semibold text-[#101820]' : 'text-[#707782] hover:text-[#101820]'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-5 border-t border-[#101820]/10">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#101820]">Price Range (₦)</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min ₦"
            value={minPrice}
            onChange={(e) => updateParam('minPrice', e.target.value || null)}
            className="w-full bg-[#FFFFFF] border border-[#101820]/15 px-3 py-2 text-xs tabular-nums"
          />
          <input
            type="number"
            min={0}
            placeholder="Max ₦"
            value={maxPrice}
            onChange={(e) => updateParam('maxPrice', e.target.value || null)}
            className="w-full bg-[#FFFFFF] border border-[#101820]/15 px-3 py-2 text-xs tabular-nums"
          />
        </div>
      </div>

      {facets.sizes.length > 0 && (
        <div className="pt-5 border-t border-[#101820]/10">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#101820]">Size</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateParam('size', size === s ? null : s)}
                className={`px-3 py-1.5 text-xs border transition-colors ${
                  size === s
                    ? 'bg-[#101820] text-[#FFFFFF] border-[#101820]'
                    : 'bg-[#FFFFFF] text-[#101820] border-[#101820]/15 hover:border-[#101820]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.colors.length > 0 && (
        <div className="pt-5 border-t border-[#101820]/10">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#101820]">Colour</h3>
          <div className="mt-3 space-y-2 text-xs">
            {facets.colors.map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => updateParam('color', color === c.color ? null : c.color)}
                className={`flex items-center gap-2.5 w-full text-left py-1 ${
                  color === c.color ? 'font-semibold text-[#101820]' : 'text-[#707782] hover:text-[#101820]'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 border border-[#101820]/20 shrink-0"
                  style={{ backgroundColor: c.color_hex || '#101820' }}
                />
                <span>{c.color}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-5 border-t border-[#101820]/10 space-y-2.5 text-sm">
        <label className="flex items-center gap-2.5 cursor-pointer text-[#101820]">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : null)}
            className="accent-[#101820]"
          />
          <span>In Stock Only</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer text-[#101820]">
          <input
            type="checkbox"
            checked={onSale}
            onChange={(e) => updateParam('onSale', e.target.checked ? 'true' : null)}
            className="accent-[#101820]"
          />
          <span>Special Offers Only</span>
        </label>
      </div>

      <button
        type="button"
        onClick={clearAllFilters}
        className="w-full py-2.5 border border-[#101820]/20 text-xs font-semibold uppercase tracking-wider text-[#101820] hover:bg-[#101820] hover:text-[#FFFFFF] transition-colors"
      >
        Reset Filters
      </button>
    </div>
  );

  return (
    <>
      <SeoHead
        title={`${pageHeading} — Diamond Store`}
        description={categoryObj?.description || "Browse Diamond Store's curated collection of men's clothing, shoes, and accessories."}
        canonicalPath={routeCategorySlug ? `/category/${routeCategorySlug}` : '/shop'}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Breadcrumb & Header */}
        <nav className="text-xs text-[#707782] flex items-center gap-2">
          <Link to="/" className="hover:text-[#101820]">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-[#101820]">Shop</Link>
          {categoryObj && (
            <>
              <span>/</span>
              <span className="text-[#101820]">{categoryObj.name}</span>
            </>
          )}
        </nav>

        <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#101820]/10">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#101820]">{pageHeading}</h1>
            {categoryObj?.description && (
              <p className="mt-2 text-sm text-[#707782] max-w-2xl">{categoryObj.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateParam('search', searchInput.trim() || null);
              }}
              className="flex items-center border border-[#101820]/15 bg-[#FFFFFF]"
            >
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
                className="px-3 py-2 text-xs w-44 sm:w-56 focus:outline-none"
              />
              <button type="submit" aria-label="Search" className="p-2 text-[#101820] hover:text-[#B5954F]">
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>

            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              aria-label="Sort products"
              className="bg-[#FFFFFF] border border-[#101820]/15 px-3 py-2 text-xs font-medium text-[#101820] focus:outline-none"
            >
              <option value="latest">Sort: Latest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="bestselling">Best Selling</option>
              <option value="featured">Featured</option>
            </select>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 border border-[#101820]/20 bg-[#FFFFFF] text-xs font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
            </button>
          </div>
        </div>

        {/* Mobile Filters */}
        {mobileFiltersOpen && (
          <div className="lg:hidden mt-6 p-5 bg-[#FFFFFF] border border-[#101820]/15">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider">Filter Products</span>
              <button type="button" onClick={() => setMobileFiltersOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {filterPanel}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">{filterPanel}</div>
          </aside>

          {/* Product Grid */}
          <div className="lg:col-span-9">
            <div className="mb-4 text-xs text-[#707782] tabular-nums">
              Showing {products.length} of {pagination.total} items
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-80 bg-[#FFFFFF] border border-[#101820]/10 animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#101820]/10 p-12 text-center">
                <h2 className="font-serif text-xl font-semibold text-[#101820]">No matching items found</h2>
                <p className="mt-2 text-sm text-[#707782]">
                  Try clearing one or more filters or adjusting your search query.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-5 px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {pagination.total_pages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    {Array.from({ length: pagination.total_pages }, (_, idx) => idx + 1).map((pNum) => (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => updateParam('page', String(pNum))}
                        className={`w-9 h-9 text-xs font-semibold tabular-nums border transition-colors ${
                          page === pNum
                            ? 'bg-[#101820] text-[#FFFFFF] border-[#101820]'
                            : 'bg-[#FFFFFF] text-[#101820] border-[#101820]/15 hover:border-[#101820]'
                        }`}
                      >
                        {pNum}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
