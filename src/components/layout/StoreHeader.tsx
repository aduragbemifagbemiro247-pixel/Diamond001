import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/category/mens-clothing', label: "Men's Clothing" },
  { to: '/category/shoes', label: 'Shoes' },
  { to: '/category/accessories', label: 'Accessories' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
];

export const StoreHeader: React.FC = () => {
  const { storefront, cartCount, customer } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const wordmark = storefront?.settings?.general?.store_logo_text || 'DIAMOND STORE';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchOpen(false);
    if (q) {
      navigate(`/shop?search=${encodeURIComponent(q)}`);
    } else {
      navigate('/shop');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#101820]/10 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 -ml-2 text-[#101820] hover:text-[#B5954F] transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link
            to="/"
            className="font-serif text-lg sm:text-xl font-semibold tracking-[0.16em] text-[#101820] whitespace-nowrap shrink-0"
          >
            {wordmark}
          </Link>
        </div>

        {/* Zone 2: Single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-[#707782]" aria-label="Main navigation">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 py-1 border-b transition-colors ${
                  isActive
                    ? 'text-[#101820] border-[#D6B875]'
                    : 'border-transparent hover:text-[#101820] hover:border-[#101820]/30'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Search, Customer Account, Shopping Cart */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search catalog"
            className="p-2 text-[#101820] hover:text-[#B5954F] transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          <Link
            to={customer ? '/account' : '/account/login'}
            aria-label={customer ? 'Customer account' : 'Sign in'}
            className="p-2 text-[#101820] hover:text-[#B5954F] transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">{customer ? customer.full_name.split(' ')[0] : 'Account'}</span>
          </Link>

          <Link
            to="/cart"
            aria-label="Shopping bag"
            className="inline-flex items-center gap-2 px-3 py-2 bg-[#101820] text-[#FFFFFF] hover:bg-[#101820]/90 transition-colors text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#D6B875]" />
            <span className="tabular-nums">Bag ({cartCount})</span>
          </Link>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-[#101820]/10 bg-[#F7F5F0] px-4 py-3">
          <form onSubmit={handleSearchSubmit} className="max-w-3xl mx-auto flex items-center gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shirts, blazers, leather shoes, watches..."
              autoFocus
              className="flex-1 bg-[#FFFFFF] border border-[#101820]/15 px-4 py-2.5 text-sm text-[#101820] placeholder:text-[#707782] focus:outline-none focus:border-[#101820]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold tracking-wide uppercase hover:bg-[#101820]/90 transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t border-[#101820]/10 bg-[#FFFFFF] px-4 py-4 space-y-1">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block py-2.5 px-2 text-sm font-medium border-b border-[#101820]/5 ${
                  isActive ? 'text-[#101820] font-semibold' : 'text-[#707782]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/track-order"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2.5 px-2 text-sm font-medium text-[#707782]"
          >
            Track Order
          </Link>
        </nav>
      )}
    </header>
  );
};
