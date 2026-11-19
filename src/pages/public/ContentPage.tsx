import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { apiFetch } from '../../types/store';
import { SeoHead } from '../../components/common/SeoHead';

interface ContentPageProps {
  pageKey: 'about' | 'contact' | 'faq' | 'shipping_policy' | 'return_policy' | 'privacy_policy' | 'terms';
}

export const ContentPage: React.FC<ContentPageProps> = ({ pageKey }) => {
  const { storefront, notify } = useStore();
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sendingContact, setSendingContact] = useState(false);

  const [returnForm, setReturnForm] = useState({ order_number: '', email: '', reason: '' });
  const [sendingReturn, setSendingReturn] = useState(false);

  const contentEntry = storefront?.content?.[pageKey];
  const general = storefront?.settings?.general;
  const returnsSettings = storefront?.settings?.returns;

  const titles: Record<ContentPageProps['pageKey'], string> = {
    about: 'About Us',
    contact: 'Contact Diamond Store',
    faq: 'Frequently Asked Questions',
    shipping_policy: 'Shipping & Delivery Policy',
    return_policy: 'Return Policy',
    privacy_policy: 'Privacy Policy',
    terms: 'Terms & Conditions',
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingContact(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactForm({ name: '', email: '', subject: '', message: '' });
      notify(res.message, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to send message.', 'error');
    } finally {
      setSendingContact(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReturn(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/returns', {
        method: 'POST',
        body: JSON.stringify(returnForm),
      });
      setReturnForm({ order_number: '', email: '', reason: '' });
      notify(res.message, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to submit return request.', 'error');
    } finally {
      setSendingReturn(false);
    }
  };

  const body = (contentEntry?.body || {}) as {
    headline?: string;
    paragraphs?: string[];
    items?: { question: string; answer: string }[];
    sections?: { heading: string; text: string }[];
    text?: string;
  };

  return (
    <>
      <SeoHead
        title={`${contentEntry?.title || titles[pageKey]} — Diamond Store`}
        description={`${titles[pageKey]} for Diamond Store in Ogbomoso, Oyo State, Nigeria.`}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Diamond Store</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-[#101820]">
          {contentEntry?.title || titles[pageKey]}
        </h1>

        <div className="mt-8 bg-[#FFFFFF] border border-[#101820]/10 p-6 sm:p-10 space-y-6 text-sm text-[#101820]/85 leading-relaxed">
          {body.headline && (
            <h2 className="font-serif text-2xl font-semibold text-[#101820]">{body.headline}</h2>
          )}

          {body.paragraphs?.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {body.text && <p>{body.text}</p>}

          {body.sections?.map((sec, i) => (
            <div key={i} className="space-y-2 pt-2">
              <h2 className="font-serif text-xl font-semibold text-[#101820]">{sec.heading}</h2>
              <p>{sec.text}</p>
            </div>
          ))}

          {body.items && (
            <div className="divide-y divide-[#101820]/10">
              {body.items.map((item, i) => (
                <div key={i} className="py-5 first:pt-0 last:pb-0">
                  <h2 className="font-serif text-lg font-semibold text-[#101820]">{item.question}</h2>
                  <p className="mt-2 text-[#707782]">{item.answer}</p>
                </div>
              ))}
            </div>
          )}

          {pageKey === 'return_policy' && (
            <div className="pt-4 border-t border-[#101820]/10 space-y-4">
              <p className="text-xs uppercase tracking-wider text-[#707782]">
                Current Policy Status:{' '}
                <strong className="text-[#101820]">
                  {returnsSettings?.enabled ? `Enabled (${returnsSettings.deadline_days} days window)` : 'Returns Disabled'}
                </strong>
              </p>
              {returnsSettings?.conditions && <p>{returnsSettings.conditions}</p>}

              {returnsSettings?.enabled && (
                <form onSubmit={handleReturnSubmit} className="pt-4 space-y-4 border-t border-[#101820]/10">
                  <h3 className="font-serif text-lg font-semibold text-[#101820]">Submit Return Request</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Order Number"
                      value={returnForm.order_number}
                      onChange={(e) => setReturnForm({ ...returnForm, order_number: e.target.value })}
                      className="border border-[#101820]/20 px-3.5 py-2.5 text-sm font-mono uppercase"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Order Email Address"
                      value={returnForm.email}
                      onChange={(e) => setReturnForm({ ...returnForm, email: e.target.value })}
                      className="border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <textarea
                    required
                    rows={3}
                    placeholder="Reason for return request..."
                    value={returnForm.reason}
                    onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sendingReturn}
                    className="px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
                  >
                    {sendingReturn ? 'Submitting...' : 'Submit Return Request'}
                  </button>
                </form>
              )}
            </div>
          )}

          {pageKey === 'contact' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-[#F7F5F0] border border-[#101820]/10 text-xs">
                <div>
                  <p className="uppercase tracking-wider text-[#707782]">Location</p>
                  <p className="mt-1 font-semibold text-[#101820]">
                    {general?.location || 'Ogbomoso, Oyo State, Nigeria'}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[#707782]">Direct Channels</p>
                  <p className="mt-1 text-[#101820]">
                    {general?.business_email || 'Email configurable in Admin Settings'}
                  </p>
                  {general?.business_phone && <p className="mt-0.5 tabular-nums">{general.business_phone}</p>}
                  {general?.whatsapp_number && <p className="mt-0.5 tabular-nums">WhatsApp: {general.whatsapp_number}</p>}
                </div>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <h2 className="font-serif text-xl font-semibold text-[#101820]">Send a Message</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Your Email Address"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Subject"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                />
                <textarea
                  required
                  rows={4}
                  placeholder="How can our team assist you?"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={sendingContact}
                  className="px-7 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
                >
                  {sendingContact ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
