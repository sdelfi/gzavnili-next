'use client';

import { useState, type ReactNode } from 'react';
import cn from 'classnames';
import s from './CollapsibleSection.module.css';

// Mirrors the legacy edit-form pattern of collapsible `<h2>` section headers ("Account
// Information" / "Contact Information" toggling open/closed) — see
// docs/decisions/0011-bema-admin.md.
export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={s.section}>
      <button type="button" className={s.header} onClick={() => setOpen((prev) => !prev)}>
        <span className={cn(s.chevron, { [s.chevronOpen]: open })}>▸</span>
        {title}
      </button>
      {open && <div className={s.body}>{children}</div>}
    </section>
  );
}
