import React, { useEffect, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Category, apiFetch } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';

export const AdminCategoriesPage: React.FC = () => {
  const { notify, refreshStorefront } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    display_order: 0,
    is_active: true,
  });

  const load = () => {
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => setCategories(res.categories))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load categories.', 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, data_url: reader.result }),
        });
        setForm((prev) => ({ ...prev, image_url: res.url }));
        notify('Category image uploaded.', 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Upload failed.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/api/admin/categories/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        notify('Category updated.', 'success');
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        notify('Category created.', 'success');
      }
      setEditingId(null);
      setForm({ name: '', slug: '', description: '', image_url: '', display_order: 0, is_active: true });
      load();
      refreshStorefront();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save category.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      notify('Category deleted.', 'info');
      load();
      refreshStorefront();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Cannot delete category.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Categories</h1>
        <p className="text-xs text-[#707782] mt-1">Manage storefront departments, display ordering, and images.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">{editingId ? 'Edit Category' : 'Add Category'}</h2>
          <div>
            <label className="block text-xs font-medium mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  slug: editingId ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                }));
              }}
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Slug *</label>
            <input
              type="text"
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Display Order</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active on Storefront
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium">Category Image</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#101820]/20 text-xs font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="hidden" />
              </label>
              {form.image_url && <span className="text-xs text-[#707782] truncate">{form.image_url}</span>}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="px-5 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
              {editingId ? 'Save Changes' : 'Create Category'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: '', slug: '', description: '', image_url: '', display_order: 0, is_active: true });
                }}
                className="px-4 py-2.5 border border-[#101820]/20 text-xs font-semibold"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Products</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#101820]/5">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 aspect-[4/3] bg-[#EBE7DE] overflow-hidden shrink-0">
                        <ImageWithFallback src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#101820]">{c.name}</p>
                        <p className="font-mono text-[11px] text-[#707782]">{c.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{c.display_order}</td>
                  <td className="py-3 px-4 tabular-nums">{c.product_count ?? 0}</td>
                  <td className="py-3 px-4">{c.is_active ? 'Active' : 'Hidden'}</td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setForm({
                          name: c.name,
                          slug: c.slug,
                          description: c.description || '',
                          image_url: c.image_url || '',
                          display_order: c.display_order,
                          is_active: Boolean(c.is_active),
                        });
                      }}
                      className="px-2.5 py-1 border border-[#101820]/20 hover:bg-[#101820] hover:text-[#FFFFFF]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-red-700 border border-red-200 hover:bg-red-700 hover:text-[#FFFFFF]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
