import { db } from '@/lib/db';
import { runParcelOperation } from '@/lib/services/parcelOperations';
import type { ActingUser } from '@/lib/services/parcelHistory';
import type { ParcelOperation } from '@/lib/parcels/constants';
import { CLEAR_OFFICE } from '@/lib/validation/parcelChangeStatusSchema';

// bema "Change Parcel status" (`bema/parcels/parcels-change-status.cfm`) — see
// docs/decisions/0023-parcels-change-status.md. Three independent writes, each gated on its
// own field being non-blank, exactly as legacy's POST handler has them — not one combined
// "update" the way the parcel edit form is.

export type ChangeStatusInput = {
  parcelId: string;
  /** '' means "no status change requested" — legacy's own `if (form.operation neq "")` gate. */
  operation: ParcelOperation | '';
  /** '' means no change; `CLEAR_OFFICE` clears the assignment (legacy's magic `officeid=998`,
   *  which never round-trips as a real office id here — see the CLEAR_OFFICE doc comment). */
  officeId: string;
  /** A bema user id — only ever written together with `iLocation`, see below. */
  buser: string;
  /** Free-text location. When non-blank, legacy writes *both* this and `buser` in the same
   *  `parcel.init(buser=..., Location=...)` call — meaning a Bema User selection with no
   *  Location typed is silently discarded and never saved. Reproduced as-is: `buser` is only
   *  written here, gated on `iLocation`, not on its own. */
  iLocation: string;
};

export async function applyParcelStatusChange(input: ChangeStatusInput, acting: ActingUser): Promise<void> {
  if (input.operation) {
    // `doOperation('paid')` with no payment method is a real, reachable path from this screen
    // (there's no payment-method field here at all) — `applyPaidOperation` still invoices the
    // parcel, just leaves `payMethod1`/`payAmount1` untouched, matching legacy's own
    // conditional SQL. See the fix in `parcelOperations.ts` and docs/findings.md.
    await runParcelOperation(
      { operation: input.operation, parcelIds: [input.parcelId], payMethod1: '', pCode: '', awb: '', buser: '' },
      acting,
    );
  }

  if (input.officeId) {
    await db.parcelOffice.deleteMany({ where: { parcelId: input.parcelId } });
    if (input.officeId !== CLEAR_OFFICE) {
      await db.parcelOffice.create({ data: { parcelId: input.parcelId, officeId: input.officeId } });
    }
  }

  if (input.iLocation) {
    await db.parcel.update({
      where: { id: input.parcelId },
      data: { location: input.iLocation, buser: input.buser || null },
    });
  }
}
