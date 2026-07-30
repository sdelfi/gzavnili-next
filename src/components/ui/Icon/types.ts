// The subset of the legacy sprite-icon system (`public/css/style.css`'s former `i.icon.icon-*`
// rules, now ported into Icon.module.css) actually used by a ported component today. Extend
// this list — and add the matching class to Icon.module.css — as more pages get ported; see
// AGENTS.md's "Global CSS cleanup" rule for why this stays scoped to what's in use rather
// than pre-porting the ~100 icons style.css still has for not-yet-built pages.
export type IconName =
  | 'inbox'
  | 'tracking'
  | 'login'
  | 'menu'
  | 'arr1'
  | 'arr2'
  // Pre-existing legacy gap, not introduced here: legacy markup uses `icon-arr3`
  // (http/views/layouts/new.html) but no CSS rule for it ever existed in style.css either —
  // it silently renders as a sizeless/blank icon in both legacy and here. Kept faithfully
  // broken rather than inventing a background-position that was never defined.
  | 'arr3'
  | 'info'
  | 'whyus-1'
  | 'whyus-2'
  | 'whyus-3'
  | 'whyus-4'
  | 'whyus-5'
  | 'whyus-6'
  | 'whyus-7'
  | 'whyus-8';
