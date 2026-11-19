import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Plus, Search, Trash2 } from 'lucide-react';
import { Product, apiFetch, formatNGN } from '../../types/store';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useStore } from '../../context/StoreContext';

export const AdminProductsPage: React.FC = () => {
  const { notify } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadProducts = () => {
    setLoading(true);
    apiFetch<{ products: Product[] }>('/api/admin/products')
      .then((res) => setProducts(res.products))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load products.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (product: Product) => {
    try {
      const res = await apiFetch<{ archived?: boolean; message?: string }>(
        `/api/admin/products/${product.id}`,
        { method: 'DELETE' }
      );
      notify(res.message || `${product.name} removed.`, 'info');
      loadProducts();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Products &amp; Inventory</h1>
          <p className="text-xs text-[#707782] mt-1">Manage catalogue items, variant SKUs, pricing, and stock levels.</p>
        </div>

        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider self-start"
        >
          <Plus className="w-4 h-4 text-[#D6B875]" /> New Product
        </Link>
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-[#707782]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by product name or SKU..."
          className="flex-1 text-sm focus:outline-none"
        />
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Variants / Stock</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#101820]/5">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#707782]">
                  Loading products...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#707782]">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const totalStock = p.variants.reduce(
                  (s, v) => s + Math.max(0, (v.quantity_on_hand || 0) - (v.quantity_reserved || 0)),
                  0
                );
                return (
                  <tr key={p.id} className="hover:bg-[#F7F5F0]/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 aspect-[4/3] bg-[#EBE7DE] shrink-0 overflow-hidden">
                          <ImageWithFallback
                            src={p.images[0]?.url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-[#101820]">{p.name}</p>
                          <p className="text-[11px] text-[#707782]">
                            {p.is_featured ? 'Featured' : ''}
                            {p.is_featured && p.is_bestseller ? ' · ' : ''}
                            {p.is_bestseller ? 'Bestseller' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">{p.sku}</td>
                    <td className="py-3 px-4">{p.category_name || '—'}</td>
                    <td className="py-3 px-4 tabular-nums">
                      <span className="font-semibold">{formatNGN(p.sale_price_kobo ?? p.regular_price_kobo)}</span>
                      {p.sale_price_kobo !== null && p.sale_price_kobo < p.regular_price_kobo && (
                        <span className="block text-[11px] line-through text-[#707782]">
                          {formatNGN(p.regular_price_kobo)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {p.variants.length} variants · <strong>{totalStock}</strong> units
                    </td>
                    <td className="py-3 px-4 capitalize">{p.status}</td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to={`/admin/products/${p.id}/edit`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#101820]/20 hover:bg-[#101820] hover:text-[#FFFFFF]"
                      >
                        <Edit className="w-3 h-3" /> Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-700 hover:bg-red-700 hover:text-[#FFFFFF]"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
