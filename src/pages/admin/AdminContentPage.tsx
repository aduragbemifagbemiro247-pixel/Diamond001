import React, { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { apiFetch } from '../../types/store';
import { useStore } from '../../context/StoreContext';

export const AdminContentPage: React.FC = () => {
  const { notify, refreshStorefront } = useStore();
  const [contentMap, setContentMap] = useState<
    Record<string, { title: string; body: Record<string, unknown> }>
  >({});
  const [activeKey, setActiveKey] = useState('hero');
  const [jsonDraft, setJsonDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch<{ content: typeof contentMap }>('/api/admin/content')
      .then((res) => {
        setContentMap(res.content);
        const item = res.content[activeKey];
        if (item) {
          setTitleDraft(item.title);
          setJsonDraft(JSON.stringify(item.body, null, 2));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const selectSection = (key: string) => {
    setActiveKey(key);
    const item = contentMap[key];
    if (item) {
      setTitleDraft(item.title);
      setJsonDraft(JSON.stringify(item.body, null, 2));
    }
  };

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, data_url: reader.result }),
        });
        const parsed = JSON.parse(jsonDraft);
        parsed.image_url = res.url;
        setJsonDraft(JSON.stringify(parsed, null, 2));
        notify('Hero image uploaded. Click Save Content to publish.', 'info');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Upload failed.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedBody = JSON.parse(jsonDraft);
      await apiFetch(`/api/admin/content/${activeKey}`, {
        method: 'PUT',
        body: JSON.stringify({ title: titleDraft, body: parsedBody }),
      });
      notify('Website content published to live storefront.', 'success');
      load();
      refreshStorefront();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Invalid JSON or save error.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const heroBody = (() => {
    if (activeKey !== 'hero') return null;
    try {
      return JSON.parse(jsonDraft) as {
        headline?: string;
        description?: string;
        primary_cta_label?: string;
        secondary_cta_label?: string;
        image_url?: string;
      };
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Website Content CMS</h1>
        <p className="text-xs text-[#707782] mt-1">
          Edit homepage hero, announcement bar, promotional banners, About Us, FAQs, and policy pages live.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 bg-[#FFFFFF] border border-[#101820]/10 p-3 space-y-1">
          {Object.keys(contentMap).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectSection(key)}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium capitalize ${
                activeKey === key ? 'bg-[#101820] text-[#FFFFFF]' : 'text-[#707782] hover:text-[#101820]'
              }`}
            >
              {key.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="lg:col-span-9 bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold capitalize">{activeKey.replace(/_/g, ' ')}</h2>
            {activeKey === 'hero' && (
              <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#101820]/20 text-xs font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload Hero Photo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleHeroImageUpload} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Section Title</label>
            <input
              type="text"
              required
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
            />
          </div>

          {heroBody && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#F7F5F0] border border-[#101820]/10">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Hero Headline</label>
                <input
                  type="text"
                  value={heroBody.headline || ''}
                  onChange={(e) => {
                    const updated = { ...heroBody, headline: e.target.value };
                    setJsonDraft(JSON.stringify(updated, null, 2));
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#101820]/20 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Hero Description</label>
                <textarea
                  rows={2}
                  value={heroBody.description || ''}
                  onChange={(e) => {
                    const updated = { ...heroBody, description: e.target.value };
                    setJsonDraft(JSON.stringify(updated, null, 2));
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#101820]/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Primary CTA Label</label>
                <input
                  type="text"
                  value={heroBody.primary_cta_label || ''}
                  onChange={(e) => {
                    const updated = { ...heroBody, primary_cta_label: e.target.value };
                    setJsonDraft(JSON.stringify(updated, null, 2));
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#101820]/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Secondary CTA Label</label>
                <input
                  type="text"
                  value={heroBody.secondary_cta_label || ''}
                  onChange={(e) => {
                    const updated = { ...heroBody, secondary_cta_label: e.target.value };
                    setJsonDraft(JSON.stringify(updated, null, 2));
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#101820]/20 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">Structured Content Data (JSON)</label>
            <textarea
              rows={12}
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
          >
            {saving ? 'Publishing...' : 'Save & Publish Content'}
          </button>
        </form>
      </div>
    </div>
  );
};
