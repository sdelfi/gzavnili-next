import cn from 'classnames';
import s from './Pagination.module.css';

// Windowed page-number strip, mirroring the legacy `pagination_admin.cfm` custom tag's
// behavior (record_start/record_end summary + a sliding window of page numbers around the
// current page) — see docs/decisions/0011-bema-admin.md.
export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  windowSize = 5,
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  windowSize?: number;
}) {
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  const windowStart = Math.max(1, Math.min(page - Math.floor(windowSize / 2), maxPage - windowSize + 1));
  const windowEnd = Math.min(maxPage, windowStart + windowSize - 1);
  const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);
  const recordStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const recordEnd = Math.min(total, page * perPage);

  return (
    <div className={s.pagination}>
      <span className={s.summary}>
        {recordStart}–{recordEnd} of {total}
      </span>
      <button type="button" className={s.pageButton} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ‹
      </button>
      {pages.map((p) => (
        <button
          type="button"
          key={p}
          className={cn(s.pageButton, { [s.active]: p === page })}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}
      <button type="button" className={s.pageButton} disabled={page >= maxPage} onClick={() => onPageChange(page + 1)}>
        ›
      </button>
    </div>
  );
}
