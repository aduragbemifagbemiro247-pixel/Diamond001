import React from 'react';
import { Link } from 'react-router-dom';
import { Product, formatNGN } from '../../types/store';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const primaryImg = product.images?.[0]?.url || null;
  const hasDiscount =
    product.sale_price_kobo !== null && product.sale_price_kobo < product.regular_price_kobo;
  const effectivePrice = hasDiscount ? product.sale_price_kobo! : product.regular_price_kobo;
  const inStock = product.total_available_stock > 0;

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block bg-[#FFFFFF] border border-[#101820]/10 transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#101820]/25"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[#EBE7DE]">
        <ImageWithFallback
          src={primaryImg}
          alt={product.images?.[0]?.alt_text || product.name}
          label={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-[#707782]">
          <span className="truncate">{product.category_name || 'Collection'}</span>
          <span className="shrink-0">
            {!inStock ? 'Sold Out' : hasDiscount ? 'Special Offer' : product.is_bestseller ? 'Bestseller' : ''}
          </span>
        </div>

        <h3 className="mt-1.5 font-sans text-[15px] font-semibold text-[#101820] leading-snug line-clamp-1 group-hover:text-[#B5954F] transition-colors">
          {product.name}
        </h3>

        <div className="mt-2.5 flex items-baseline gap-2.5 tabular-nums">
          <span className="text-[15px] font-semibold text-[#101820]">
            {formatNGN(effectivePrice)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-[#707782] line-through">
              {formatNGN(product.regular_price_kobo)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
