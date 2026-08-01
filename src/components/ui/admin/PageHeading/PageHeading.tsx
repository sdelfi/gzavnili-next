import type { ReactNode } from 'react';
import s from './PageHeading.module.css';

// The `<h1>` every bema admin page opens with, plus an optional trailing metadata string
// (a total count, a status line). Promoted out of ParcelListPage/ParcelEditPage per AGENTS.md's
// "if a pattern shows up in a second place" rule — both had hand-rolled the identical
// `.heading`/`.title`/`.meta` trio, and UserListPage/PageListPage/ParcelAddPage each had their
// own slightly different one-off heading style instead of reusing either.
export function PageHeading({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className={s.row}>
      <h1 className={s.title}>{children}</h1>
      {meta && <span className={s.meta}>{meta}</span>}
    </div>
  );
}
