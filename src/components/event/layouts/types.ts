import type { Occasion, Template } from '@/config';
import type { EventDoc } from '@/types/domain';

/**
 * What every invitation layout receives.
 *
 * The layouts share this one contract so a host can switch template — and therefore
 * layout — without anything about their event needing to change. Each layout decides how
 * to arrange these; none of them decides *what* they are.
 */
export interface InvitationLayoutProps {
  event: EventDoc;
  template: Template;
  occasion: Occasion;
  /** Rendered detail rows: when, where, dress code. Layouts place, never build, these. */
  details: React.ReactNode;
  /** The "Made with Marquee" line, or null on plans that removed it. */
  attribution: React.ReactNode;
  /**
   * The tag for the event's title. `h1` on a real invitation, where the event *is* the page.
   *
   * Anywhere the invitation is a sample — the landing page showcase, the create preview — it
   * has to step down, because a marketing page that renders a real invitation ends up with
   * two level-1 headings and a screen-reader user hears "Every occasion deserves a marquee"
   * and "Maya's 40th Birthday Celebration" as equal claims about what the page is.
   *
   * Styling does not follow from this: the title keeps the layout's own type scale either
   * way. Only the outline changes.
   */
  titleAs?: 'h1' | 'h2';
}
