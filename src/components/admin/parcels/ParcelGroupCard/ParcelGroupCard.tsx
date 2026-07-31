'use client';

import Link from 'next/link';
import cn from 'classnames';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ParcelRow } from '@/components/admin/parcels/ParcelRow';
import { payMethodOptions } from '@/lib/parcels/constants';
import { formatDate } from '@/lib/parcels/format';
import { routes } from '@/lib/routes';
import type { ParcelGroup } from '@/lib/parcels/types';
import { useState } from 'react';
import s from './ParcelGroupCard.module.css';

// One shipment card: everything a sender booked onto one trip, with the shipment-level
// header actions above the rows. Ported from the `<div class="parcel">` block in
// views/parcels/vwParcels_work2.cfm.
//
// The header's own numbers are shipment-level, not per-parcel: `Balance` is the sender's
// account balance, and `Group Debt` the total still owed on this shipment. Legacy computed
// the latter as `ArraySum(parcels['debt'])` guarded by whether the *first* row happened to be
// paid — so a shipment with one settled parcel showed no total at all. Summed over the
// unpaid rows here instead, which is the figure the label claims.

export function ParcelGroupCard({
  group,
  selectedIds,
  onToggleParcel,
  onToggleGroup,
  onDeleteParcel,
  onConfirmHold,
  onGroupPay,
  lariRate,
  adminCountry,
  canOperate,
  returnTo,
  showBuser,
}: {
  group: ParcelGroup;
  selectedIds: ReadonlySet<string>;
  onToggleParcel: (parcelId: string, selected: boolean) => void;
  onToggleGroup: (parcelIds: string[], selected: boolean) => void;
  onDeleteParcel: (parcelId: string) => void;
  onConfirmHold: (parcelId: string) => void;
  onGroupPay: (parcelIds: string[], payMethod: string) => void;
  lariRate: number | null;
  adminCountry: string | null;
  canOperate: boolean;
  /** Passed down to each row's Edit link so the edit screen can come back here. */
  returnTo: string;
  showBuser: boolean;
}) {
  const [groupPayMethod, setGroupPayMethod] = useState('');

  const ids = group.parcels.map((p) => p.id);
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedCount === ids.length;

  const groupDebt = group.parcels.reduce((total, p) => (p.isPaid ? total : total + (p.debt ?? 0)), 0);
  const senderName = [group.user.firstName, group.user.lastName].filter(Boolean).join(' ');

  const columnCount = showBuser ? 11 : 10;

  return (
    <div className={cn(s.card, { [s.pinned]: group.topFlag })}>
      <table className={s.table}>
        <thead>
          <tr className={s.headerRow}>
            <th colSpan={3} className={s.senderCell}>
              <span className={s.sender}>
                {senderName} — {group.user.username}
              </span>
              {group.tripDate && <span className={s.meta}> — {formatDate(group.tripDate)}</span>}
              <div className={s.meta}>
                Balance: ${group.user.balance.toFixed(2)}
                {groupDebt > 0 && <> · Group Debt: {groupDebt.toFixed(2)}</>}
              </div>
            </th>

            <th colSpan={3} className={s.serviceCell}>
              <span className={cn(s.service, group.service === 'Regular' ? s.regular : s.express)}>
                Service: {group.service}
              </span>
              {group.awb && <span className={s.meta}> AWB: {group.awb}</span>}
            </th>

            <th colSpan={columnCount - 6} className={s.headerActions}>
              {canOperate && (
                <span className={s.groupPay}>
                  <div className={s.groupPaySelect}>
                    <Select
                      instanceId={`group-pay-${group.key}`}
                      size="sm"
                      options={payMethodOptions(adminCountry)}
                      placeholder="Pay method*"
                      value={groupPayMethod}
                      onChange={setGroupPayMethod}
                    />
                  </div>
                  {/* Legacy's "Group pay" first ticks every row in the card if none are
                      ticked, then runs the paid operation over them — one click to settle a
                      whole shipment. Same here, without the checkbox round-trip. */}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!groupPayMethod}
                    onClick={() => onGroupPay(ids, groupPayMethod)}
                  >
                    Group pay
                  </Button>
                </span>
              )}

              {group.pcode && <span className={s.code}>Code — {group.pcode}</span>}

              <Link className={s.headerLink} href={routes.bema.userEdit(group.user.id)} target="_blank">
                Customer info
              </Link>
              <Link
                className={s.headerLink}
                href={`${routes.bema.parcels()}?sender=${encodeURIComponent(group.user.username)}`}
                target="_blank"
              >
                All parcels
              </Link>
            </th>
          </tr>

          <tr className={s.columnRow}>
            <th className={s.center}>
              <Checkbox
                checked={allSelected && ids.length > 0}
                indeterminate={selectedCount > 0 && !allSelected}
                onChange={(e) => onToggleGroup(ids, e.target.checked)}
                aria-label="Select all parcels in this shipment"
              />
            </th>
            <th className={s.center}>Grp</th>
            <th className={s.colTracking}>Tracking #</th>
            <th className={s.colSpecs}>Specifications</th>
            <th className={s.colDebt}>Debt</th>
            <th className={s.colReceiver}>Receiver</th>
            <th className={s.colTimeline}>Tracking</th>
            <th className={s.colContent}>Parcel Content</th>
            <th className={s.colNote}>Note</th>
            {showBuser && <th className={s.colNote}>Buser</th>}
            <th className={s.colActions}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {group.parcels.map((parcel, index) => (
            <ParcelRow
              key={parcel.id}
              parcel={parcel}
              index={index}
              selected={selectedIds.has(parcel.id)}
              onToggle={(selected) => onToggleParcel(parcel.id, selected)}
              onDelete={() => onDeleteParcel(parcel.id)}
              onConfirmHold={() => onConfirmHold(parcel.id)}
              lariRate={lariRate}
              returnTo={returnTo}
              showBuser={showBuser}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
