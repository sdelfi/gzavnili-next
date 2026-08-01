import { db } from '@/lib/db';
import { runParcelOperation } from '@/lib/services/parcelOperations';
import { orNull, upsertReceiver, type ReceiverFields } from '@/lib/services/parcelShared';
import { recordParcelHistory, type ActingUser } from '@/lib/services/parcelHistory';
import { trackingNumExists } from '@/lib/services/parcelUpdate';
import type { OnlineService } from '@/lib/parcels/onlinePricing';

// bema "Add Online Parcel" — ported from `bema/parcels/parcels-online-add-2.cfm`'s POST
// handler. See docs/decisions/0022-parcels-online-add.md for the full trace.
//
// Legacy hardcodes these two usernames for its "Unknown"/"Linoli" shipper tabs (see the
// screen's own source comment: `GZ20000 - unknown`, `GZ20001 - linoli`, both by legacy MSSQL
// GUID that doesn't survive migration) — seeded by `scripts/seed-parcel-shippers.ts`.
const UNKNOWN_SHIPPER_USERNAME = 'GZ20000';
const LINOLI_SHIPPER_USERNAME = 'GZ20001';

async function resolveTripDates(service: OnlineService) {
  const config = await db.config.findUnique({ where: { id: 1 } });
  switch (service) {
    case 'Cargo':
      return {
        tripDate: config?.dtCargoShip ?? null,
        trackingEstShip: config?.dtCargoShip ?? null,
        trackingEstDelivery: config?.dtCargoEst ?? null,
      };
    case 'Express':
      return {
        tripDate: config?.dtExpressShip ?? null,
        trackingEstShip: config?.dtExpressShip ?? null,
        trackingEstDelivery: config?.dtExpressEst ?? null,
      };
    case 'Regular':
    default:
      return {
        tripDate: config?.dtRegularShip ?? null,
        trackingEstShip: config?.dtRegularShip ?? null,
        trackingEstDelivery: config?.dtRegularEst ?? null,
      };
  }
}

// The common fields both the "Update parcel" and "Insert new parcel" branches write — traced
// field-for-field against `parcel.init(...)` in both branches. `groupId` is a literal `"1"`
// in legacy, not a real group — every online-added parcel gets the same hardcoded group.
type CommonFields = {
  trackingNum: string;
  trackingNum2: string;
  service: OnlineService;
  weight: number;
  debt: number;
  length: number;
  width: number;
  high: number;
  dimWeight: number;
  notes: string;
  trackingReceivedBy: string;
};

export type UpdateOnlineParcelInput = CommonFields;

/** The "Update parcel" branch (`isDefined('form.PARCELID')`) — legacy's own comment-free
 *  reading: an "upgrade" of a tracking number the operator already scanned once. Doesn't touch
 *  the receiver, customer, notify flag, or declared-contents fields at all — those only ever
 *  get set at creation. No re-validation of the parcel's status happens here; the client's own
 *  tracking-lookup gate (`ALLOWED_FOR_UPGRADE` in the online-add API route) is legacy's only
 *  gate for reaching this branch at all. */
export async function updateOnlineParcel(parcelId: string, input: UpdateOnlineParcelInput): Promise<{ id: string }> {
  const { tripDate, trackingEstShip, trackingEstDelivery } = await resolveTripDates(input.service);

  await db.parcel.update({
    where: { id: parcelId },
    data: {
      trackingNum: input.trackingNum.trim().toUpperCase(),
      trackingNum2: orNull(input.trackingNum2.trim().toUpperCase()),
      debt: input.debt,
      notes: orNull(input.notes),
      service: input.service,
      weight: input.weight,
      trackingReceived: new Date(),
      topFlag: false,
      parcelType: 'Online',
      groupId: '1',
      length: input.length,
      width: input.width,
      high: input.high,
      dimWeight: input.dimWeight,
      tripDate,
      trackingEstShip,
      trackingReceivedBy: orNull(input.trackingReceivedBy),
      trackingEstDelivery,
    },
  });

  return { id: parcelId };
}

export type OnlineShipperTab = 'known' | 'unknown' | 'linoli';

export type CreateOnlineParcelInput = CommonFields & {
  parcelName: string;
  /** "Do not place on hold" — drives `Contents`/`Store`/`value`, legacy's
   *  `iif(form.notonhold neq 0, ...)` triplet. */
  notOnHold: boolean;
  tab: OnlineShipperTab;
  // tab === 'known'
  userId?: string;
  notify?: boolean;
  // No postal code or country field exists anywhere on this screen — country is a hidden
  // input hardcoded to `"GE"`; see the `postalCode: ''` note below.
  receiver?: Omit<ReceiverFields, 'isGeCitizen' | 'firstNameGe' | 'lastNameGe' | 'postalCode' | 'country'>;
  // tab === 'unknown'
  unknownFirstName?: string;
  unknownLastName?: string;
  // tab === 'linoli'
  linoliFirstName?: string;
  linoliLastName?: string;
  linoliUsername?: string;
};

export class TrackingNumberConflictError extends Error {}
export class MissingCustomerError extends Error {}

/** The "Insert new parcel" branch. Traced field-for-field against `parcel.init(...)` in the
 *  `else` (create) branch. */
export async function createOnlineParcel(
  input: CreateOnlineParcelInput,
  acting: ActingUser,
): Promise<{ id: string; trackingNum: string }> {
  // Legacy's own uniqueness guard here — `parcel2 = read(byTrackingnum=true); if
  // (parcel2.getTrackingnum() neq "" or (trackingNumExists(...) and not listFind(status,
  // 'awaiting,onhold,new,notonhold'))) reject`. Both `read(byTrackingnum=true)` and
  // `trackingNumExists()` run the exact same `TrackingNum = <input>` query
  // (`MSSQLParcelDAO.cfc`), so whenever the first clause is false the second's
  // `trackingNumExists` half is false too — the status allow-list after the `AND` can never be
  // the deciding factor. The real rule this reduces to: reject if *any* parcel already has
  // this tracking number, full stop, regardless of status. Reproduced as a plain existence
  // check, not a status-aware one — see docs/findings.md.
  const trackingNum = input.trackingNum.trim().toUpperCase();
  if (await trackingNumExists(trackingNum)) {
    throw new TrackingNumberConflictError();
  }

  let userId: string;
  let additionalUsername: string | null = null;
  let additionalFirstname: string | null = null;
  let additionalLastname: string | null = null;
  let bNotDeclared = false;
  let bNotify = false;

  if (input.tab === 'known') {
    if (!input.userId) throw new MissingCustomerError();
    userId = input.userId;
    bNotify = input.notify ?? false;
  } else if (input.tab === 'unknown') {
    const shipper = await db.user.findUnique({ where: { username: UNKNOWN_SHIPPER_USERNAME }, select: { id: true } });
    if (!shipper)
      throw new Error(`Placeholder shipper account "${UNKNOWN_SHIPPER_USERNAME}" not found — run bun run db:seed.`);
    userId = shipper.id;
    additionalFirstname = orNull(input.unknownFirstName ?? '');
    additionalLastname = orNull(input.unknownLastName ?? '');
    bNotDeclared = true;
  } else {
    const shipper = await db.user.findUnique({ where: { username: LINOLI_SHIPPER_USERNAME }, select: { id: true } });
    if (!shipper)
      throw new Error(`Placeholder shipper account "${LINOLI_SHIPPER_USERNAME}" not found — run bun run db:seed.`);
    userId = shipper.id;
    additionalFirstname = orNull(input.linoliFirstName ?? '');
    additionalLastname = orNull(input.linoliLastName ?? '');
    additionalUsername = orNull(input.linoliUsername ?? '');
  }

  // `Contents = iif(form.notonhold neq 0, 'Not Declared', ''); Store = same; value =
  // iif(notonhold, 0.01, 0)` — legacy's literal triplet.
  const contents = input.notOnHold ? 'Not Declared' : null;
  const store = input.notOnHold ? 'Not Declared' : null;
  const value = input.notOnHold ? 0.01 : 0;

  const { tripDate, trackingEstShip, trackingEstDelivery } = await resolveTripDates(input.service);

  const result = await db.$transaction(async (tx) => {
    // Only the Known-Shipper tab ever creates/updates a receiver — Unknown/Linoli parcels
    // have none at all, matching legacy (`parcel.setReceiver(...)` only runs inside the
    // `selectedTab eq 'tab11'` branch).
    let receiverId: string | null = null;
    if (input.tab === 'known' && input.receiver) {
      // `receiver.init(address = new Address(..., postalCode = form.postalcode, ...))` —
      // `form.postalcode` has no input anywhere on this screen, so it's always `""`. Every
      // receiver saved through this screen has its postal code wiped to blank, including an
      // *existing* receiver picked from the dropdown — a genuine legacy bug, reproduced
      // as-is. See docs/findings.md.
      receiverId = await upsertReceiver(tx, userId, {
        ...input.receiver,
        postalCode: '',
        country: 'GE',
        isGeCitizen: true, // country is hardcoded GE on this screen — see docs/decisions/0022
        firstNameGe: '',
        lastNameGe: '',
      });
    }

    const parcel = await tx.parcel.create({
      data: {
        trackingNum,
        trackingNum2: orNull(input.trackingNum2.trim().toUpperCase()),
        userId,
        receiverId,
        service: input.service,
        contents,
        store,
        value,
        debt: input.debt,
        weight: input.weight,
        parcelType: 'Online',
        parcelName: orNull(input.parcelName),
        length: input.length,
        width: input.width,
        high: input.high,
        dimWeight: input.dimWeight,
        topFlag: false,
        groupId: '1',
        notes: orNull(input.notes),
        bNotify,
        bNotDeclared,
        additionalUsername,
        additionalFirstname,
        additionalLastname,
        tripDate,
        trackingEstShip,
        trackingEstDelivery,
        trackingReceivedBy: orNull(input.trackingReceivedBy),
      },
    });

    // Legacy's `MSSQLParcelDAO.create()` opens every parcel's edit log with an 'Added' row.
    await recordParcelHistory(tx, acting, [{ parcelId: parcel.id, editStatus: 'Added', valueName: '' }]);

    return parcel;
  });

  // `parcelDao.doOperation(operation = 'received', parcelIds = parcel.getParcelId(), ...)` —
  // called *after* create, outside the transaction, same as legacy. It stamps
  // `trackingReceived` a moment after `created()`'s own `trackingreceived = Now()` did, which
  // is why the create above doesn't bother setting it at all — this call's own timestamp is
  // the one that actually survives.
  await runParcelOperation(
    { operation: 'received', parcelIds: [result.id], payMethod1: '', pCode: '', awb: '', buser: '' },
    acting,
  );

  return { id: result.id, trackingNum: result.trackingNum ?? trackingNum };
}
