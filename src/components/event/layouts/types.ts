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
}
