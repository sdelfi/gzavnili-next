// Ports `bema/messages/messages.cfc`'s `formatphone()`/`sendsms()` — the outbound SMS
// gateway used by "Send SMS" (`bema/messages/sms_add.cfm`, docs/decisions/0024-bema-send-sms.md),
// the only caller wired up so far. That screen always calls in with type "GE", so only the
// GE (smsoffice.ge) branch is exercised in practice; the US (Clickatell) branch is ported
// alongside it — `sendSms()`'s own `verifiedType` re-derivation is shared logic, not specific
// to one caller, so a future caller passing type "US" would reach it.
//
// Legacy hardcodes both gateways' API keys directly in `messages.cfc`'s source. Moving them to
// `SMS_GATEWAY_GE_KEY`/`SMS_GATEWAY_US_KEY`/`SMS_GATEWAY_US_FROM` env vars instead is a
// deliberate deviation (secrets don't belong in source control) — the request shape/URL is
// otherwise reproduced exactly. No credentials exist in this environment yet, so — same
// "degrade to logging" precedent as `src/lib/email/sendEmail.ts` — an unconfigured gateway
// logs instead of sending rather than throwing/blocking the flow.

export type SmsCountry = 'GE' | 'US';

// `formatphone()` — strip everything but digits, then normalize by expected length. Returns
// the literal number `0` (not the string `"0"`) on failure, matching legacy's own
// `<cfset tPhone = 0>` — callers must compare with `!== 0`, not falsiness, since a valid
// formatted number is always a non-empty string.
export function formatPhone(phone: string, country: SmsCountry = 'GE'): string | 0 {
  let digits = phone.replace(/\D/g, '');
  if (country === 'GE') {
    if (digits.length === 9) digits = `995${digits}`;
    return digits.length === 12 ? digits : 0;
  }
  if (digits.length === 10) digits = `+1${digits}`;
  if (digits.length === 11) digits = `+${digits}`;
  return digits.length === 12 ? digits : 0;
}

async function sendSmsGE(phone: string, message: string) {
  const key = process.env.SMS_GATEWAY_GE_KEY;
  if (!key) {
    console.log(
      `[sms-gateway:dev-fallback] No SMS_GATEWAY_GE_KEY configured — logging instead of sending.\nTo: ${phone}\n${message}`,
    );
    return;
  }
  const url = `http://smsoffice.ge/api/v2/send/?key=${key}&destination=${encodeURIComponent(phone)}&sender=Gzavnili&content=${encodeURIComponent(message)}`;
  await fetch(url);
}

async function sendSmsUS(phone: string, message: string) {
  const key = process.env.SMS_GATEWAY_US_KEY;
  const from = process.env.SMS_GATEWAY_US_FROM;
  if (!key || !from) {
    console.log(
      `[sms-gateway:dev-fallback] No SMS_GATEWAY_US_KEY/SMS_GATEWAY_US_FROM configured — logging instead of sending.\nTo: ${phone}\n${message}`,
    );
    return;
  }
  const url = `https://platform.clickatell.com/messages/http/send?apiKey=${key}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(phone)}&content=${encodeURIComponent(message)}`;
  await fetch(url);
}

// `sendsms()` — re-derives the actual gateway from the phone number itself (a 995/+995 prefix
// always forces GE, regardless of what `type` the caller passed), sends, and returns the phone
// unconditionally. Legacy never inspects the gateway HTTP call's result, so a failed/unreachable
// gateway still ends with the Messages row inserted and "successfully sent" shown to the
// operator — reproduced by swallowing gateway errors here (logged, not thrown) rather than
// letting them fail the request.
export async function sendSms(phone: string, message: string, type: SmsCountry = 'GE'): Promise<string> {
  const verifiedType: SmsCountry = phone.startsWith('995') || phone.startsWith('+995') ? 'GE' : type;

  try {
    if (verifiedType === 'US') {
      await sendSmsUS(phone, message);
    } else {
      await sendSmsGE(phone, message);
    }
  } catch (err) {
    console.error('[sms-gateway] send failed', err);
  }

  return phone;
}
