'use client';
import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { adFreePromiseHolds, brand } from '@/config';
import { cn } from '@/lib/utils';

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Do my guests need to create an account or download an app?',
      a: 'No. Guests simply open the link or enter the event code in any mobile or desktop browser to view the invitation and RSVP. An account is only prompted when someone posts a message or photo to the wall, so the host always knows who posted.',
    },
    {
      q: 'Are there any per-guest fees or hidden costs?',
      a: 'Never. Unlike platforms that charge coins or stamps per recipient, our pricing is 100% flat. Whether you invite 10 or 250 guests on a One Event plan, the price is exactly $19.',
    },
    ...(adFreePromiseHolds()
      ? [
          {
            q: 'Is the Free plan ad-supported?',
            a: `No. ${brand.name} has zero banner ads on every plan, including Free. An ad beside someone's wedding invitation or birthday card diminishes the moment. Our Free tier is the full experience with smaller limits.`,
          },
        ]
      : []),
    {
      q: 'Can I upgrade my plan after sending the invitations?',
      a: 'Yes! Upgrading seamlessly applies to your existing event. Your guests keep the exact same link and code, and all existing RSVPs and wall posts remain intact.',
    },
    {
      q: 'What happens to the live wall photos and voice notes after the event?',
      a: 'Your wall stays active for the duration of your plan (7 days for Free, 30 days for One Event, 90 days for Pro). On paid plans, you can download a full high-resolution ZIP archive of every photo, video, and audio toast before it closes.',
    },
    {
      q: 'How does the Live TV Wallboard Mode work?',
      a: 'Every event includes a live wallboard view with a room QR code. You can cast or plug any laptop/tablet into a TV or projector at your venue, and guest posts will appear dynamically in real-time with theme ambient glow!',
    },
    {
      q: 'Can I use this for intimate dinners or memorials?',
      a: 'Yes. Selecting Memorial adjusts the theme and wording across the invitation, transforming the wallboard into a dignified, heartfelt celebration of life and shared memories.',
    },
  ];

  return (
    <section className="mx-auto w-full max-w-4xl py-12">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-1 text-xs font-semibold text-[var(--accent)] shadow-sm">
          <HelpCircle className="size-3.5" />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          Everything you need to know about {brand.name} pricing
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Simple, honest answers without the fine print.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.q}
              className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between p-5 text-left text-base font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
                    isOpen && 'rotate-180 text-[var(--accent)]',
                  )}
                />
              </button>
              {isOpen && (
                <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-page)]/60 px-5 py-4 text-sm leading-relaxed text-[var(--text-secondary)] animate-in fade-in duration-200">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
