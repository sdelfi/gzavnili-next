import { formatAmount } from '@/lib/parcels/format';
import s from './ReportAmountTable.module.css';

export type ReportAmountRow = { key: string; amount: number };

// The "Type | Amount" + Total table that four of the Parcels Reports blocks share (Payment
// Colected, Remain Payment, Colected In USA, Colected In Georgia) — promoted per AGENTS.md's
// "if a pattern shows up in a second place" rule rather than pasted four times.
//
// `format` exists because legacy is inconsistent here and the difference is visible: Payment
// Colected / Remain Payment print through `numberFormat(x, "_.__")` (two decimals), while the
// two "Colected In …" tables print the raw CF number (`#CollectedUS[name]#` — so `20`, not
// `20.00`). Ported as-is rather than unified.
export function ReportAmountTable({
  title,
  rows,
  total,
  format = 'fixed',
}: {
  title: string;
  rows: ReportAmountRow[];
  total: number;
  format?: 'fixed' | 'raw';
}) {
  const render = (value: number) => (format === 'fixed' ? formatAmount(value) : String(value));

  return (
    <div>
      <h2 className={s.heading}>{title}</h2>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.key}</td>
              <td>{render(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <td>{render(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
