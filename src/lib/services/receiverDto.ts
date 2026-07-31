import type { Address, Receiver } from '@/generated/prisma/client';
import { PHONE1, PHONE2, PHONE3 } from '@/lib/services/parcelQuery';

type ReceiverRow = Receiver & {
  address: Address;
  user?: { id: string; username: string; firstName: string | null; lastName: string | null } | null;
};

// Shared shape returned by every /api/bema/receivers* endpoint — the parcel form's picker
// (`GET /api/bema/receivers?userId=`), the standalone Receivers list, and the single-receiver
// get/create/update responses all serialize a `Receiver & { address, user? }` row the same
// way, so the shape only has to be reasoned about once.
export function toReceiverDTO(row: ReceiverRow) {
  return {
    id: row.id,
    userId: row.userId,
    active: row.active,
    isGeCitizen: row.isGeCitizen,
    customerLabel: row.user
      ? `${row.user.lastName ?? ''}, ${row.user.firstName ?? ''} / ${row.user.username}`
      : '',
    label:
      [row.address.lastName, row.address.firstName].filter(Boolean).join(', ') ||
      [row.address.lastNameGe, row.address.firstNameGe].filter(Boolean).join(', ') ||
      '(no name)',
    address: {
      firstName: row.address.firstName ?? '',
      lastName: row.address.lastName ?? '',
      firstNameGe: row.address.firstNameGe ?? '',
      lastNameGe: row.address.lastNameGe ?? '',
      organization: row.address.organization ?? '',
      country: row.address.country ?? '',
      street1: row.address.street1 ?? '',
      street2: row.address.street2 ?? '',
      city: row.address.city ?? '',
      state: row.address.state ?? '',
      postalCode: row.address.postalCode ?? '',
      phone1: row.address[PHONE1] ?? '',
      phone2: row.address[PHONE2] ?? '',
      phone3: row.address[PHONE3] ?? '',
    },
  };
}
