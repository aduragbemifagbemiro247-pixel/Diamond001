import React from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/common/SeoHead';

export const NotFoundPage: React.FC = () => {
  return (
    <>
      <SeoHead title="Page Not Found — Diamond Store" description="The requested page could not be found." />
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[#707782]">404</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-[#101820]">Page Not Found</h1>
        <p className="mt-3 text-sm text-[#707782]">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-7 flex justify-center gap-4">
          <Link to="/" className="px-6 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
            Homepage
          </Link>
          <Link to="/shop" className="px-6 py-3 border border-[#101820]/20 text-[#101820] text-xs font-semibold uppercase tracking-wider">
            Browse Shop
          </Link>
        </div>
      </div>
    </>
  );
};
