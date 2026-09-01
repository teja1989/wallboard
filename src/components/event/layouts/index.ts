import type { TemplateLayout } from '@/config';
import { ClassicLayout } from './classic';
import { EditorialLayout } from './editorial';
import { MinimalLayout } from './minimal';
import { PosterLayout } from './poster';
import type { InvitationLayoutProps } from './types';

export type { InvitationLayoutProps };

/**
 * Layout lookup. Adding a layout means adding it here and to `TEMPLATE_LAYOUTS` — the
 * `Record` type makes the compiler insist on the second half.
 */
export const invitationLayouts: Record<
  TemplateLayout,
  (props: InvitationLayoutProps) => React.ReactNode
> = {
  classic: ClassicLayout,
  editorial: EditorialLayout,
  minimal: MinimalLayout,
  poster: PosterLayout,
};
