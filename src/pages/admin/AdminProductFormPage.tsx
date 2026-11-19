import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from 'lucide-react';
import { Category, Product, apiFetch } from '../../types/store';
import { useStore } from '../../context/StoreContext';

interface VariantInput {
  id?: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
}

export const AdminProductFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notify } = useStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [regularNaira, setRegularNaira] = useState('');
  const [saleNaira, setSaleNaira] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'hidden'>('published');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [images, setImages] = useState<{ url: string; alt_text: string }[]>([]);
  const [variants, setVariants] = useState<VariantInput[]>([
    { sku: 'DS-NEW-001-BLK-M', size: 'M', color: 'Midnight Black', color_hex: '#101820', quantity_on_hand: 10, low_stock_threshold: 5 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});

    if (isEdit && id) {
      apiFetch<{ products: Product[] }>('/api/admin/products')
        .then((res) => {
          const found = res.products.find((p) => p.id === id);
          if (!found) return;
          setName(found.name);
          setSlug(found.slug);
          setSku(found.sku);
          setCategoryId(found.category_id || '');
          setDescription(found.description);
          setRegularNaira(String(found.regular_price_kobo / 100));
          setSaleNaira(found.sale_price_kobo !== null ? String(found.sale_price_kobo / 100) : '');
          setStatus(found.status);
          setIsFeatured(found.is_featured);
          setIsBestseller(found.is_bestseller);
          setLowStockThreshold(found.low_stock_threshold);
          setImages(found.images.map((i) => ({ url: i.url, alt_text: i.alt_text })));
          setVariants(
            found.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              color_hex: v.color_hex || '#101820',
              quantity_on_hand: v.quantity_on_hand,
              low_stock_threshold: v.low_stock_threshold ?? found.low_stock_threshold,
            }))
          );
        })
        .catch(() => {});
    }
  }, [id, isEdit]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, data_url: reader.result }),
        });
        setImages((prev) => [...prev, { url: res.url, alt_text: name || file.name }]);
        notify('Image uploaded.', 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Upload failed.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        sku,
        category_id: categoryId || null,
        description,
        regular_price_kobo: Math.round(Number(regularNaira) * 100),
        sale_price_kobo: saleNaira.trim() ? Math.round(Number(saleNaira) * 100) : null,
        is_featured: isFeatured,
        is_bestseller: isBestseller,
        status,
        low_stock_threshold: Number(lowStockThreshold),
        images: images.map((img, i) => ({ ...img, sort_order: i })),
        variants,
      };

      if (isEdit && id) {
        await apiFetch(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('Product updated.', 'success');
      } else {
        await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        notify('Product created.', 'success');
      }
      navigate('/admin/products');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
          {isEdit ? 'Edit Product' : 'New Product'}
        </h1>
        <Link to="/admin/products" className="text-xs font-semibold text-[#707782] hover:text-[#101820]">
          &larr; Back to Products
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Core Details &amp; Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEdit && !slug) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                  }
                }}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Master SKU *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm bg-[#FFFFFF]"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Regular Price (₦) *</label>
              <input
                type="number"
                required
                min={0}
                value={regularNaira}
                onChange={(e) => setRegularNaira(e.target.value)}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sale Price (₦ Optional)</label>
              <input
                type="number"
                min={0}
                value={saleNaira}
                onChange={(e) => setSaleNaira(e.target.value)}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium mb-1">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm bg-[#FFFFFF]"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Low Stock Threshold</label>
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex items-end gap-5 pb-2 text-xs font-medium">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                Featured
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} />
                Bestseller
              </label>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Product Images</h2>
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-[#101820]/20 text-xs font-semibold cursor-pointer hover:bg-[#101820] hover:text-[#FFFFFF]">
              <Upload className="w-3.5 h-3.5" /> Upload Image
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          {images.length === 0 ? (
            <p className="text-xs text-[#707782]">No images uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {images.map((img, idx) => (
                <div key={`${img.url}-${idx}`} className="flex items-center gap-3 p-2 border border-[#101820]/10">
                  <img src={img.url} alt={img.alt_text} className="w-16 aspect-[4/3] object-cover bg-[#EBE7DE]" />
                  <input
                    type="text"
                    value={img.alt_text}
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, alt_text: e.target.value } : item))
                      )
                    }
                    placeholder="Image alt text"
                    className="flex-1 border border-[#101820]/15 px-2.5 py-1.5 text-xs"
                  />
                  <button type="button" onClick={() => moveImage(idx, -1)} className="p-1.5 border border-[#101820]/15">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => moveImage(idx, 1)} className="p-1.5 border border-[#101820]/15">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Independent Variant Inventory */}
        <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-semibold">Variants &amp; Independent Inventory</h2>
              <p className="text-xs text-[#707782]">Each size &amp; colour combination maintains its own SKU and stock record.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  {
                    sku: `${sku || 'DS'}-VAR-${prev.length + 1}`,
                    size: 'L',
                    color: 'Midnight Black',
                    color_hex: '#101820',
                    quantity_on_hand: 5,
                    low_stock_threshold: lowStockThreshold,
                  },
                ])
              }
              className="inline-flex items-center gap-1 px-3 py-2 border border-[#101820]/20 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Variant
            </button>
          </div>

          <div className="space-y-3">
            {variants.map((v, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 p-3 bg-[#F7F5F0] border border-[#101820]/10 items-end">
                <div>
                  <label className="block text-[11px] text-[#707782] mb-1">Variant SKU</label>
                  <input
                    type="text"
                    required
                    value={v.sku}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, sku: e.target.value.toUpperCase() } : row))
                      )
                    }
                    className="w-full bg-[#FFFFFF] border border-[#101820]/15 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#707782] mb-1">Size</label>
                  <input
                    type="text"
                    required
                    value={v.size}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, size: e.target.value } : row))
                      )
                    }
                    className="w-full bg-[#FFFFFF] border border-[#101820]/15 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#707782] mb-1">Colour</label>
                  <input
                    type="text"
                    required
                    value={v.color}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, color: e.target.value } : row))
                      )
                    }
                    className="w-full bg-[#FFFFFF] border border-[#101820]/15 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#707782] mb-1">Hex</label>
                  <input
                    type="color"
                    value={v.color_hex}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, color_hex: e.target.value } : row))
                      )
                    }
                    className="w-full h-8 bg-[#FFFFFF] border border-[#101820]/15 px-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#707782] mb-1">Stock</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={v.quantity_on_hand}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, quantity_on_hand: Number(e.target.value) } : row
                        )
                      )
                    }
                    className="w-full bg-[#FFFFFF] border border-[#101820]/15 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={variants.length <= 1}
                    onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                    className="px-3 py-1.5 text-xs text-red-700 border border-red-200 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/admin/products" className="px-6 py-3 border border-[#101820]/20 text-xs font-semibold uppercase tracking-wider">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider hover:bg-[#101820]/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
};
