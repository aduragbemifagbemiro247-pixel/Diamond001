import React, { useState } from 'react';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  label?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  label,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[#EBE7DE] text-[#101820]/60 select-none ${className}`}
      >
        <span className="font-serif text-lg tracking-[0.18em] uppercase text-[#101820]/70">
          Diamond Store
        </span>
        <span className="mt-1 text-xs text-[#707782]">{label || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
