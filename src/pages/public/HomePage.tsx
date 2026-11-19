import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Globe, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, apiFetch } from '../../types/store';
import { ProductCard } from '../../components/layout/ProductCard';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { SeoHead } from '../../components/common/SeoHead';

export const HomePage: React.FC = () => {
  const { storefront, notify } = useStore();
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [specialOffers, setSpecialOffers] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribeToken, setUnsubscribeToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ items: Product[] }>('/api/products?sort=latest&limit=4'),
      apiFetch<{ items: Product[] }>('/api/products?bestseller=true&limit=4'),
      apiFetch<{ items: Product[] }>('/api/products?onSale=true&limit=4'),
    ])
      .then(([latestRes, bestRes, saleRes]) => {
        if (!active) return;
        setNewArrivals(latestRes.items);
        setBestSellers(bestRes.items);
        setSpecialOffers(saleRes.items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hero = (storefront?.content?.hero?.body || {}) as {
    headline?: string;
    description?: string;
    primary_cta_label?: string;
    primary_cta_url?: string;
    secondary_cta_label?: string;
    secondary_cta_url?: string;
    image_url?: string;
  };

  const promoBanner = (storefront?.content?.promotional_banner?.body || {}) as {
    enabled?: boolean;
    eyebrow?: string;
    headline?: string;
    description?: string;
    cta_label?: string;
    cta_url?: string;
  };

  const primaryCategories = (storefront?.categories || []).filter((c) =>
    !['new-arrivals', 'best-sellers', 'special-offers'].includes(c.slug)
  );

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribing(true);
    try {
      const res = await apiFetch<{ message: string; unsubscribe_token: string }>(
        '/api/newsletter/subscribe',
        {
          method: 'POST',
          body: JSON.stringify({ email: newsletterEmail }),
        }
      );
      setUnsubscribeToken(res.unsubscribe_token);
      setNewsletterEmail('');
      notify(res.message, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Subscription failed.', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!unsubscribeToken) return;
    try {
      const res = await apiFetch<{ message: string }>('/api/newsletter/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ token: unsubscribeToken }),
      });
      setUnsubscribeToken(null);
      notify(res.message, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to unsubscribe.', 'error');
    }
  };

  return (
    <>
      <SeoHead
        title="Diamond Store — Luxury Men's Clothing, Footwear & Accessories"
        description="Discover premium men's clothing, footwear and accessories from Diamond Store in Ogbomoso, Nigeria. Nationwide and international delivery available."
        canonicalPath="/"
      />

      {/* Hero Section */}
      <section className="bg-[#101820] text-[#F7F5F0]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 px-6 sm:px-10 lg:px-12 py-16 lg:py-24 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#D6B875] font-medium">
              Diamond Store · Ogbomoso, Nigeria
            </p>
            <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[3.25rem] font-semibold leading-[1.12] tracking-tight text-[#FFFFFF] text-balance">
              {hero.headline || 'DEFINE YOUR STYLE. OWN YOUR CONFIDENCE.'}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#F7F5F0]/80 leading-relaxed max-w-xl">
              {hero.description ||
                "Discover premium men's clothing, footwear and accessories, carefully selected to elevate your everyday style."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={hero.primary_cta_url || '/shop'}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#D6B875] text-[#101820] text-sm font-semibold tracking-wide hover:bg-[#c8a862] transition-colors whitespace-nowrap"
              >
                <span>{hero.primary_cta_label || 'Shop Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={hero.secondary_cta_url || '/shop?sort=featured'}
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-[#F7F5F0]/30 text-[#FFFFFF] text-sm font-semibold tracking-wide hover:border-[#D6B875] hover:text-[#D6B875] transition-colors whitespace-nowrap"
              >
                {hero.secondary_cta_label || 'Explore Collections'}
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[360px] lg:min-h-[540px] bg-[#16202a]">
            <ImageWithFallback
              src={hero.image_url || '/src/assets/images/hero_menswear_editorial_1795111182033.jpg'}
              alt="Diamond Store tailored menswear editorial portrait"
              label="Diamond Store Campaign"
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#101820]/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Curated Departments</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
              Shop by Category
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-sm font-semibold text-[#101820] hover:text-[#B5954F] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            View Full Catalogue <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {primaryCategories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="group block bg-[#FFFFFF] border border-[#101820]/10 overflow-hidden hover:border-[#101820]/30 transition-colors"
            >
              <div className="aspect-[4/3] bg-[#EBE7DE] overflow-hidden">
                <ImageWithFallback
                  src={cat.image_url}
                  alt={cat.name}
                  label={cat.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl font-semibold text-[#101820] group-hover:text-[#B5954F] transition-colors">
                    {cat.name}
                  </h3>
                  <p className="mt-1 text-xs text-[#707782] line-clamp-1">{cat.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#101820]/60 group-hover:text-[#101820] shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="bg-[#FFFFFF] border-y border-[#101820]/10 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#101820]/10">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Latest Releases</p>
              <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
                New Arrivals
              </h2>
            </div>
            <Link
              to="/category/new-arrivals"
              className="text-sm font-semibold text-[#101820] hover:text-[#B5954F] inline-flex items-center gap-1.5"
            >
              Explore New Arrivals <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingCatalog ? (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-80 bg-[#F7F5F0] animate-pulse border border-[#101820]/5" />
              ))}
            </div>
          ) : newArrivals.length === 0 ? (
            <div className="mt-8 py-12 text-center border border-[#101820]/10 bg-[#F7F5F0]">
              <p className="text-sm text-[#707782]">No published products yet. Administrators can publish items in the Admin Dashboard.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {newArrivals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Best Sellers */}
      {bestSellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#101820]/10">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Client Favorites</p>
              <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
                Best Sellers
              </h2>
            </div>
            <Link
              to="/category/best-sellers"
              className="text-sm font-semibold text-[#101820] hover:text-[#B5954F] inline-flex items-center gap-1.5"
            >
              View Best Sellers <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Editorial Promotional Banner */}
      {promoBanner.enabled !== false && (
        <section className="bg-[#101820] text-[#F7F5F0] py-14 border-y border-[#D6B875]/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#D6B875]">
              {promoBanner.eyebrow || 'Ogbomoso · Nationwide & International'}
            </p>
            <h2 className="mt-3 font-serif text-2xl sm:text-4xl font-semibold text-[#FFFFFF] text-balance">
              {promoBanner.headline || 'Tailored Craftsmanship for Modern Gentlemen'}
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#F7F5F0]/75 max-w-2xl mx-auto leading-relaxed">
              {promoBanner.description ||
                'Each garment, pair of leather shoes, and accessory is inspected for lasting drape, stitch integrity, and timeless versatility.'}
            </p>
            <div className="mt-7">
              <Link
                to={promoBanner.cta_url || '/shop'}
                className="inline-flex items-center gap-2 px-7 py-3 bg-[#D6B875] text-[#101820] text-sm font-semibold hover:bg-[#c8a862] transition-colors"
              >
                {promoBanner.cta_label || 'Browse Catalogue'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Special Offers */}
      {specialOffers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#101820]/10">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Seasonal Reductions</p>
              <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
                Special Offers
              </h2>
            </div>
            <Link
              to="/category/special-offers"
              className="text-sm font-semibold text-[#101820] hover:text-[#B5954F] inline-flex items-center gap-1.5"
            >
              View All Offers <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {specialOffers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Why Shop With Us */}
      <section className="bg-[#FFFFFF] border-t border-[#101820]/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Our Standard</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
              Why Shop With Us
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Sparkles,
                title: 'Quality Fashion Products',
                desc: 'Carefully curated menswear, full-grain leather shoes, and refined accessories built for longevity.',
              },
              {
                icon: ShieldCheck,
                title: 'Secure Payment Options',
                desc: 'Server-verified transactions, transparent bank transfers, and flexible cash-on-delivery arrangements.',
              },
              {
                icon: Truck,
                title: 'Delivery Across Nigeria',
                desc: 'Dispatched from Ogbomoso with per-order delivery charges payable on delivery day by default.',
              },
              {
                icon: Globe,
                title: 'International Arrangements',
                desc: 'Worldwide shipping coordinated transparently with dedicated customer support for global orders.',
              },
            ].map((item) => (
              <div key={item.title} className="p-6 bg-[#F7F5F0] border border-[#101820]/10">
                <item.icon className="w-5 h-5 text-[#B5954F]" />
                <h3 className="mt-4 text-base font-semibold text-[#101820]">{item.title}</h3>
                <p className="mt-2 text-sm text-[#707782] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-[#F7F5F0] border-t border-[#101820]/10 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Private Dispatches</p>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">
            Join the Diamond Store List
          </h2>
          <p className="mt-3 text-sm text-[#707782]">
            Receive quiet updates on new arrivals, restocks, and private seasonal offers.
          </p>

          <form onSubmit={handleSubscribe} className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email address"
              aria-label="Email address for newsletter"
              className="flex-1 bg-[#FFFFFF] border border-[#101820]/20 px-4 py-3 text-sm text-[#101820] focus:outline-none focus:border-[#101820]"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="px-7 py-3 bg-[#101820] text-[#FFFFFF] text-sm font-semibold hover:bg-[#101820]/90 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>

          {unsubscribeToken && (
            <div className="mt-4 inline-flex items-center gap-3 text-xs text-[#707782]">
              <span className="inline-flex items-center gap-1 text-[#101820]">
                <Check className="w-3.5 h-3.5 text-[#B5954F]" /> Subscribed
              </span>
              <button
                type="button"
                onClick={handleUnsubscribe}
                className="underline hover:text-[#101820]"
              >
                Unsubscribe
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
