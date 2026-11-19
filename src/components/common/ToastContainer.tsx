import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start justify-between gap-3 px-4 py-3 border text-sm shadow-sm ${
            t.type === 'error'
              ? 'bg-[#FFFFFF] border-red-700 text-red-900'
              : t.type === 'success'
              ? 'bg-[#101820] border-[#D6B875] text-[#FFFFFF]'
              : 'bg-[#FFFFFF] border-[#101820]/20 text-[#101820]'
          }`}
        >
          <p className="leading-snug">{t.text}</p>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Close notification"
            className="opacity-70 hover:opacity-100 shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
