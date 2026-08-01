import { formatAmount } from '@/lib/parcels/format';
import { Table, type Column } from '@/components/ui/admin/Table';
import s from './ReportAmountTable.module.css';

export type ReportAmountRow = { key: string; amount: number };

// The "Type | Amount" + Total table that four of the Parcels Reports blocks share (Payment
// Colected, Remain Payment, Colected In USA, Colected In Georgia) — promoted per AGENTS.md's
// "if a pattern shows up in a second place" rule rather than pasted four times.
export function ReportAmountTable({ title, rows, total }: { title: string; rows: ReportAmountRow[]; total: number }) {
  const columns: Column<ReportAmountRow>[] = [
    { key: 'key', label: 'Type' },
    { key: 'amount', label: 'Amount', render: (row) => formatAmount(row.amount) },
  ];

  return (
    <div>
      <h2 className={s.heading}>{title}</h2>
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.key}
        emptyMessage={null}
        footer={
          <tr>
            <th>Total</th>
            <td>{formatAmount(total)}</td>
          </tr>
        }
      />
    </div>
  );
}
