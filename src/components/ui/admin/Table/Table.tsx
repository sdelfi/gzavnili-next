import type { ReactNode } from 'react';
import cn from 'classnames';
import s from './Table.module.css';
import type { Column } from './types';

export function TableSurface({
  children,
  className,
  wrapperClassName,
  density = 'normal',
  scrollable = true,
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  density?: 'normal' | 'compact' | 'condensed';
  scrollable?: boolean;
}) {
  const table = <table className={cn(s.table, s[density], className)}>{children}</table>;
  return scrollable ? <div className={cn(s.wrapper, wrapperClassName)}>{table}</div> : table;
}

// Generic sortable/zebra-striped data table — the shared shape behind every bema list
// screen (legacy `<table class="browse">` + `request.udf.getSortLink(...)` header pattern,
// see docs/decisions/0011-bema-admin.md). Presentation-only: sort/pagination state is
// owned by the page (URL-driven, so lists stay bookmarkable, matching the legacy pattern).
export function Table<T>({
  columns,
  rows,
  sort,
  onSort,
  getRowKey,
  emptyMessage = 'No records found.',
  footer,
  density = 'normal',
}: {
  columns: Column<T>[];
  rows: T[];
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  getRowKey: (row: T) => string;
  emptyMessage?: ReactNode | null;
  footer?: ReactNode;
  density?: 'normal' | 'compact' | 'condensed';
}) {
  return (
    <TableSurface density={density}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>
              {col.sortable && onSort ? (
                <button type="button" className={s.sortButton} onClick={() => onSort(col.key)}>
                  {col.label}
                  {sort?.key === col.key && <span className={s.sortIndicator}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              ) : (
                col.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && emptyMessage != null ? (
          <tr>
            <td colSpan={columns.length} className={s.empty}>
              {emptyMessage}
            </td>
          </tr>
        ) : rows.length > 0 ? (
          rows.map((row, i) => (
            <tr key={getRowKey(row)} className={cn(i % 2 === 0 ? s.rowEven : s.rowOdd)}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))
        ) : null}
      </tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </TableSurface>
  );
}
