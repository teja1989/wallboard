'use client';
import { useMemo, useState } from 'react';
import { LayoutGrid, Search, Sparkles, X } from 'lucide-react';
import {
  occasions,
  sampleForTemplate,
  templates,
  type OccasionId,
  type Template,
} from '@/config';
import { RichTemplateCard } from '@/components/templates/rich-template-card';
import { TemplatePreviewModal } from '@/components/templates/template-preview-modal';
import { cn } from '@/lib/utils';

interface TemplateGalleryClientProps {
  preview: boolean;
}

export function TemplateGalleryClient({ preview }: TemplateGalleryClientProps) {
  const [selectedOccasion, setSelectedOccasion] = useState<string>('all');
  const [selectedLayout, setSelectedLayout] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePreviewTemplate, setActivePreviewTemplate] = useState<Template | null>(null);

  // Filter templates dynamically
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Filter by Occasion
      if (selectedOccasion !== 'all') {
        const matchesOccasion =
          template.occasions === null ||
          template.occasions.includes(selectedOccasion as OccasionId);
        if (!matchesOccasion) return false;
      }

      // Filter by Layout
      if (selectedLayout !== 'all') {
        if (template.layout !== selectedLayout) return false;
      }

      // Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sample = sampleForTemplate(template.id);
        const matchesName = template.label.toLowerCase().includes(q);
        const matchesBlurb = template.blurb.toLowerCase().includes(q);
        const matchesTags = sample.tags.some((tag) => tag.toLowerCase().includes(q));
        const matchesLayout = template.layout.toLowerCase().includes(q);
        if (!matchesName && !matchesBlurb && !matchesTags && !matchesLayout) return false;
      }

      return true;
    });
  }, [selectedOccasion, selectedLayout, searchQuery]);

  const occasionsList = [
    { id: 'all', label: 'All Designs', glyph: '🌟' },
    ...occasions.filter((o) => o.id !== 'other'),
  ];

  const layoutList: { id: string; label: string }[] = [
    { id: 'all', label: 'All Layouts' },
    { id: 'classic', label: 'Classic Card' },
    { id: 'editorial', label: 'Editorial Magazine' },
    { id: 'poster', label: 'Bold Poster' },
    { id: 'minimal', label: 'Minimalist' },
  ];

  return (
    <div className="space-y-8">
      {/* Control Bar: Filters & Live Search */}
      <div className="space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm sm:p-6">
        {/* Top Controls: Search Bar & Quick Stats */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, mood, or font (e.g. Midnight, Warm, Serif)..."
              className="h-10 w-full rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] pl-10 pr-9 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
              <Sparkles className="size-3.5 text-[var(--accent)]" />
              {filteredTemplates.length} of {templates.length} Designs
            </span>
            <span>·</span>
            <span>4 Distinct Layouts</span>
          </div>
        </div>

        {/* Occasion Filter Pills */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Filter by Occasion
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {occasionsList.map((occ) => (
              <button
                key={occ.id}
                type="button"
                onClick={() => setSelectedOccasion(occ.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                  selectedOccasion === occ.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm font-semibold scale-105'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-page)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]',
                )}
              >
                <span aria-hidden>{occ.glyph}</span>
                <span>{occ.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Layout Style Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
          <span className="text-xs font-medium text-[var(--text-muted)] mr-1 flex items-center gap-1">
            <LayoutGrid className="size-3.5" />
            Layout:
          </span>
          {layoutList.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => setSelectedLayout(layout.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedLayout === layout.id
                  ? 'bg-[var(--surface-page)] text-[var(--text-primary)] font-semibold border border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]',
              )}
            >
              {layout.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Rich Template Cards */}
      {filteredTemplates.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center">
          <span className="size-12 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center text-lg mb-3">
            🔍
          </span>
          <h3 className="text-base font-semibold">No designs match your filter</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Try clearing your search query or selecting &quot;All Designs&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedOccasion('all');
              setSelectedLayout('all');
              setSearchQuery('');
            }}
            className="mt-4 inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-contrast)]"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTemplates.map((template) => (
            <RichTemplateCard
              key={template.id}
              template={template}
              preview={preview}
              onQuickPreview={(t) => setActivePreviewTemplate(t)}
            />
          ))}
        </div>
      )}

      {/* Interactive Modal Simulator */}
      <TemplatePreviewModal
        template={activePreviewTemplate}
        onClose={() => setActivePreviewTemplate(null)}
      />
    </div>
  );
}
