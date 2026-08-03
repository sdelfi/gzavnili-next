import { db } from '@/lib/db';
import { formatPhone, sendSms } from '@/lib/services/smsGateway';
import { dedupeSmsBatch } from '@/lib/services/smsBatch';
import { substituteTokens } from './templateTokens';
import { MAIL_TEMPLATES } from './mailTemplates';
import { SMS_TEMPLATES } from './smsTemplates';

// Ports `cron/sendMessages.cfm` — see docs/decisions/0027-cron-notifications.md for the full
// picture. Each run processes up to `OPERATIONS_COUNT` (legacy: 30) unnotified `operations`
// rows, oldest first. For each one it "supersedes" to the *latest* still-unnotified operation
// for that same parcel (marking everything in between as handled without composing anything),
// then does the same for sibling parcels in the same sender+trip+group batch that share the
// same operation name. What actually gets sent is gated by two independent one-time flags on
// the `Operation` row (`sentNotification`/`sentSms`), matching legacy's `bSentNotification`/
// `bSentSMS` — an operation can have its mail leg done and SMS leg still pending, or vice versa.

const OPERATIONS_COUNT = 30;
// Legacy `config.cfm`'s `OPERATIONS_DATESTART = '2024-05-17'` — operations older than this are
// never (re)notified, regardless of the 2-week window below.
const OPERATIONS_DATESTART = new Date('2024-05-17T00:00:00Z');
// Legacy `config.cfm`'s `sendToReceiver`/`sendToCustomer` lists — which operation names get an
// SMS to the parcel's receiver vs. its owning customer (not mutually exclusive: both lists can
// fire for the same operation, e.g. "received").
const SEND_TO_RECEIVER = ['outdelivery', 'region', 'office', 'custom', 'shipped', 'received'];
const SEND_TO_CUSTOMER = ['delivered', 'pickedup', 'missed'];
// Legacy `config.cfm`'s `SEND_SMS = 'yes'` — never observed set to 'no' anywhere in the
// accessible source; kept as a named constant for parity rather than dropped outright.
const SEND_SMS_ENABLED = true;

const ITERATION_DELAY_MS = 1500;
const SITE_BASE_URL = process.env.SITE_BASE_URL ?? 'https://usa.gzavnili.com';

// Legacy `sender_userid = 'ADC882CE-1016-3B1E-DF274792AB7330EA'`, written as every Mail-type
// Message's `sender` column. No comment/cross-reference anywhere in the accessible legacy
// source resolves it to a real account (unlike the GZ20000/GZ20001/on-hold-exemption GUIDs) —
// see docs/findings.md. Left unmapped; Mail-type inserts below always write `senderId: null`,
// the same call this project already made for SMS-type `sender` values (docs/decisions/0024).

const READY_TO_PICKUP_KEY = 'ready_to_pickup'; // legacy idmessagetype 14
const CUSTOMS_HOLD_KEY = 'parcel_customs_hold'; // legacy idmessagetype 12
const DELIVERED_KEY = 'parcel_delivered'; // legacy idmessagetype 8
const PICKED_UP_KEY = 'parcel_picked_up'; // legacy idmessagetype 16
const REGION_KEY = 'parcel_shipped_region'; // legacy idmessagetype 6

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Legacy `DateFormat(x)` — default 'mm/dd/yyyy' mask, no time component.
export function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

// Legacy `DateFormat(Now(),'yymmdd')`, used to build the tracking-preview URL.
export function formatYYMMDD(d: Date): string {
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

// Legacy `DateDiff('d', a, b)`.
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const OPERATION_INCLUDE = {
  parcel: {
    include: {
      user: { include: { billingAddress: true, notificationMessageTypes: true } },
      receiver: { include: { address: true } },
    },
  },
} as const;

type OperationWithParcel = NonNullable<Awaited<ReturnType<typeof loadOperation>>>;

async function loadOperation(id: number) {
  return db.operation.findUnique({ where: { id }, include: OPERATION_INCLUDE });
}

// Picks the single oldest still-unnotified operation, then supersedes it to the *latest*
// still-unnotified operation for the same parcel (legacy's `last_operation` query), marking
// every operation in between as handled with no message ever composed for it. Returns the id
// of the operation to actually process, or null when there's nothing left to do.
async function pickOperationId(now: Date, cutoff: Date): Promise<number | null> {
  const initial = await db.operation.findFirst({
    where: {
      operation: { not: 'estdelivery' },
      operationTime: { gt: cutoff, lt: now },
      OR: [{ sentNotification: null }, { sentSms: null }],
      parcel: { trackingReceived: { gt: cutoff } },
    },
    orderBy: { operationTime: 'asc' },
    select: { id: true, parcelId: true },
  });
  if (!initial) return null;

  const last = await db.operation.findFirst({
    where: {
      parcelId: initial.parcelId,
      id: { not: initial.id },
      operationTime: { gt: OPERATIONS_DATESTART },
      OR: [{ sentNotification: null }, { sentSms: null }],
    },
    orderBy: { operationTime: 'desc' },
    select: { id: true },
  });
  if (!last) return initial.id;

  await db.operation.updateMany({
    where: { parcelId: initial.parcelId, id: { not: last.id }, operationTime: { gt: OPERATIONS_DATESTART } },
    data: { sentNotification: true, sentSms: true },
  });
  return last.id;
}

// Sibling parcels in the same sender+trip+group batch, still unnotified for the *same*
// operation name. Legacy compares `TRIPDATE`/`GROUPID` by plain equality — a parcel with no
// group or no trip date can't match anything under that semantics (MSSQL `x = NULL` is never
// true), so those are treated as having no siblings rather than matching other null rows.
async function findSiblings(op: OperationWithParcel) {
  const parcel = op.parcel;
  if (!parcel.groupId || !parcel.tripDate) return [];
  return db.operation.findMany({
    where: {
      operation: op.operation,
      OR: [{ sentNotification: null }, { sentSms: null }],
      parcel: { groupId: parcel.groupId, userId: parcel.userId, tripDate: parcel.tripDate, id: { not: parcel.id } },
    },
    include: { parcel: { select: { trackingNum: true } } },
  });
}

export type GeSmsQueueItem = { phone: string; text: string };

export type ProcessResult = { processed: boolean; geSms: GeSmsQueueItem[] };

// Processes exactly one unit of work (one operation, possibly superseded, plus its siblings).
export async function processNextOperation(now: Date): Promise<ProcessResult> {
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const cutoff = twoWeeksAgo > OPERATIONS_DATESTART ? twoWeeksAgo : OPERATIONS_DATESTART;

  const operationId = await pickOperationId(now, cutoff);
  if (!operationId) return { processed: false, geSms: [] };

  const op = await loadOperation(operationId);
  if (!op) return { processed: false, geSms: [] };

  const siblings = await findSiblings(op);
  const siblingIds = siblings.map((s) => s.id);
  const siblingsTrackings = siblings
    .map((s) => s.parcel.trackingNum)
    .filter((t): t is string => !!t)
    .join(', ');

  const parcel = op.parcel;
  const user = parcel.user;
  const address2 = user.billingAddress;
  const receiver = parcel.receiver;
  const receiverAddress = receiver?.address;

  const messageType = await db.messageType.findUnique({ where: { operation: op.operation } });
  const opId = op.id;
  const opOperation = op.operation;
  const opSentNotification = op.sentNotification;
  const opSentSms = op.sentSms;

  const geSms: GeSmsQueueItem[] = [];
  const trackingNum = parcel.trackingNum ?? '';

  async function suppressOperation() {
    const bookkeeping = {
      sentNotification: true,
      sentSms: true,
      customerPhoneRaw: address2?.cellPhone ?? null,
      receiverPhoneRaw: receiverAddress?.cellPhone ?? null,
      sentAt: now,
      receiverIdAtSend: parcel.receiverId,
    };
    await db.operation.update({ where: { id: opId }, data: { ...bookkeeping, notifyResultCode: 1 } });
    if (siblingIds.length) {
      await db.operation.updateMany({ where: { id: { in: siblingIds } }, data: { ...bookkeeping, notifyResultCode: 20 } });
    }
  }

  // "No MessageType maps to this operation name" — legacy's own `type.recordcount eq 0` guard.
  if (!messageType) {
    await suppressOperation();
    return { processed: true, geSms: [] };
  }

  // "Ready to pickup" for a Delivery/Region-service parcel — that parcel never actually goes
  // through the Tbilisi office, so the notification is nonsensical for it. Genuinely
  // case-sensitive in legacy (`REFind('^R.*', ...)`, no case-insensitive flag) — only an
  // uppercase R/D tracking-number prefix suppresses; the SMS-blocking check further below is
  // deliberately the opposite (case-insensitive). Both are reproduced exactly as observed.
  if (messageType.key === READY_TO_PICKUP_KEY && /^[RD]/.test(trackingNum)) {
    await suppressOperation();
    return { processed: true, geSms: [] };
  }

  const usernameCut = user.username.replace('GZ', ''); // legacy `Replace(..., 'GZ', '')` — first occurrence only, no 'all'
  const trackingUrl = `${SITE_BASE_URL}/i/${formatYYMMDD(now)}/${usernameCut}/`;
  const userLanguage: 'en' | 'ge' = user.language === 'ge' ? 'ge' : 'en';

  // --- Mail leg (Message inbox row + gesubject/gemessage variant) ---
  if (opSentNotification == null) {
    const notifiesByMail =
      user.notifyViaMail && user.notificationMessageTypes.some((t) => t.key === messageType.key);
    const templates = MAIL_TEMPLATES[messageType.key];
    if (notifiesByMail && templates) {
      const trackingnum = siblingsTrackings ? `${trackingNum}, ${siblingsTrackings}` : trackingNum;
      const isDeliveredOrPickedUp = messageType.key === DELIVERED_KEY || messageType.key === PICKED_UP_KEY;

      const rname = `${receiverAddress?.firstName ?? ''} ${receiverAddress?.lastName ?? ''}`.trim();
      const commonTokens: Record<string, string> = {
        trackingnum,
        trackingUrl,
        today: formatDate(now),
        rname,
        rcity: receiverAddress?.city ?? '',
        senddate: formatDate(parcel.tripDate),
        deliverydate: formatDate(parcel.trackingEstDelivery),
        paidmessage: '',
        unpaidmessage: '',
        service: parcel.service ?? '',
      };
      // `{servicetransit}` is only substituted at all when one of these two date pairs is
      // available — otherwise the literal token is left in the sent text, matching legacy's
      // own `Replace()` call only running inside these `cfif` branches.
      if (parcel.trackingEstShip && parcel.trackingEstDelivery) {
        commonTokens.servicetransit = String(diffDays(parcel.trackingEstShip, parcel.trackingEstDelivery));
      } else if (parcel.trackingEstDelivery && parcel.tripDate) {
        commonTokens.servicetransit = String(diffDays(parcel.tripDate, parcel.trackingEstDelivery));
      }

      const enBody = substituteTokens(templates.en, {
        ...commonTokens,
        firstname: isDeliveredOrPickedUp ? (user.firstName ?? '') : (receiverAddress?.firstName ?? ''),
      });
      // GE always uses the customer's own first name — legacy's idmessagetype 8/16 branch for
      // this substitution is commented out on the GE side, a real EN/GE asymmetry.
      const geBody = substituteTokens(templates.ge, { ...commonTokens, firstname: user.firstName ?? '' });

      const created = await db.message.create({
        data: {
          userId: parcel.userId,
          parcelId: parcel.id,
          messageTypeKey: messageType.key,
          senderId: null,
          subject: messageType.label,
          subjectGe: messageType.labelGe ?? messageType.label,
          body: enBody,
          bodyGe: geBody,
          // `sendMessages.cfm`'s own INSERT writes the same substituted template into
          // `Message`/`GeMessage` and `MessageFormatted`/`GeMessageFormatted` — there's no
          // separate free-text portion for a cron-generated message the way a composed one
          // has. See docs/decisions/0033-bema-send-message.md.
          bodyFormatted: enBody,
          bodyFormattedGe: geBody,
        },
      });
      await db.message.update({ where: { id: created.id }, data: { chain: created.id } });
    }
    const targetIds = [opId, ...siblingIds];
    await db.operation.updateMany({ where: { id: { in: targetIds } }, data: { sentNotification: true } });
  }

  // --- SMS leg ---
  if (opSentSms == null || opSentSms === false) {
    let smsMessage = SMS_TEMPLATES[messageType.key]?.[userLanguage] ?? '';
    if (messageType.key === DELIVERED_KEY) {
      smsMessage = substituteTokens(smsMessage, { date: formatDate(parcel.trackingDeliveredSigned) });
    }
    if (messageType.key === REGION_KEY) {
      smsMessage = substituteTokens(smsMessage, { date: formatDate(parcel.trackingSendRegion) });
    }
    smsMessage = substituteTokens(smsMessage, { trackingUrl });

    // Case-insensitive, unlike the ready-to-pickup suppression check above — a real legacy
    // asymmetry, reproduced deliberately rather than unified.
    const firstChar = trackingNum.charAt(0).toLowerCase();
    const blockSms =
      (firstChar === 'd' && messageType.key === CUSTOMS_HOLD_KEY) ||
      ((firstChar === 'd' || firstChar === 'r') && messageType.key === READY_TO_PICKUP_KEY);

    const receiverPhoneRaw = receiverAddress?.cellPhone ?? '';
    const customerPhoneRaw = address2?.cellPhone ?? '';
    const receiverPhoneFormatted = formatPhone(receiverPhoneRaw, 'GE');

    const smstype = address2?.country === 'GE' ? 'GE' : 'US';
    const smstype2 = smstype === 'GE' ? 'US' : 'GE';
    let scountry = smstype;
    let customerPhoneFormatted = formatPhone(customerPhoneRaw, smstype);
    if (customerPhoneFormatted === 0) {
      const alt = formatPhone(customerPhoneRaw, smstype2);
      if (alt !== 0) {
        customerPhoneFormatted = alt;
        scountry = smstype2;
      }
    }

    let notifyResultCode = 30;
    if (!blockSms && smsMessage !== '' && SEND_SMS_ENABLED) {
      notifyResultCode = 40;

      if (SEND_TO_RECEIVER.includes(opOperation) && parcel.bNotify === true) {
        notifyResultCode = 3;
        if (receiverPhoneFormatted !== 0) {
          notifyResultCode = 4;
          geSms.push({ phone: receiverPhoneFormatted, text: smsMessage });
          await db.message.create({
            data: {
              userId: parcel.userId,
              parcelId: parcel.id,
              senderId: null,
              smsBody: smsMessage,
              isSms: true,
              smsTo: receiverPhoneFormatted,
            },
          });
        }
      }

      if (SEND_TO_CUSTOMER.includes(opOperation)) {
        notifyResultCode = 5;
        if (user.notifyViaSms) {
          notifyResultCode = 6;
          if (customerPhoneFormatted !== 0) {
            if (scountry === 'GE') {
              notifyResultCode = 7;
              geSms.push({ phone: customerPhoneFormatted, text: smsMessage });
            } else {
              notifyResultCode = 9;
              // Legacy sends the US-customer leg immediately, inline — unlike every GE-bound
              // leg above, which only ever gets queued for the single end-of-run flush.
              await sendSms(customerPhoneFormatted, smsMessage, 'US');
            }
            await db.message.create({
              data: {
                userId: parcel.userId,
                parcelId: parcel.id,
                senderId: null,
                smsBody: smsMessage,
                isSms: true,
                smsTo: customerPhoneFormatted,
              },
            });
          }
        }
      }
    }

    const smsBookkeeping = {
      sentSms: true,
      customerPhoneFormatted: customerPhoneFormatted === 0 ? null : customerPhoneFormatted,
      customerPhoneRaw,
      receiverPhoneFormatted: receiverPhoneFormatted === 0 ? null : receiverPhoneFormatted,
      receiverPhoneRaw,
      notifyResultCode,
      receiverIdAtSend: parcel.receiverId,
      sentAt: now,
    };
    await db.operation.updateMany({ where: { id: { in: [opId, ...siblingIds] } }, data: smsBookkeeping });
  }

  return { processed: true, geSms };
}

export type RunResult = { processedCount: number; geBatchFlushed: number };

// Runs up to `iterations` units of work, then flushes the run's accumulated GE-bound SMS
// batch exactly once at the end — matching legacy's own `GeSmsNumbers`/`GeSmsMessages` arrays,
// declared once outside the loop and only sent after it closes. Stops early once a unit finds
// nothing to do (further iterations would be identical no-ops — legacy just burns through the
// rest of its loop doing nothing, `Sleep(1500)` included; that has no observable effect worth
// reproducing here).
export async function runNotificationEngine(iterations = OPERATIONS_COUNT): Promise<RunResult> {
  const geQueue: GeSmsQueueItem[] = [];
  let processedCount = 0;

  for (let i = 0; i < iterations; i++) {
    const result = await processNextOperation(new Date());
    if (!result.processed) break;
    processedCount++;
    geQueue.push(...result.geSms);
    await sleep(ITERATION_DELAY_MS);
  }

  const groups = dedupeSmsBatch(geQueue);
  for (const group of groups) {
    await sendSms(group.phones, group.text, 'GE');
  }

  return { processedCount, geBatchFlushed: groups.length };
}
