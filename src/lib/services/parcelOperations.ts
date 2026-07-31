import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { ParcelOperation } from '@/lib/parcels/constants';
import type { ParcelOperationInput } from '@/lib/validation/parcelSchema';

// The bema parcels list's bulk operations, ported from `MSSQLParcelDAO.doOperation()`
// (extensions/components/DAO/MSSQL/MSSQLParcelDAO.cfc:1815) and the thin
// `bema/parcels/parcels-operation.cfm` wrapper that calls it.
//
// Two pieces of the legacy implementation are deliberately not carried over, because this
// schema already does their job:
//
// * The `operations` and `ParcelHistory` audit inserts after every write. `parcels` has an
//   `AFTER INSERT OR UPDATE` trigger writing `parcel_status_history` (see the initial
//   migration), so the audit trail is maintained whether a change came from this screen, an
//   API client or a psql session — legacy only recorded the changes that happened to go
//   through this one function.
// * The 1000-id chunking loop. It existed to keep a generated `WHERE (1=2) OR ParcelId=… OR
//   …` clause under SQL Server's expression limit; a parameterised `IN` list has no such
//   problem.

/** Milestone column each "Set Status - …" operation stamps. */
const STATUS_COLUMN: Partial<Record<ParcelOperation, keyof Prisma.ParcelUpdateManyMutationInput>> = {
  custom: 'trackingCustom',
  processingCustom: 'trackingProcessingCustom',
  delay: 'trackingDelay',
  delivered: 'trackingDeliveredSigned',
  office: 'trackingOffice',
  outdelivery: 'trackingOutDelivery',
  received: 'trackingReceived',
  region: 'trackingSendRegion',
  shipped: 'trackingShipped',
  awaiting: 'trackingAway',
  estdelivery: 'trackingEstDelivery',
};

export type ParcelOperationResult = {
  operation: ParcelOperation;
  /** How many parcels the operation actually changed — not always the number selected. */
  affected: number;
  /** Ids skipped, with why, so the UI can say so instead of silently doing less. */
  skipped: { id: string; reason: string }[];
};

export async function runParcelOperation(input: ParcelOperationInput): Promise<ParcelOperationResult> {
  const { operation, parcelIds } = input;
  const operationDate = input.operationDate ? new Date(input.operationDate) : new Date();
  const skipped: ParcelOperationResult['skipped'] = [];

  if (operation === 'delete') {
    // Invoice lines and status history reference the parcel; clear them first so the delete
    // isn't rejected by the FKs. Legacy simply issued `delete from parcels` and relied on
    // the legacy DB having no such constraints.
    const result = await db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { parcelId: { in: parcelIds } } });
      await tx.parcelStatusHistory.deleteMany({ where: { parcelId: { in: parcelIds } } });
      await tx.parcelOffice.deleteMany({ where: { parcelId: { in: parcelIds } } });
      return tx.parcel.deleteMany({ where: { id: { in: parcelIds } } });
    });
    return { operation, affected: result.count, skipped };
  }

  if (operation === 'change_code') {
    // Legacy strips commas because the code travelled through a comma-delimited CF list.
    const pcode = input.pCode.replace(/,/g, '');
    const result = await db.parcel.updateMany({ where: { id: { in: parcelIds } }, data: { pcode } });
    return { operation, affected: result.count, skipped };
  }

  if (operation === 'awb') return applyAwbOperation(parcelIds, input.awb);
  if (operation === 'paid') return applyPaidOperation(parcelIds, input.payMethod1);
  if (operation === 'unpaid') return applyUnpaidOperation(parcelIds);

  const column = STATUS_COLUMN[operation];
  if (!column) return { operation, affected: 0, skipped };

  let targetIds = parcelIds;
  if (operation === 'office') {
    // A parcel held by customs must not be quietly marked "in the Tbilisi office" by a bulk
    // action — legacy filters those out of the id list before the update, and reports
    // nothing about it. Reported here.
    const held = await db.parcel.findMany({
      where: { id: { in: parcelIds }, status: 'Custom' },
      select: { id: true },
    });
    const heldIds = new Set(held.map((p) => p.id));
    targetIds = parcelIds.filter((id) => !heldIds.has(id));
    skipped.push(...held.map((p) => ({ id: p.id, reason: 'Held by customs — status not changed.' })));
  }

  const result = await db.parcel.updateMany({
    where: { id: { in: targetIds } },
    data: { [column]: operationDate },
  });

  // Delivery Request mode also records which admin took the parcels out.
  if (input.buser) {
    await db.parcel.updateMany({ where: { id: { in: targetIds } }, data: { buser: input.buser } });
  }

  return { operation, affected: result.count, skipped };
}

/** "Set AWB": stamps the code, and — when it is one of the two current trip codes in
 *  `config` — the estimated ship/delivery dates that trip carries. */
async function applyAwbOperation(parcelIds: string[], awb: string): Promise<ParcelOperationResult> {
  const config = await db.config.findUnique({ where: { id: 1 } });

  const data: Prisma.ParcelUpdateManyMutationInput = { awb };
  if (config?.regAwb && config.regAwb === awb) {
    data.trackingEstShip = config.dtRegularShip;
    data.tripDate = config.dtRegularShip;
    data.trackingEstDelivery = config.dtRegularEst;
  } else if (config?.expAwb && config.expAwb === awb) {
    data.trackingEstShip = config.dtExpressShip;
    data.tripDate = config.dtExpressShip;
    data.trackingEstDelivery = config.dtExpressEst;
  }

  const result = await db.parcel.updateMany({ where: { id: { in: parcelIds } }, data });
  return { operation: 'awb', affected: result.count, skipped: [] };
}

/** "Set Status - Paid": for each not-yet-invoiced parcel, raise a one-line invoice for its
 *  debt and record a matching payment. `is_paid`/`is_invoiced`/`invoice_id` and the sender's
 *  balance then follow from the invoice/payment triggers — legacy wrote all of those by hand
 *  and could leave them inconsistent if the request died halfway. */
async function applyPaidOperation(parcelIds: string[], payMethod1: string): Promise<ParcelOperationResult> {
  const parcels = await db.parcel.findMany({
    where: { id: { in: parcelIds } },
    select: { id: true, userId: true, debt: true, payAmount2: true, isPaid: true },
  });

  const skipped: ParcelOperationResult['skipped'] = [];
  let affected = 0;

  for (const parcel of parcels) {
    if (parcel.isPaid) {
      skipped.push({ id: parcel.id, reason: 'Already paid.' });
      continue;
    }

    // A partial payment already taken (`payAmount2`) is deducted from what is charged now.
    const debt = Number(parcel.debt ?? 0);
    const partial = Number(parcel.payAmount2 ?? 0);
    const amount = partial > 0 ? debt - partial : debt;

    // One timestamp for both records, so `unpaid` can find the payment that belongs to the
    // invoice again — this schema has no transaction-id link between the two the way legacy
    // did.
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.invoice.create({
        data: {
          userId: parcel.userId,
          invoiceDate: now,
          items: { create: [{ parcelId: parcel.id, amount }] },
        },
      });
      await tx.payment.create({
        data: { userId: parcel.userId, paymentDate: now, amount, paymentMethodId: payMethod1 },
      });
      // `isPaid`/`isInvoiced`/`invoiceId`/`invoiceAmount` are all trigger-maintained off the
      // invoice above — never written here, per the schema's own note on those columns.
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { bPaidDelivery: true, payMethod1, payAmount1: amount },
      });
    });
    affected += 1;
  }

  return { operation: 'paid', affected, skipped };
}

/** Reverses `paid`: drops this parcel's invoice line, and the whole invoice plus its payment
 *  when it was the only line on it. */
async function applyUnpaidOperation(parcelIds: string[]): Promise<ParcelOperationResult> {
  let affected = 0;

  for (const parcelId of parcelIds) {
    const items = await db.invoiceItem.findMany({ where: { parcelId }, select: { invoiceId: true } });
    if (items.length === 0) continue;

    await db.$transaction(async (tx) => {
      for (const { invoiceId } of items) {
        const siblings = await tx.invoiceItem.count({ where: { invoiceId } });
        await tx.invoiceItem.deleteMany({ where: { invoiceId, parcelId } });
        if (siblings <= 1) {
          const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            select: { userId: true, invoiceDate: true },
          });
          await tx.invoice.delete({ where: { id: invoiceId } });
          // Legacy matched the payment by the invoice's transaction id; this schema has no
          // such link, so the payment raised alongside the invoice is matched by owner and
          // timestamp instead.
          if (invoice) {
            await tx.payment.deleteMany({ where: { userId: invoice.userId, paymentDate: invoice.invoiceDate } });
          }
        }
      }
      await tx.parcel.update({
        where: { id: parcelId },
        data: { bPaidDelivery: false, payMethod1: null, payAmount1: null, payMethod2: null, payAmount2: null },
      });
    });
    affected += 1;
  }

  return { operation: 'unpaid', affected, skipped: [] };
}
