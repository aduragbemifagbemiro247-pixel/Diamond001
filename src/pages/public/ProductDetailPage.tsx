import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { Product, ProductVariant, apiFetch, formatNGN, getEffectivePriceKobo } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { ProductCard } from '../../components/layout/ProductCard';
import { SeoHead } from '../../components/common/SeoHead';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart, notify } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setSelectedImageIdx(0);
    setQuantity(1);

    apiFetch<{ product: Product; related: Product[] }>(`/api/products/${slug}`)
      .then((res) => {
        if (!active) return;
        setProduct(res.product);
        setRelated(res.related);
        const firstInStock =
          res.product.variants.find((v) => v.available_stock > 0) || res.product.variants[0];
        if (firstInStock) {
          setSelectedColor(firstInStock.color);
          setSelectedSize(firstInStock.size);
        }
      })
      .catch(() => {
        if (active) setProduct(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const colors = useMemo(() => {
    if (!product) return [];
    const seen = new Map<string, string>();
    for (const v of product.variants) {
      if (!seen.has(v.color)) seen.set(v.color, v.color_hex);
    }
    return Array.from(seen.entries()).map(([color, hex]) => ({ color, hex }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    if (!product) return [];
    return product.variants.filter((v) => v.color === selectedColor);
  }, [product, selectedColor]);

  const activeVariant: ProductVariant | null = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find((v) => v.color === selectedColor && v.size === selectedSize) ||
      sizesForColor[0] ||
      null
    );
  }, [product, selectedColor, selectedSize, sizesForColor]);

  useEffect(() => {
    if (activeVariant && quantity > Math.max(1, activeVariant.available_stock)) {
      setQuantity(Math.max(1, activeVariant.available_stock));
    }
  }, [activeVariant, quantity]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 aspect-[4/3] bg-[#FFFFFF] animate-pulse" />
        <div className="lg:col-span-5 h-96 bg-[#FFFFFF] animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#101820]">Product Not Found</h1>
        <p className="mt-3 text-sm text-[#707782]">This item may have been removed or is no longer published.</p>
        <Link
          to="/shop"
          className="mt-6 inline-block px-6 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  const effectivePriceKobo = getEffectivePriceKobo(product, activeVariant);
  const hasSale =
    product.sale_price_kobo !== null && product.sale_price_kobo < product.regular_price_kobo;
  const availableStock = activeVariant ? activeVariant.available_stock : 0;

  const handleAddToCart = (goToCheckout = false) => {
    if (!activeVariant) {
      notify('Please select an available size and colour.', 'error');
      return;
    }
    if (availableStock <= 0) {
      notify('This variant is currently out of stock.', 'error');
      return;
    }
    addToCart({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: activeVariant.id,
      variantSku: activeVariant.sku,
      size: activeVariant.size,
      color: activeVariant.color,
      unitPriceKobo: effectivePriceKobo,
      imageUrl: product.images[0]?.url || '',
      quantity,
      maxStock: availableStock,
    });
    if (goToCheckout) {
      navigate('/checkout');
    }
  };

  return (
    <>
      <SeoHead
        title={`${product.name} — Diamond Store`}
        description={product.description.slice(0, 155)}
        canonicalPath={`/product/${product.slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          sku: activeVariant?.sku || product.sku,
          description: product.description,
          image: product.images.map((i) => i.url),
          brand: { '@type': 'Brand', name: 'Diamond Store' },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'NGN',
            price: (effectivePriceKobo / 100).toFixed(2),
            availability: availableStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <nav className="text-xs text-[#707782] flex items-center gap-2 mb-8">
          <Link to="/" className="hover:text-[#101820]">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-[#101820]">Shop</Link>
          {product.category_slug && (
            <>
              <span>/</span>
              <Link to={`/category/${product.category_slug}`} className="hover:text-[#101820]">
                {product.category_name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[#101820] truncate">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Sticky Gallery Left */}
          <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-4">
            <div className="aspect-[4/3] bg-[#EBE7DE] border border-[#101820]/10 overflow-hidden">
              <ImageWithFallback
                src={product.images[selectedImageIdx]?.url}
                alt={product.images[selectedImageIdx]?.alt_text || product.name}
                label={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {product.images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`aspect-[4/3] bg-[#EBE7DE] border overflow-hidden transition-colors ${
                      selectedImageIdx === idx ? 'border-[#101820] ring-1 ring-[#101820]' : 'border-[#101820]/15'
                    }`}
                  >
                    <ImageWithFallback
                      src={img.url}
                      alt={img.alt_text || `${product.name} view ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sticky Purchase Module Right */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 bg-[#FFFFFF] border border-[#101820]/10 p-6 sm:p-8">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[#707782]">
              <span>{product.category_name || 'Diamond Store'}</span>
              <span className="font-mono">{activeVariant?.sku || product.sku}</span>
            </div>

            <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-semibold text-[#101820] leading-tight">
              {product.name}
            </h1>

            <div className="mt-4 flex items-baseline gap-3 tabular-nums">
              <span className="text-2xl font-semibold text-[#101820]">
                {formatNGN(effectivePriceKobo)}
              </span>
              {hasSale && (
                <span className="text-sm text-[#707782] line-through">
                  {formatNGN(product.regular_price_kobo)}
                </span>
              )}
            </div>

            <p className="mt-4 text-sm text-[#707782] leading-relaxed">{product.description}</p>

            {/* Colour Selector */}
            <div className="mt-6 pt-6 border-t border-[#101820]/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#101820]">Colour</span>
                <span className="text-[#707782]">{selectedColor}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {colors.map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.color);
                      const firstSize = product.variants.find((v) => v.color === c.color);
                      if (firstSize) setSelectedSize(firstSize.size);
                    }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border transition-colors ${
                      selectedColor === c.color
                        ? 'border-[#101820] bg-[#F7F5F0] text-[#101820] font-semibold'
                        : 'border-[#101820]/15 bg-[#FFFFFF] text-[#707782] hover:border-[#101820]/40'
                    }`}
                  >
                    <span
                      className="w-3 h-3 border border-[#101820]/20"
                      style={{ backgroundColor: c.hex || '#101820' }}
                    />
                    <span>{c.color}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selector */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#101820]">Size</span>
                <span className="tabular-nums text-[#707782]">
                  {availableStock > 0 ? `${availableStock} in stock` : 'Out of stock'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizesForColor.map((v) => {
                  const soldOut = v.available_stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => setSelectedSize(v.size)}
                      className={`min-w-[3rem] px-3.5 py-2 text-xs font-semibold border transition-colors ${
                        activeVariant?.id === v.id
                          ? 'bg-[#101820] text-[#FFFFFF] border-[#101820]'
                          : soldOut
                          ? 'bg-[#F7F5F0] text-[#707782]/50 border-[#101820]/10 line-through cursor-not-allowed'
                          : 'bg-[#FFFFFF] text-[#101820] border-[#101820]/20 hover:border-[#101820]'
                      }`}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & Actions */}
            <div className="mt-6 pt-6 border-t border-[#101820]/10 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#101820]">Quantity</span>
                <div className="inline-flex items-center border border-[#101820]/20">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-[#101820] hover:bg-[#F7F5F0]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-sm font-semibold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={quantity >= availableStock}
                    onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                    className="p-2.5 text-[#101820] hover:bg-[#F7F5F0] disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={availableStock <= 0}
                  onClick={() => handleAddToCart(false)}
                  className="py-3.5 px-6 bg-[#101820] text-[#FFFFFF] text-sm font-semibold hover:bg-[#101820]/90 transition-colors disabled:opacity-40"
                >
                  {availableStock > 0 ? 'Add to Cart' : 'Unavailable'}
                </button>
                <button
                  type="button"
                  disabled={availableStock <= 0}
                  onClick={() => handleAddToCart(true)}
                  className="py-3.5 px-6 bg-[#D6B875] text-[#101820] text-sm font-semibold hover:bg-[#c8a862] transition-colors disabled:opacity-40"
                >
                  Buy Now
                </button>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#101820]/10 space-y-2.5 text-xs text-[#707782]">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-[#B5954F] shrink-0" />
                <span>Nigeria &amp; worldwide delivery · Fees payable on delivery day by default.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#B5954F] shrink-0" />
                <span>Independent variant inventory verified directly before dispatch.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="mt-16 pt-12 border-t border-[#101820]/10">
            <h2 className="font-serif text-2xl font-semibold text-[#101820]">Related Pieces</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
};
