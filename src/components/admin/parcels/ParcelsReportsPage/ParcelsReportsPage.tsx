'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Button } from '@/components/ui/admin/Button';
import { Alert } from '@/components/ui/admin/Alert';
import { Table, type Column } from '@/components/ui/admin/Table';
import { Tabs } from '@/components/ui/admin/Tabs';
import { ReportAmountTable } from '@/components/admin/parcels/ReportAmountTable';
import { routes } from '@/lib/routes';
import { formatAmount, formatDate, formatDateTime } from '@/lib/parcels/format';
import { getParcelsReport, type ParcelsReport } from '@/lib/api/bema/parcelReports';
import s from './ParcelsReportsPage.module.css';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const TOTAL_SALE_ROWS = ['Express', 'Regular', 'Cargo', 'Linoli', 'Unknown'] as const;
type TotalSaleKey = (typeof TOTAL_SALE_ROWS)[number];

// "Parcel Reports" — legacy `bema/parcels/parcels-reports.cfm` +
// `views/parcels/vwParcelsReports.cfm`, in full: date-range filter, Total Sale / Payment
// Colected / Remain Payment, the two per-admin "Colected In …" tables, and the
// "Paid transactions" / "History" tab pair. Every figure comes from the restored
// `parcel_history` edit log (docs/decisions/0018-parcel-edit-history.md), the same table
// legacy reads, so the numbers are the legacy numbers — including the "Colected In Georgia"
// total's known legacy bug, reproduced deliberately (see docs/findings.md).
//
// Headings keep legacy's own spelling ("Colected") — operators know these blocks by name and
// this is a port, not a copy edit.
export function ParcelsReportsPage() {
  const searchParams = useSearchParams();
  // Remounted (via `key`) whenever the URL's dateStart/dateEnd change, so the fetch effect
  // below never needs to reset state for a "no longer submitted" transition itself — same
  // idiom as `PricingRulesAdminPage`/`ParcelListPage`.
  return <ParcelsReportsPageInner key={searchParams.toString()} />;
}

function ParcelsReportsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const dateStartParam = searchParams.get('dateStart');
  const dateEndParam = searchParams.get('dateEnd');
  const hasSubmitted = !!dateStartParam && !!dateEndParam;

  const [dateStart, setDateStart] = useState(dateStartParam ?? today());
  const [dateEnd, setDateEnd] = useState(dateEndParam ?? today());
  const [report, setReport] = useState<ParcelsReport | null>(null);
  const [loading, setLoading] = useState(hasSubmitted);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'transactions' | 'history'>('transactions');

  useEffect(() => {
    if (!hasSubmitted) return;
    let cancelled = false;
    getParcelsReport({ dateStart: dateStartParam!, dateEnd: dateEndParam! })
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
    router.push(routes.bema.parcelsReports({ dateStart, dateEnd }));
  }

  const transactionColumns: Column<NonNullable<typeof report>['transactions'][number]>[] = [
    { key: 'username', label: 'ACC #' },
    { key: 'firstName', label: 'FIRST NAME' },
    { key: 'lastName', label: 'LAST NAME' },
    { key: 'trackingNum', label: 'TRACKING #' },
    { key: 'service', label: 'Service Type' },
    { key: 'weight', label: 'WEIGHT', render: (row) => row.weight ?? '' },
    { key: 'payAmount', label: 'PAID', render: (row) => formatAmount(row.payAmount) },
    { key: 'payMethod', label: 'Payment Type' },
    { key: 'debt', label: 'DEBT', render: (row) => formatAmount(row.debt) },
    { key: 'receivedBy', label: 'Received by' },
    { key: 'editDateTime', label: 'Date/Time', render: (row) => formatDate(row.editDateTime) },
  ];

  const historyColumns: Column<NonNullable<typeof report>['history'][number]>[] = [
    { key: 'editDateTime', label: 'Date', render: (row) => formatDateTime(row.editDateTime) },
    { key: 'editStatus', label: 'Status' },
    { key: 'oldValue', label: 'Old' },
    { key: 'newValue', label: 'New' },
    { key: 'valueName', label: 'ValueName' },
    { key: 'payMethod', label: 'PayMethod' },
    { key: 'payAmount', label: 'PayAmount', render: (row) => formatAmount(row.payAmount) },
  ];

  return (
    <div>
      <PageHeading>Parcel Reports</PageHeading>

      <form onSubmit={handleSubmit} className={s.filterRow}>
        <Field label="Date start:" htmlFor="datestart">
          <Input id="datestart" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
        </Field>
        <Field label="Date end:" htmlFor="dateend">
          <Input id="dateend" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
        </Field>
        <div>
          <Button type="submit">Submit</Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <p>Loading…</p>}

      {report && (
        <>
          <div className={s.summaryRow}>
            <div className={s.summaryCol}>
              <h2 className={s.heading}>Total Sale</h2>
              <Table<TotalSaleKey>
                columns={[
                  { key: 'type', label: 'Type', render: (key) => key },
                  { key: 'weight', label: 'Weight', render: (key) => formatAmount(report.totalSale[key].weight) },
                  { key: 'cost', label: 'Cost', render: (key) => formatAmount(report.totalSale[key].cost) },
                ]}
                rows={[...TOTAL_SALE_ROWS]}
                getRowKey={(key) => key}
                footer={
                  <tr>
                    <th>Total</th>
                    <td>{formatAmount(report.totalSale.Total.weight)}</td>
                    <td>{formatAmount(report.totalSale.Total.cost)}</td>
                  </tr>
                }
              />
            </div>

            <div className={s.summaryCol}>
              <ReportAmountTable
                title="Payment Colected"
                rows={report.paymentCollected}
                total={report.paymentCollectedTotal}
              />
            </div>

            <div className={s.summaryCol}>
              <ReportAmountTable title="Remain Payment" rows={report.remainPayment} total={report.remainPaymentTotal} />
            </div>
          </div>

          {/* Legacy renders each of these only when it has at least one row
              (`StructCount(...) gt 0`). */}
          {(report.collectedUs.length > 0 || report.collectedGe.length > 0) && (
            <div className={s.summaryRow}>
              {report.collectedUs.length > 0 && (
                <div className={s.summaryCol}>
                  <ReportAmountTable
                    title="Colected In USA"
                    rows={report.collectedUs}
                    total={report.collectedUsTotal}
                    format="raw"
                  />
                </div>
              )}
              {report.collectedGe.length > 0 && (
                <div className={s.summaryCol}>
                  <ReportAmountTable
                    title="Colected In Georgia"
                    rows={report.collectedGe}
                    total={report.collectedGeTotal}
                    format="raw"
                  />
                </div>
              )}
            </div>
          )}

          <Tabs
            ariaLabel="Parcel report details"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'transactions', label: 'Paid transactions' },
              { value: 'history', label: 'History' },
            ]}
          />

          {tab === 'transactions' && (
            <Table
              columns={transactionColumns}
              rows={report.transactions}
              getRowKey={(row) => row.id}
              emptyMessage={null}
              footer={
                <tr>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th>{formatAmount(report.transactionsTotals.weight)}</th>
                  <th>{formatAmount(report.transactionsTotals.payAmount)}</th>
                  <th></th>
                  <th>{formatAmount(report.transactionsTotals.debt)}</th>
                  <th></th>
                  <th></th>
                </tr>
              }
            />
          )}

          {tab === 'history' && (
            <Table columns={historyColumns} rows={report.history} getRowKey={(row) => row.id} emptyMessage={null} />
          )}
        </>
      )}
    </div>
  );
}
