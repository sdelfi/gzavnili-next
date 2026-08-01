'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Button } from '@/components/ui/admin/Button';
import { Alert } from '@/components/ui/admin/Alert';
import { Dialog } from '@/components/ui/admin/Dialog';
import { TableSurface } from '@/components/ui/admin/Table';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { formatAmount, formatDate } from '@/lib/parcels/format';
import {
  getMoneyCollectReport,
  collectMoney,
  type MoneyCollectReport,
  type MoneyCollectGroupRow,
} from '@/lib/api/bema/moneyCollect';
import s from './MoneyCollectPage.module.css';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupKey(g: MoneyCollectGroupRow): string {
  return `${g.updaterId}|${g.dateKey}`;
}

type ModalState =
  { mode: 'collect'; group: MoneyCollectGroupRow } | { mode: 'detail'; group: MoneyCollectGroupRow } | null;

// "Money collect" — legacy `bema/parcels/money-collect.cfm` +
// `views/parcels/vwMoneyCollect.cfm` (report) + `bema/ajax/moneyCollect.cfm` (the "Collect
// Money" write action). See src/lib/services/moneyCollect.ts for the report query/grouping
// fidelity notes and docs/findings.md for what wasn't portable (the online-payment backfill
// insert) and what was deliberately hardened (the collect endpoint's auth).
export function MoneyCollectPage() {
  const { user } = useBemaAuth();

  const [dateStart, setDateStart] = useState(today());
  const [dateEnd, setDateEnd] = useState(today());
  const [country, setCountry] = useState<'' | 'us' | 'ge'>('');
  const [submittedParams, setSubmittedParams] = useState<{
    dateStart: string;
    dateEnd: string;
    country: '' | 'us' | 'ge';
  } | null>(null);

  const [report, setReport] = useState<MoneyCollectReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [modalFields, setModalFields] = useState({ aCash: 0, aCreditCard: 0, aBankDeposit: 0, aWireTransfer: 0 });
  const [collectorUsername, setCollectorUsername] = useState('');
  const [gDate, setGDate] = useState(today());
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!submittedParams) return;
    let cancelled = false;
    getMoneyCollectReport({
      dateStart: submittedParams.dateStart,
      dateEnd: submittedParams.dateEnd,
      country: submittedParams.country || undefined,
    })
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
  }, [submittedParams, reloadToken]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSelectedKey(null);
    setLoading(true);
    setError(null);
    setSubmittedParams({ dateStart, dateEnd, country });
  }

  const selectedGroup = useMemo(
    () => report?.groups.find((g) => groupKey(g) === selectedKey) ?? null,
    [report, selectedKey],
  );

  function selectRow(g: MoneyCollectGroupRow) {
    // legacy: the radio only exists when `collected eq "" and updaterUserName neq ""`.
    if (g.collected !== null || !g.updaterUsername) return;
    setSelectedKey(groupKey(g));
  }

  function openCollectModal(g: MoneyCollectGroupRow) {
    // legacy's modal prefill reads the row's *displayed* Cash/Credit Card(US)/Bank
    // Deposit/Wire Transfer spans only — Credit Card GE, Check, PayPal and Authorize are not
    // included in the collection total at all, a real legacy gap kept as-is (see
    // docs/findings.md).
    setModalFields({
      aCash: g.cash,
      aCreditCard: g.creditCard,
      aBankDeposit: g.bankDeposit,
      aWireTransfer: g.wireTransfer,
    });
    setCollectorUsername(user?.username ?? '');
    setGDate(today());
    setPassword('');
    setModal({ mode: 'collect', group: g });
  }

  function openDetailModal(g: MoneyCollectGroupRow) {
    setModalFields({
      aCash: g.aCash ?? 0,
      aCreditCard: g.aCreditCard ?? 0,
      aBankDeposit: g.aBankDeposit ?? 0,
      aWireTransfer: g.aWireTransfer ?? 0,
    });
    setModal({ mode: 'detail', group: g });
  }

  const modalTotal = modalFields.aCash + modalFields.aCreditCard + modalFields.aBankDeposit + modalFields.aWireTransfer;

  async function handleCollectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || modal.mode !== 'collect') return;
    setSubmitting(true);
    try {
      await collectMoney({
        userId: modal.group.userId,
        cDate: modal.group.dateKey,
        aCash: modalFields.aCash,
        aCreditCard: modalFields.aCreditCard,
        aBankDeposit: modalFields.aBankDeposit,
        aWireTransfer: modalFields.aWireTransfer,
        aTotal: modalTotal,
        collectorUsername,
        gDate,
        password,
      });
      setModal(null);
      setSelectedKey(null);
      setLoading(true);
      setError(null);
      setReloadToken((prev) => prev + 1);
    } catch (err) {
      const code =
        err instanceof Error && 'body' in err ? (err as unknown as { body?: { error?: string } }).body?.error : null;
      if (code === 'invalid_params') window.alert('Invalid Params');
      else if (code === 'wrong_password') window.alert('Wrong password');
      else window.alert(err instanceof Error ? err.message : 'Wrong password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeading>Money Collect</PageHeading>

      <form onSubmit={handleSubmit} className={s.filterRow}>
        <Field label="Date start:" htmlFor="datestart">
          <Input id="datestart" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
        </Field>
        <Field label="Date end:" htmlFor="dateend">
          <Input id="dateend" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
        </Field>
        <Field label="Country:" htmlFor="country">
          <Select
            instanceId="money-collect-country"
            value={country}
            onChange={(value) => setCountry(value as '' | 'us' | 'ge')}
            options={[
              { value: '', label: 'All' },
              { value: 'us', label: 'US' },
              { value: 'ge', label: 'GE' },
            ]}
          />
        </Field>
        <div className={s.submitField}>
          <Button type="submit">Submit</Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <p>Loading…</p>}

      {report && (
        <>
          <TableSurface wrapperClassName={s.tableWrapper} density="compact">
            <thead>
              <tr>
                <th></th>
                <th>Agents Name</th>
                <th>Cash</th>
                <th>Credit Card</th>
                <th>Credit Card GE</th>
                <th>Bank Deposit</th>
                <th>Wire Transfer</th>
                <th>Check</th>
                <th>Paypal</th>
                <th>Authorize</th>
                <th>Total</th>
                <th>Collection Date</th>
                <th>Summary Collected</th>
                <th>Collect By</th>
                <th>Collected Date</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.length === 0 ? (
                <tr>
                  <td colSpan={14} className={s.empty}>
                    No records found.
                  </td>
                </tr>
              ) : (
                report.groups.map((g) => {
                  const key = groupKey(g);
                  const canSelect = g.collected === null && !!g.updaterUsername;
                  return (
                    <tr key={key} onClick={() => selectRow(g)} className={canSelect ? s.selectable : undefined}>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canSelect && (
                          // Not `ui/admin/RadioGroup`: that component renders one *group* of
                          // mutually-exclusive options together in a single wrapper: this is a
                          // single radio per table row, one row apart from the next, sharing a
                          // `name` only for native browser exclusivity — a different shape
                          // `RadioGroup`'s all-options-in-one-`<div>` API can't represent.
                          <input
                            type="radio"
                            name="checked"
                            checked={selectedKey === key}
                            onChange={() => setSelectedKey(key)}
                          />
                        )}
                      </td>
                      <td>{g.updaterDisplayName}</td>
                      <td>${formatAmount(g.cash)}</td>
                      <td>${formatAmount(g.creditCard)}</td>
                      <td>${formatAmount(g.creditCardGe)}</td>
                      <td>${formatAmount(g.bankDeposit)}</td>
                      <td>${formatAmount(g.wireTransfer)}</td>
                      <td>${formatAmount(g.check)}</td>
                      <td>${formatAmount(g.paypal)}</td>
                      <td>${formatAmount(g.authorize)}</td>
                      <td>
                        <b>${formatAmount(g.total)}</b>
                      </td>
                      <td>{formatDate(`${g.dateKey}T00:00:00.000Z`)}</td>
                      <td className={g.collected !== null && g.collected !== g.total ? s.mismatch : undefined}>
                        {g.collected !== null && (
                          <>
                            ${formatAmount(g.collected)}{' '}
                            <Button
                              type="button"
                              variant="link"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal(g);
                              }}
                            >
                              Detail
                            </Button>
                          </>
                        )}
                      </td>
                      <td>{g.collectorUsername}</td>
                      <td>{g.gDate ? formatDate(g.gDate) : ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </TableSurface>

          <Button
            type="button"
            disabled={!selectedGroup}
            onClick={() => selectedGroup && openCollectModal(selectedGroup)}
          >
            Collect Money
          </Button>
        </>
      )}

      <Dialog
        open={!!modal}
        onClose={() => setModal(null)}
        title="Money Transfer"
        size="md"
        footer={
          modal?.mode === 'collect' ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setModal(null)}>
                Close
              </Button>
              <Button type="submit" form="collect-money-form" disabled={submitting}>
                Collect Money
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Close
            </Button>
          )
        }
      >
        {modal && (
          <form id="collect-money-form" className={s.modalForm} onSubmit={handleCollectSubmit}>
            <p className={s.collectFrom}>
              <b>Collect from</b>{' '}
              <span>
                {modal.group.updaterDisplayName} ({formatDate(`${modal.group.dateKey}T00:00:00.000Z`)})
              </span>
            </p>
            <div className={s.amountFields}>
              <Field label="Cash" htmlFor="aCash" inline>
                <Input
                  id="aCash"
                  type="number"
                  step="0.01"
                  prefix="$"
                  value={modalFields.aCash}
                  readOnly={modal.mode === 'detail'}
                  onChange={(e) => setModalFields((prev) => ({ ...prev, aCash: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Credit Card" htmlFor="aCreditCard" inline>
                <Input
                  id="aCreditCard"
                  type="number"
                  step="0.01"
                  prefix="$"
                  value={modalFields.aCreditCard}
                  readOnly={modal.mode === 'detail'}
                  onChange={(e) => setModalFields((prev) => ({ ...prev, aCreditCard: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Bank Deposit" htmlFor="aBankDeposit" inline>
                <Input
                  id="aBankDeposit"
                  type="number"
                  step="0.01"
                  prefix="$"
                  value={modalFields.aBankDeposit}
                  readOnly={modal.mode === 'detail'}
                  onChange={(e) => setModalFields((prev) => ({ ...prev, aBankDeposit: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Wire Transfer" htmlFor="aWireTransfer" inline>
                <Input
                  id="aWireTransfer"
                  type="number"
                  step="0.01"
                  prefix="$"
                  value={modalFields.aWireTransfer}
                  readOnly={modal.mode === 'detail'}
                  onChange={(e) => setModalFields((prev) => ({ ...prev, aWireTransfer: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Total" htmlFor="aTotal" inline>
                <Input
                  id="aTotal"
                  type="number"
                  step="0.01"
                  prefix="$"
                  value={modal.mode === 'detail' ? (modal.group.collected ?? 0) : modalTotal}
                  readOnly
                />
              </Field>
            </div>

            {modal.mode === 'collect' && (
              <div className={s.collectMeta}>
                <Field label="Manager" htmlFor="collectorId">
                  <Select
                    instanceId="money-collect-manager"
                    value={collectorUsername}
                    onChange={(value) => setCollectorUsername(value)}
                    options={[
                      { value: '', label: 'Select manager' },
                      ...(report?.managers ?? []).map((m) => ({ value: m.username, label: m.username })),
                    ]}
                  />
                </Field>
                <Field label="Date" htmlFor="gDate">
                  <Input id="gDate" type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} />
                </Field>
                <Field label="Password" htmlFor="password">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}
          </form>
        )}
      </Dialog>
    </div>
  );
}
