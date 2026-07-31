'use client';

import { Fragment } from 'react';
import { Button } from '@/components/ui/Button';
import { computeDraftParcelTotals } from '@/lib/parcels/batchPricing';
import type { PricingRule } from '@/lib/parcels/pricing';
import type { DraftParcelFormState } from '@/lib/parcels/batchForm';
import { trackingPrefix } from '@/components/admin/parcels/ParcelDraftFields';
import s from './ParcelDraftTable.module.css';

// The batch "Add Parcel" screen's parcels table — ported from `.parcelsItems` in
// `views/parcels/vwParcelsAdd.cfm`, with the "Group Total"/grand-total rows
// `sortParcelsTable()` inserts. Grouped by `groupId` (legacy sorts the rows themselves to
// bring a group's parcels together; grouping here achieves the same display without
// reordering what the operator sees as they add items).

const num = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function ParcelDraftTable({
  drafts,
  rules,
  onAdd,
  onEdit,
  onDuplicate,
  onRemove,
  addDisabled,
}: {
  drafts: DraftParcelFormState[];
  rules: PricingRule[];
  onAdd: () => void;
  onEdit: (clientId: string) => void;
  onDuplicate: (clientId: string) => void;
  onRemove: (clientId: string) => void;
  addDisabled: boolean;
}) {
  const calc = computeDraftParcelTotals(
    drafts.map((d) => ({ id: d.clientId, groupId: d.groupId, delivery: d.delivery, service: d.service, weight: num(d.weight) })),
    rules,
  );
  const byId = new Map(calc.items.map((i) => [i.id, i]));

  // Group ids in first-appearance order, matching the order drafts were added within each
  // group — not a further re-sort.
  const groupOrder = [...new Set(drafts.map((d) => d.groupId))];

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Button type="button" onClick={onAdd} disabled={addDisabled}>
          Add Parcel
        </Button>
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th>Receiver</th>
            <th>Phone</th>
            <th>City</th>
            <th>Group</th>
            <th>Weight</th>
            <th>Value</th>
            <th>Price</th>
            <th>Tracking #</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {drafts.length === 0 && (
            <tr>
              <td colSpan={9} className={s.empty}>
                No parcels added yet.
              </td>
            </tr>
          )}
          {groupOrder.map((groupId) => {
            const groupDrafts = drafts.filter((d) => d.groupId === groupId);
            const groupSummary = calc.groups.find((g) => g.groupId === groupId);
            return (
              <Fragment key={groupId}>
                {groupDrafts.map((draft) => (
                  <tr key={draft.clientId}>
                    <td>
                      {draft.receiver.isGeCitizen
                        ? `${draft.receiver.lastNameGe}, ${draft.receiver.firstNameGe}`
                        : `${draft.receiver.lastName}, ${draft.receiver.firstName}`}
                    </td>
                    <td>{draft.receiver.phone1}</td>
                    <td>{draft.receiver.city}</td>
                    <td>{draft.groupId}</td>
                    <td>{draft.weight}</td>
                    <td>{draft.value}</td>
                    <td>{(byId.get(draft.clientId)?.rawTotal ?? 0).toFixed(2)}</td>
                    <td>{trackingPrefix(draft.delivery, draft.service)}{draft.trackingNum.replace(trackingPrefix(draft.delivery, draft.service), '')}</td>
                    <td className={s.actions}>
                      <Button type="button" variant="secondary" onClick={() => onEdit(draft.clientId)}>
                        Edit
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => onDuplicate(draft.clientId)}>
                        Duplicate
                      </Button>
                      <Button type="button" variant="danger" onClick={() => onRemove(draft.clientId)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {groupSummary && (
                  <tr key={`${groupId}-total`} className={s.groupTotal}>
                    <td colSpan={9}>
                      <b>Group {groupId} Total:</b> {groupSummary.weight} KG · {groupSummary.amount.toFixed(2)} USD
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {drafts.length > 0 && (
        <p className={s.grandTotal}>
          <b>Total Weight:</b> {calc.grandTotal.weight} KG &nbsp; <b>Price Total:</b> {calc.grandTotal.amount.toFixed(2)} USD
        </p>
      )}
    </div>
  );
}
