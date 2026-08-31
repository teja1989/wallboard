'use client';
import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { plans, templates, freeTemplates } from '@/config';

export function PlanComparisonMatrix() {
  const [isOpen, setIsOpen] = useState(false);

  const sections = [
    {
      category: 'Headcount & Capacity',
      items: [
        {
          name: 'Maximum Guests',
          free: '25 guests',
          event: '250 guests',
          pro: '500 guests',
        },
        {
          name: 'Media Storage Capacity',
          free: '500 MB',
          event: '5 GB (5,000 MB)',
          pro: '20 GB (20,000 MB)',
        },
        {
          name: 'Live Wallboard Retention',
          free: '7 days',
          event: '30 days',
          pro: '90 days',
        },
        {
          name: 'Simultaneous Live Events',
          free: '2 events',
          event: '5 events',
          pro: '25 events',
        },
      ],
    },
    {
      category: 'Design & Aesthetics',
      items: [
        {
          name: 'Invitation Templates',
          free: `${freeTemplates.length} Essential Themes`,
          event: `All ${templates.length} Designer Themes`,
          pro: `All ${templates.length} Designer Themes`,
        },
        {
          name: 'Architectural Layouts',
          free: '4 Layouts (Classic, Poster, Editorial, Minimal)',
          event: '4 Layouts (Classic, Poster, Editorial, Minimal)',
          pro: '4 Layouts (Classic, Poster, Editorial, Minimal)',
        },
        {
          name: 'Textured Header Surfaces',
          free: 'Bloom, Arcs, Linen, Dusk',
          event: 'All Surfaces + Motion Sparkle',
          pro: 'All Surfaces + Motion Sparkle',
        },
        {
          name: 'Remove Marquee Watermark',
          free: false,
          event: true,
          pro: true,
        },
      ],
    },
    {
      category: 'Live Wallboard & Memories',
      items: [
        {
          name: 'Live TV & Projector Mode',
          free: true,
          event: true,
          pro: true,
        },
        {
          name: 'Voice Toasts & Audio Soundwaves',
          free: true,
          event: true,
          pro: true,
        },
        {
          name: 'Photo & Video Live Streaming',
          free: true,
          event: true,
          pro: true,
        },
        {
          name: 'Event Room QR Code',
          free: true,
          event: true,
          pro: true,
        },
        {
          name: '1-Click High-Res Archive ZIP Download',
          free: false,
          event: true,
          pro: true,
        },
      ],
    },
    {
      category: 'RSVP & Event Coordination',
      items: [
        {
          name: '1-Click Join Link & Codes',
          free: true,
          event: true,
          pro: true,
        },
        {
          name: 'Private Notes to Host',
          free: false,
          event: true,
          pro: true,
        },
        {
          name: 'Custom RSVP Question',
          free: false,
          event: true,
          pro: true,
        },
        {
          name: 'Guest List CSV Export',
          free: false,
          event: true,
          pro: true,
        },
        {
          name: 'Occasion Planning Checklist',
          free: 'Preview only',
          event: 'Full Interactive',
          pro: 'Full Interactive',
        },
        {
          name: '100% Ad-Free Guarantee',
          free: true,
          event: true,
          pro: true,
        },
      ],
    },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl">
      {/* Toggle Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-all hover:bg-[var(--surface-page)] hover:shadow-md active:scale-95"
        >
          <span>{isOpen ? 'Hide' : 'View'} Full Feature Comparison Matrix</span>
          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {/* Expandable Table */}
      {isOpen && (
        <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-sm animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
                  <th className="py-4 pl-6 pr-4 font-semibold text-[var(--text-primary)] w-1/3">
                    Feature
                  </th>
                  <th className="py-4 px-4 font-semibold text-[var(--text-primary)] text-center">
                    {plans.free.label} ($0)
                  </th>
                  <th className="py-4 px-4 font-bold text-[var(--accent)] text-center bg-[var(--accent-soft)]/30">
                    {plans.event.label} ($19)
                  </th>
                  <th className="py-4 px-4 font-semibold text-[var(--text-primary)] text-center">
                    {plans.pro.label} ($79/yr)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {sections.map((sec) => (
                  <tr key={sec.category} className="contents">
                    <tr className="bg-[var(--surface-sunken)]/60">
                      <td
                        colSpan={4}
                        className="py-2.5 pl-6 font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]"
                      >
                        {sec.category}
                      </td>
                    </tr>
                    {sec.items.map((item) => (
                      <tr key={item.name} className="hover:bg-[var(--surface-page)]/40 transition-colors">
                        <td className="py-3.5 pl-6 pr-4 font-medium text-[var(--text-primary)]">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-[var(--text-secondary)]">
                          {renderValue(item.free)}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs font-semibold text-[var(--text-primary)] bg-[var(--accent-soft)]/10">
                          {renderValue(item.event)}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-[var(--text-secondary)]">
                          {renderValue(item.pro)}
                        </td>
                      </tr>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function renderValue(val: string | boolean) {
  if (typeof val === 'boolean') {
    return val ? (
      <Check className="mx-auto size-4 text-emerald-500" />
    ) : (
      <Minus className="mx-auto size-4 text-[var(--text-muted)]" />
    );
  }
  return <span>{val}</span>;
}
