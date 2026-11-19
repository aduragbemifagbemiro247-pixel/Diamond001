import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const AnnouncementBar: React.FC = () => {
  const { storefront } = useStore();
  const [dismissed, setDismissed] = useState(false);

  const announcement = storefront?.content?.announcement_bar?.body as
    | { enabled?: boolean; messages?: string[] }
    | undefined;

  if (dismissed || announcement?.enabled === false) return null;

  const messages = announcement?.messages?.length
    ? announcement.messages
    : ['Delivery Available Across Nigeria & Worldwide · Ogbomoso, Oyo State, Nigeria'];

  return (
    <div className="bg-[#101820] text-[#F7F5F0] border-b border-[#D6B875]/20 h-9 px-4 flex items-center justify-between text-xs tracking-wide no-print">
      <div className="w-5" aria-hidden="true" />
      <p className="truncate text-center font-medium text-[#F7F5F0]/90">
        {messages.join('  ·  ')}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="text-[#F7F5F0]/60 hover:text-[#D6B875] transition-colors p-1 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
