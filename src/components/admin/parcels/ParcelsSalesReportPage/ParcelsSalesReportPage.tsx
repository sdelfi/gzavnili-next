'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeading } from '@/components/ui/PageHeading';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import { formatAmount, formatDateTime } from '@/lib/parcels/format';
import {
  getParcelsSalesReport,
  type ParcelsSalesReport,
  type SalesReportRow,
  type SalesTotals,
} from '@/lib/api/bema/parcelSalesReport';
import s from './ParcelsSalesReportPage.module.css';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyTotals(): SalesTotals {
  return { cashUs: 0, cashGe: 0, ccUs: 0, ccGe: 0, check: 0, deposit: 0, authorize: 0, paypal: 0, balance: 0 };
}

// legacy `pr-totals` block order: Cash US, Cash GE, Credit Card US, Authorize.net,
// Credit Card GE, Check, Deposit, PayPal, Balance.
const MONEY_STATS: { key: keyof SalesTotals; label: string }[] = [
  { key: 'cashUs', label: 'Cash US' },
  { key: 'cashGe', label: 'Cash GE' },
  { key: 'ccUs', label: 'Credit Card US' },
  { key: 'authorize', label: 'Authorize.net' },
  { key: 'ccGe', label: 'Credit Card GE' },
  { key: 'check', label: 'Check' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'balance', label: 'Balance' },
];

// Legacy's Service type filter offers these four options — note "Cargo" is missing even
// though `p.Service` can genuinely hold it (a real parcel would just be unselectable via this
// particular dropdown, still visible/unfiltered) — reproduced as-is, not tidied.
const SERVICE_OPTIONS = ['Express', 'Regular', 'Unknown', 'Linoli'];

type TextFilterKey =
  | 'accNum'
  | 'notes'
  | 'firstName'
  | 'lastName'
  | 'trackingNum'
  | 'weight'
  | 'paid'
  | 'paymentType'
  | 'debt'
  | 'received'
  | 'created';

type ColumnDef =
  | { key: TextFilterKey; label: string; kind: 'text' }
  | { key: 'service'; label: string; kind: 'select-service' }
  | { key: 'receivedBy'; label: string; kind: 'select-receivedBy' };

const COLUMNS: ColumnDef[] = [
  { key: 'accNum', label: 'ACC #', kind: 'text' },
  { key: 'notes', label: 'Notes', kind: 'text' },
  { key: 'firstName', label: 'First Name', kind: 'text' },
  { key: 'lastName', label: 'Last Name', kind: 'text' },
  { key: 'trackingNum', label: 'Tracking #', kind: 'text' },
  { key: 'service', label: 'Service type', kind: 'select-service' },
  { key: 'weight', label: 'Weight', kind: 'text' },
  { key: 'paid', label: 'Paid', kind: 'text' },
  { key: 'paymentType', label: 'Payment Type', kind: 'text' },
  { key: 'debt', label: 'Debt', kind: 'text' },
  { key: 'received', label: 'Received', kind: 'text' },
  { key: 'receivedBy', label: 'Received by', kind: 'select-receivedBy' },
  { key: 'created', label: 'Created', kind: 'text' },
];

type SortKey = (typeof COLUMNS)[number]['key'];
type CellKey = TextFilterKey | 'service' | 'receivedBy';

const EMPTY_FILTERS: Record<TextFilterKey, string> = {
  accNum: '',
  notes: '',
  firstName: '',
  lastName: '',
  trackingNum: '',
  weight: '',
  paid: '',
  paymentType: '',
  debt: '',
  received: '',
  created: '',
};

/** The rendered text for every column, in `COLUMNS` order — the single source of truth for
 *  per-column filtering, the global search haystack, sorting fallback, and every export
 *  format, so they can never drift from what the table itself displays. */
function rowCells(row: SalesReportRow): Record<CellKey, string> {
  return {
    accNum: row.accNum,
    notes: row.notes ?? '',
    firstName: row.firstName ?? '',
    lastName: row.lastName,
    trackingNum: row.trackingNum,
    service: row.service ?? '',
    weight: row.weight == null ? '' : String(row.weight),
    paid: row.paidAmount == null ? '' : formatAmount(row.paidAmount),
    paymentType: row.paymentType,
    debt: formatAmount(row.debt),
    received: row.received ?? '',
    receivedBy: row.receivedBy,
    created: formatDateTime(row.created),
  };
}

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function compareRows(a: SalesReportRow, b: SalesReportRow, key: SortKey): number {
  if (key === 'weight') return (a.weight ?? -Infinity) - (b.weight ?? -Infinity);
  if (key === 'paid') return (a.paidAmount ?? -Infinity) - (b.paidAmount ?? -Infinity);
  if (key === 'debt') return a.debt - b.debt;
  if (key === 'created') return a.created.localeCompare(b.created);
  return rowCells(a)[key].localeCompare(rowCells(b)[key]);
}

// Client-side re-derivation of legacy's live "count2" totals (`recalcTotals()`/
// `getFilteredSum()`): summed over whatever rows are currently visible (search + column
// filters + the "out of range" toggle applied), from the "Paid" column's own amount/class —
// a different source than `ttl`/`tbt` above, which read the raw payment event (see
// parcelSalesReport.ts's header comment). Legacy derives Cash US/Credit Card US by
// subtracting the "… ge" sum from the combined sum; equivalent to (and simpler than) checking
// both substrings directly, done here.
function bucketVisibleTotals(rows: SalesReportRow[]): SalesTotals {
  const totals = emptyTotals();
  for (const row of rows) {
    const amount = row.paidAmount ?? 0;
    if (amount === 0) continue;
    const cls = row.paidClass.toLowerCase();
    if (cls.includes('card ge')) totals.ccGe += amount;
    else if (cls.includes('card')) totals.ccUs += amount;
    if (cls.includes('cash ge')) totals.cashGe += amount;
    else if (cls.includes('cash')) totals.cashUs += amount;
    if (cls.includes('check')) totals.check += amount;
    if (cls.includes('deposit')) totals.deposit += amount;
    if (cls.includes('authorize')) totals.authorize += amount;
    if (cls.includes('paypal')) totals.paypal += amount;
    if (cls.includes('balance')) totals.balance += amount;
  }
  return totals;
}

// "Parcels Reports 2" — legacy `bema/parcels/parcels-reports-2-v2.cfm` +
// `views/parcels/vwParcelsReports2-v2.cfm`: a per-payment-event DataTables report with a
// global search box, a filter per column (two of them selects), sortable columns, an
// "out of selected dates" toggle, and Excel/PDF/Print export — all reproduced client-side
// over the one array the API returns (legacy loads the whole recordset once too, then does
// all of this against the in-browser DataTables instance). See
// src/lib/services/parcelSalesReport.ts for the query/money-total fidelity notes.
export function ParcelsSalesReportPage() {
  const searchParams = useSearchParams();
  return <ParcelsSalesReportPageInner key={searchParams.toString()} />;
}

function ParcelsSalesReportPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const dateStartParam = searchParams.get('dateStart');
  const dateEndParam = searchParams.get('dateEnd');
  const hasSubmitted = !!dateStartParam && !!dateEndParam;

  const [dateStart, setDateStart] = useState(dateStartParam ?? today());
  const [dateEnd, setDateEnd] = useState(dateEndParam ?? today());
  const [report, setReport] = useState<ParcelsSalesReport | null>(null);
  const [loading, setLoading] = useState(hasSubmitted);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [serviceFilter, setServiceFilter] = useState('');
  const [receivedByFilter, setReceivedByFilter] = useState('');
  const [outOfRange, setOutOfRange] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (!hasSubmitted) return;
    let cancelled = false;
    getParcelsSalesReport({ dateStart: dateStartParam!, dateEnd: dateEndParam! })
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load report.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSubmitted, dateStartParam, dateEndParam]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(routes.bema.parcelsReports2({ dateStart, dateEnd }));
  }

  function setFilter(key: TextFilterKey, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  }

  const isFiltered =
    !!search ||
    outOfRange ||
    !!serviceFilter ||
    !!receivedByFilter ||
    Object.values(filters).some((value) => value !== '');

  const filteredRows = useMemo(() => {
    if (!report) return [];
    const rangeStart = dateStartParam ? new Date(`${dateStartParam}T00:00:00.000Z`) : null;
    const rangeEnd = dateEndParam ? new Date(`${dateEndParam}T23:59:59.000Z`) : null;

    const rows = report.rows.filter((row) => {
      if (outOfRange && rangeStart && rangeEnd) {
        const created = new Date(row.created);
        if (created >= rangeStart && created <= rangeEnd) return false;
      }
      if (serviceFilter && row.service !== serviceFilter) return false;
      if (receivedByFilter && !row.receivedBy.includes(receivedByFilter)) return false;

      const cells = rowCells(row);
      for (const key of Object.keys(filters) as TextFilterKey[]) {
        const value = filters[key];
        if (value && !includesCI(cells[key], value)) return false;
      }

      if (search && !includesCI(Object.values(cells).join(' '), search)) return false;
      return true;
    });

    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => dir * compareRows(a, b, sort.key));
    }
    return rows;
  }, [report, dateStartParam, dateEndParam, outOfRange, serviceFilter, receivedByFilter, filters, search, sort]);

  const parcelsCount = filteredRows.length;
  const weightSum = filteredRows.reduce((sum, row) => sum + (row.weight ?? 0), 0);
  const debtSum = filteredRows.reduce((sum, row) => sum + row.debt, 0);
  const liveTotals = useMemo(() => bucketVisibleTotals(filteredRows), [filteredRows]);

  async function handleExportExcel() {
    const XLSX = await import('xlsx');
    const header = COLUMNS.map((c) => c.label);
    const data = filteredRows.map((row) => {
      const cells = rowCells(row);
      return COLUMNS.map((c) => cells[c.key]);
    });
    const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Parcels Reports 2');
    XLSX.writeFile(workbook, `parcels-reports-2-${dateStartParam}-${dateEndParam}.xlsx`);
  }

  async function handleExportPdf() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [COLUMNS.map((c) => c.label)],
      body: filteredRows.map((row) => {
        const cells = rowCells(row);
        return COLUMNS.map((c) => cells[c.key]);
      }),
      styles: { fontSize: 6 },
    });
    doc.save(`parcels-reports-2-${dateStartParam}-${dateEndParam}.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      <PageHeading>Parcels Reports 2</PageHeading>

      <form onSubmit={handleSubmit} className={s.filterRow}>
        <Field label="Date start:" htmlFor="datestart">
          <Input id="datestart" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
        </Field>
        <Field label="Date end:" htmlFor="dateend">
          <Input id="dateend" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
        </Field>
        <div className={s.submitField}>
          <Button type="submit">Go</Button>
        </div>
        <Field label="Search:" htmlFor="q">
          <Input id="q" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <div className={s.statsInline}>
          <span>
            Parcels <strong>{parcelsCount}</strong>
          </span>
          <span>
            Weight <strong>{formatAmount(weightSum)}</strong>
          </span>
          {/* "Depth" — legacy's own label, not "Debt". Kept verbatim. */}
          <span>
            Depth <strong>${formatAmount(debtSum)}</strong>
          </span>
        </div>
        <div className={s.exportButtons}>
          <Button type="button" variant="secondary" onClick={handleExportExcel}>
            Excel
          </Button>
          <Button type="button" variant="secondary" onClick={handleExportPdf}>
            PDF
          </Button>
          <Button type="button" variant="secondary" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </form>

      <div className={s.outOfRangeRow}>
        <Checkbox
          label="created out of selected dates"
          checked={outOfRange}
          onChange={(e) => setOutOfRange(e.target.checked)}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <p>Loading…</p>}

      {report && (
        <>
          <div className={s.statsGrid}>
            {MONEY_STATS.map(({ key, label }) => (
              <div className={s.statCard} key={key}>
                <div className={s.statLabel}>{label}</div>
                <div className={s.statValue}>${formatAmount(report.ttl[key])}</div>
                <div className={s.statValueTbt}>${formatAmount(report.tbt[key])}</div>
                {isFiltered && <div className={s.statValueLive}>${formatAmount(liveTotals[key])}</div>}
              </div>
            ))}
          </div>

          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key}>
                      {col.kind === 'text' && (
                        <Input
                          className={s.filterInput}
                          value={filters[col.key]}
                          onChange={(e) => setFilter(col.key, e.target.value)}
                        />
                      )}
                      {col.kind === 'select-service' && (
                        <Select
                          instanceId="reports2-service-filter"
                          size="sm"
                          value={serviceFilter as '' | (typeof SERVICE_OPTIONS)[number]}
                          onChange={(value) => setServiceFilter(value)}
                          options={[
                            { value: '', label: 'All' },
                            ...SERVICE_OPTIONS.map((o) => ({ value: o, label: o })),
                          ]}
                        />
                      )}
                      {col.kind === 'select-receivedBy' && (
                        <Select
                          instanceId="reports2-received-by-filter"
                          size="sm"
                          value={receivedByFilter}
                          onChange={(value) => setReceivedByFilter(value)}
                          options={[
                            { value: '', label: 'All' },
                            ...report.bemaUsers.map((u) => ({
                              value: u.username,
                              label: `${u.firstName ?? ''} ${u.lastName ?? ''} (${u.username})`,
                            })),
                          ]}
                        />
                      )}
                    </th>
                  ))}
                </tr>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key}>
                      <button type="button" className={s.sortButton} onClick={() => toggleSort(col.key)}>
                        {col.label}
                        {sort?.key === col.key && <span>{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className={s.empty}>
                      No records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.accNum}</td>
                      <td>{row.notes}</td>
                      <td>{row.firstName}</td>
                      <td>{row.lastName}</td>
                      <td>{row.trackingNum}</td>
                      <td>{row.service}</td>
                      <td>{row.weight ?? ''}</td>
                      <td>{row.paidAmount == null ? '' : formatAmount(row.paidAmount)}</td>
                      <td>{row.paymentType}</td>
                      <td>{formatAmount(row.debt)}</td>
                      <td>{row.received}</td>
                      <td>{row.receivedBy}</td>
                      <td>{formatDateTime(row.created)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
