import { db } from '@/lib/db';
import { formatPhone, sendSms } from '@/lib/services/smsGateway';
import { substituteTokens } from '@/lib/notifications/templateTokens';

// Ports `cron/sendCustomerSMS.cfm` — a "view your parcels received today" SMS, gated per
// sender+trip-group by `Parcel.bCustomerSms` (docs/decisions/0027-cron-notifications.md).
//
// Legacy's own query is `SELECT TOP 1 ...` **unconditionally** — the `TOP 4` variant only
// applies to a debug/manual invocation path (`url.fromParcelsAdd`, driven by a `url.parcelid`
// query param) that's never reachable from the real scheduled URL hit (no query string). So
// the real batch behavior is: **one eligible parcel per run**, relying on the job's own
// 120-second interval to drain the backlog over time — not a full-batch sweep. That debug
// path (and the in-loop `urlAlready`/re-check dance it exists to support across >1 row) is
// dead in this job's only real invocation and isn't reproduced here.
const MESSAGE_GE = 'ნახეთ აქ {trackingUrl} {date} ის ამანათები';
const MESSAGE_US = 'Click here {trackingUrl} to view parcels received at {date}';

const SITE_BASE_URL = process.env.SITE_BASE_URL ?? 'https://usa.gzavnili.com';

function formatYYMMDD(d: Date): string {
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function formatDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

export async function runCustomerReceivedSmsSweep(): Promise<string> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const alreadyNotifiedToday = await db.parcel.findMany({
    where: {
      trackingReceived: { gte: todayStart, lt: tomorrowStart },
      bCustomerSms: true,
      user: { billingAddress: { country: 'US' }, notifyViaSms: true },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const candidate = await db.parcel.findFirst({
    where: {
      trackingReceived: { gte: todayStart, lt: tomorrowStart },
      bCustomerSms: false,
      user: {
        billingAddress: { country: 'US' },
        notifyViaSms: true,
        id: { notIn: alreadyNotifiedToday.map((p) => p.userId) },
      },
    },
    include: { user: { include: { billingAddress: true } }, receiver: { include: { address: true } } },
  });

  if (!candidate) return 'no eligible parcel';

  const user = candidate.user;
  const billingAddress = user.billingAddress;
  const city = candidate.receiver?.address?.city ?? '';
  const usernameCut = user.username.replace('GZ', ''); // legacy `Replace()` — first occurrence only
  const trackingUrl = `${SITE_BASE_URL}/i/${formatYYMMDD(now)}/${usernameCut}/G${candidate.groupId ?? ''}/${city.charAt(0)}`;

  let addToDb = false;
  let message = '';
  let formatted: string | 0 = 0;
  const phone = billingAddress?.cellPhone ?? '';

  if (billingAddress?.country === 'GE') {
    formatted = formatPhone(phone, 'GE');
    if (formatted !== 0) {
      addToDb = true;
      message = substituteTokens(MESSAGE_GE, { trackingUrl, date: formatDate(now) });
      // Legacy's own `sendsms` call for this branch is commented out — a Messages row is
      // created but no gateway call is ever made for a GE-billed customer here. Reproduced
      // as observed rather than "fixed" — see docs/findings.md.
    }
  } else if (billingAddress?.country === 'US') {
    formatted = formatPhone(phone, 'US');
    if (formatted !== 0) {
      addToDb = true;
      const template = user.language === 'ge' ? MESSAGE_GE : MESSAGE_US;
      message = substituteTokens(template, { trackingUrl, date: formatDate(now) });
      await sendSms(formatted, message, 'US');
    }
  }

  if (addToDb) {
    await db.message.create({
      data: {
        userId: candidate.userId,
        parcelId: null, // legacy inserts a literal SQL `NULL` for `ParcelID` here, unlike every sibling job
        senderId: null,
        smsBody: message,
        isSms: true,
        smsTo: formatted as string,
      },
    });
  }

  // Legacy runs this exact UPDATE unconditionally for every row it loops — reachable here for
  // the one row this job ever processes per run, whether or not a message was actually sent.
  await db.parcel.updateMany({
    where: { userId: candidate.userId, groupId: candidate.groupId },
    data: { bCustomerSms: true },
  });

  return addToDb ? `messaged user ${candidate.userId}` : `marked user ${candidate.userId} handled, no message sent`;
}
