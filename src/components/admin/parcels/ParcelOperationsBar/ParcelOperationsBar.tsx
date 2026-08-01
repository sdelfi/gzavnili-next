'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/admin/Select';
import { Input } from '@/components/ui/admin/Input';
import { Button } from '@/components/ui/admin/Button';
import { DATETIME_OPERATIONS, OPERATION_OPTIONS, payMethodOptions } from '@/lib/parcels/constants';
import type { ParcelOperation } from '@/lib/parcels/constants';
import { checkParcelCode, type ParcelOperationPayload } from '@/lib/api/bema/parcels';
import s from './ParcelOperationsBar.module.css';

// The bulk-action toolbar above and below the parcels list (legacy renders it twice, with
// the same controls; once is enough). Ported from the `.opform` block and the
// `checkOperation`/`checkOperation2`/`checkOperation3` handlers in
// views/parcels/vwParcels_work2.cfm.
//
// The three conditional inputs are the whole reason those handlers existed: legacy showed and
// hid `pCode`/`awb`/`payMethod1` with jQuery on every change of the operation dropdown, then
// re-validated them on submit. Here the same rule is just what the component renders.

export type OperationRequest = Omit<ParcelOperationPayload, 'parcelIds'>;

export function ParcelOperationsBar({
  selectedCount,
  selectionDebt,
  lariRate,
  adminCountry,
  admins,
  deliveryRequest,
  busy,
  onRun,
}: {
  selectedCount: number;
  selectionDebt: number;
  lariRate: number | null;
  adminCountry: string | null;
  admins: { id: string; name: string }[];
  /** Delivery Request mode adds the "assign to this admin and send out" shortcut. */
  deliveryRequest: boolean;
  busy: boolean;
  onRun: (request: OperationRequest) => void;
}) {
  const [operation, setOperation] = useState<ParcelOperation | ''>('');
  const [operationDate, setOperationDate] = useState('');
  const [payMethod1, setPayMethod1] = useState('');
  const [pCode, setPCode] = useState('');
  const [awb, setAwb] = useState('');
  const [buser, setBuser] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wantsTime = DATETIME_OPERATIONS.has(operation);

  /** Turns the date/datetime input's local value into the ISO instant the API expects.
   *  Empty means "now", which is what legacy did when the field was left blank. */
  function toIsoDate(): string | undefined {
    if (!operationDate) return undefined;
    const parsed = new Date(operationDate);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  async function handleGo() {
    setError(null);
    if (!operation) return;
    if (selectedCount === 0) {
      setError('Select at least one parcel.');
      return;
    }
    if (operation === 'paid' && !payMethod1) {
      setError('Select payment method');
      return;
    }
    if (operation === 'awb' && !awb.trim()) {
      setError('Set AWB code');
      return;
    }
    if (operation === 'change_code') {
      if (!pCode.trim()) {
        setError('Set code');
        return;
      }
      // Codes are shared within a shipment on purpose, so a collision is a warning rather
      // than an error — exactly what legacy's `bema/ajax/checkCode.cfm` round-trip did.
      const { count } = await checkParcelCode(pCode.trim());
      if (count > 0) {
        const proceed = window.confirm(
          `The specified code already exists on ${count} parcel(s). Set it on the selected parcels anyway?`,
        );
        if (!proceed) return;
      }
    }
    if (!window.confirm('Are you sure you want to complete this operation?')) return;

    onRun({ operation, operationDate: toIsoDate(), payMethod1, pCode, awb, buser });
  }

  function handleSendOut() {
    if (selectedCount === 0) {
      setError('Select at least one parcel.');
      return;
    }
    if (!window.confirm('Are you sure you want to complete this operation?')) return;
    onRun({ operation: 'outdelivery', operationDate: toIsoDate(), buser });
  }

  return (
    <div className={s.bar}>
      <div className={s.summary}>
        <span className={s.count}>{selectedCount} selected</span>
        {selectedCount > 0 && (
          <span className={s.debt}>
            Debt: {selectionDebt.toFixed(2)}
            {lariRate ? ` (${(selectionDebt * lariRate).toFixed(2)} GEL)` : ''}
          </span>
        )}
      </div>

      <div className={s.controls}>
        {deliveryRequest && (
          <>
            <div className={s.control}>
              <Select
                instanceId="parcel-op-buser"
                size="sm"
                isSearchable
                placeholder="Assign to…"
                options={admins.map((a) => ({ value: a.id, label: a.name }))}
                value={buser}
                onChange={setBuser}
              />
            </div>
            <Button type="button" variant="secondary" disabled={busy} onClick={handleSendOut}>
              Set Out Of Delivery status
            </Button>
          </>
        )}

        <div className={s.controlWide}>
          <Select
            instanceId="parcel-operation"
            size="sm"
            options={OPERATION_OPTIONS}
            value={operation}
            onChange={(value) => setOperation(value as ParcelOperation | '')}
          />
        </div>

        {operation === 'change_code' && (
          <div className={s.control}>
            <Input placeholder="Code" value={pCode} onChange={(e) => setPCode(e.target.value)} />
          </div>
        )}

        {operation === 'awb' && (
          <div className={s.control}>
            <Input placeholder="AWB" value={awb} onChange={(e) => setAwb(e.target.value)} />
          </div>
        )}

        {operation === 'paid' && (
          <div className={s.controlWide}>
            <Select
              instanceId="parcel-op-paymethod"
              size="sm"
              options={payMethodOptions(adminCountry)}
              value={payMethod1}
              onChange={setPayMethod1}
            />
          </div>
        )}

        {operation !== '' && operation !== 'delete' && operation !== 'change_code' && operation !== 'awb' && (
          <div className={s.control}>
            {/* Legacy swapped its datepicker's format between `MM/dd/yyyy` and
                `MM/dd/yyyy hh:mm a` per operation — the milestones an operator times to the
                minute get a time part, the rest are calendar days. */}
            <Input
              type={wantsTime ? 'datetime-local' : 'date'}
              value={operationDate}
              title="Leave blank to use the current date/time"
              onChange={(e) => setOperationDate(e.target.value)}
            />
          </div>
        )}

        <Button type="button" disabled={busy || !operation} onClick={handleGo}>
          Go
        </Button>
      </div>

      {error && <span className={s.error}>{error}</span>}
    </div>
  );
}
