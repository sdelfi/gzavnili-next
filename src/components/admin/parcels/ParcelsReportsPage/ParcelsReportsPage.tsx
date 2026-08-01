'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import cn from 'classnames';
import { PageHeading } from '@/components/ui/PageHeading';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import { formatAmount, formatDate, formatDateTime } from '@/lib/parcels/format';
import { getParcelsReport, type ParcelsReport } from '@/lib/api/bema/parcelReports';
import s from './ParcelsReportsPage.module.css';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const TOTAL_SALE_ROWS = ['Express', 'Regular', 'Cargo', 'Linoli', 'Unknown'] as const;

// "Parcel Reports" — legacy `bema/parcels/parcels-reports.cfm` +
// `views/parcels/vwParcelsReports.cfm`. Date-range filter form + Total Sale / Payment
// Collected / Remain Payment summary tables, plus a "Paid transactions" / "History" tab pair.
// Legacy's "Colected In USA"/"Colected In Georgia" (grouped by which admin processed each
// payment) is not reproduced — this schema has no equivalent "who processed this" field on
// invoices/payments; see docs/findings.md's "Parcels Reports" entry for the full trace of
// what could and couldn't be carried over from `ParcelHistory`.
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
    router.push(`${routes.bema.parcelsReports()}?dateStart=${dateStart}&dateEnd=${dateEnd}`);
  }

  return (
    <div>
      <PageHeading>Parcel Reports</PageHeading>

      <form onSubmit={handleSubmit} className={s.filterRow}>
        <Field label="Date start:" htmlFor="datestart">
          <Input
            id="datestart"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            required
          />
        </Field>
        <Field label="Date end:" htmlFor="dateend">
          <Input id="dateend" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
        </Field>
        <div className={s.submitField}>
          <Button type="submit">Submit</Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <p>Loading…</p>}

      {report && (
        <>
          <div className={s.summaryRow}>
            <div className={s.summaryCol}>
              <h2>Total Sale</h2>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Weight</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {TOTAL_SALE_ROWS.map((key) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{formatAmount(report.totalSale[key].weight)}</td>
                      <td>{formatAmount(report.totalSale[key].cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td>{formatAmount(report.totalSale.Total.weight)}</td>
                    <td>{formatAmount(report.totalSale.Total.cost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={s.summaryCol}>
              <h2>Payment Colected</h2>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentCollected.map((row) => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      <td>{formatAmount(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td>{formatAmount(report.paymentCollectedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={s.summaryCol}>
              <h2>Remain Payment</h2>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.remainPayment.map((row) => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      <td>{formatAmount(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td>{formatAmount(report.remainPaymentTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className={s.tabs}>
            <button
              type="button"
              className={cn(s.tabButton, { [s.tabButtonActive]: tab === 'transactions' })}
              onClick={() => setTab('transactions')}
            >
              Paid transactions
            </button>
            <button
              type="button"
              className={cn(s.tabButton, { [s.tabButtonActive]: tab === 'history' })}
              onClick={() => setTab('history')}
            >
              History
            </button>
          </div>

          {tab === 'transactions' && (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ACC #</th>
                  <th>FIRST NAME</th>
                  <th>LAST NAME</th>
                  <th>TRACKING #</th>
                  <th>Service Type</th>
                  <th>WEIGHT</th>
                  <th>PAID</th>
                  <th>Payment Type</th>
                  <th>DEBT</th>
                  <th>Received by</th>
                  <th>Date/Time</th>
                </tr>
              </thead>
              <tbody>
                {report.transactions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.username}</td>
                    <td>{row.firstName}</td>
                    <td>{row.lastName}</td>
                    <td>{row.trackingNum}</td>
                    <td>{row.service}</td>
                    <td>{row.weight ?? ''}</td>
                    <td>{formatAmount(row.payAmount)}</td>
                    <td>{row.payMethod}</td>
                    <td>{formatAmount(row.debt)}</td>
                    {/* Legacy shows the processing admin's name here — unavailable, see
                        docs/findings.md. */}
                    <td></td>
                    <td>{formatDate(row.editDateTime)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
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
              </tfoot>
            </table>
          )}

          {tab === 'history' && (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Old</th>
                  <th>New</th>
                  <th>ValueName</th>
                  <th>PayMethod</th>
                  <th>PayAmount</th>
                </tr>
              </thead>
              <tbody>
                {report.statusHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.changedAt)}</td>
                    <td>{row.status}</td>
                    {/* Legacy's Old/New/PayMethod/PayAmount come from a generic field-diff
                        log this schema doesn't keep — only the status transition itself is
                        available here, see docs/findings.md. */}
                    <td></td>
                    <td>{row.status}</td>
                    <td>Status</td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
