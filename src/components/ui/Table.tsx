import cn from 'classnames';
import s from './Table.module.css';

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
};

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
}: {
  columns: Column<T>[];
  rows: T[];
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  return (
    <table className={s.table}>
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
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className={s.empty}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={getRowKey(row)} className={cn(i % 2 === 0 ? s.rowEven : s.rowOdd)}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
