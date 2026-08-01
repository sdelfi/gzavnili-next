import type { ReactNode } from 'react';
import cn from 'classnames';
import s from './Field.module.css';

// A labelled form control. Promoted to `ui/` per AGENTS.md's "if a pattern shows up in a
// second place" rule: `UserForm`/`PageForm` had already hand-rolled `<label class={s.field}>`
// wrappers, and the parcels filter bar needs a couple of dozen more of them.
//
// `width` maps to the legacy Bootstrap column widths the two parcels search forms use
// (`col-lg-1`/`col-lg-2`/`col-lg-3`) — not a general-purpose grid, just the three sizes the
// filter bar actually lays out with.
export function Field({
  label,
  htmlFor,
  width = 'md',
  hint,
  inline = false,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  width?: 'xs' | 'sm' | 'md' | 'lg';
  hint?: ReactNode;
  /** Label sits to the left of the control on one line, like legacy's own form rows, instead
   *  of stacked above it. */
  inline?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(s.field, s[width], className, { [s.inline]: inline })}>
      <label className={s.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}
