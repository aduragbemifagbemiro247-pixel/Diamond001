import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';

export const StoreFooter: React.FC = () => {
  const { storefront } = useStore();
  const general = storefront?.settings?.general;
  const whatsapp = general?.whatsapp_number?.trim();
  const email = general?.business_email?.trim();
  const phone = general?.business_phone?.trim();
  const socials = general?.social_links || {};

  return (
    <footer className="bg-[#101820] text-[#F7F5F0] border-t border-[#D6B875]/20 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <p className="font-serif text-xl tracking-[0.16em] text-[#FFFFFF]">
              {general?.store_logo_text || 'DIAMOND STORE'}
            </p>
            <p className="mt-4 text-sm text-[#F7F5F0]/70 leading-relaxed">
              Modern luxury men&apos;s clothing, handcrafted footwear, and accessories. Headquartered in{' '}
              {general?.location || 'Ogbomoso, Oyo State, Nigeria'}.
            </p>
            <p className="mt-3 text-xs text-[#D6B875]">
              Currency: Nigerian Naira (NGN / ₦)
            </p>
          </div>

          {/* Collections */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D6B875]">Collections</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#F7F5F0]/80">
              <li><Link to="/shop" className="hover:text-[#D6B875] transition-colors">All Products</Link></li>
              <li><Link to="/category/mens-clothing" className="hover:text-[#D6B875] transition-colors">Men&apos;s Clothing</Link></li>
              <li><Link to="/category/shoes" className="hover:text-[#D6B875] transition-colors">Shoes</Link></li>
              <li><Link to="/category/accessories" className="hover:text-[#D6B875] transition-colors">Accessories</Link></li>
              <li><Link to="/track-order" className="hover:text-[#D6B875] transition-colors">Track Your Order</Link></li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D6B875]">Customer Care</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#F7F5F0]/80">
              <li><Link to="/about" className="hover:text-[#D6B875] transition-colors">About Diamond Store</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-[#D6B875] transition-colors">Shipping Information</Link></li>
              <li><Link to="/faq" className="hover:text-[#D6B875] transition-colors">FAQs</Link></li>
              <li><Link to="/return-policy" className="hover:text-[#D6B875] transition-colors">Return Policy</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-[#D6B875] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-[#D6B875] transition-colors">Terms &amp; Conditions</Link></li>
            </ul>
          </div>

          {/* Contact & Configured Socials */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D6B875]">Connect</h3>
            <div className="mt-4 space-y-2.5 text-sm text-[#F7F5F0]/80">
              <p>Ogbomoso, Oyo State, Nigeria</p>
              {email ? (
                <p>
                  <a href={`mailto:${email}`} className="hover:text-[#D6B875] transition-colors">
                    {email}
                  </a>
                </p>
              ) : (
                <p className="text-xs text-[#F7F5F0]/50">Email contact configurable via Admin Dashboard</p>
              )}
              {phone && (
                <p>
                  <a href={`tel:${phone}`} className="hover:text-[#D6B875] transition-colors tabular-nums">
                    {phone}
                  </a>
                </p>
              )}
              {whatsapp && (
                <p>
                  <a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[#D6B875] hover:underline"
                  >
                    WhatsApp Concierge
                  </a>
                </p>
              )}
              {(socials.instagram || socials.x || socials.facebook) && (
                <div className="pt-2 flex items-center gap-4 text-xs">
                  {socials.instagram && (
                    <a href={socials.instagram} target="_blank" rel="noreferrer" className="hover:text-[#D6B875]">
                      Instagram
                    </a>
                  )}
                  {socials.x && (
                    <a href={socials.x} target="_blank" rel="noreferrer" className="hover:text-[#D6B875]">
                      X
                    </a>
                  )}
                  {socials.facebook && (
                    <a href={socials.facebook} target="_blank" rel="noreferrer" className="hover:text-[#D6B875]">
                      Facebook
                    </a>
                  )}
                </div>
              )}
              <div className="pt-2">
                <Link to="/contact" className="text-xs font-medium text-[#D6B875] hover:underline">
                  Send an Inquiry &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#F7F5F0]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#F7F5F0]/60">
          <p>&copy; {new Date().getFullYear()} Diamond Store. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/account" className="hover:text-[#F7F5F0] transition-colors">Customer Account</Link>
            <Link to="/admin/login" className="hover:text-[#D6B875] transition-colors">Staff Portal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
