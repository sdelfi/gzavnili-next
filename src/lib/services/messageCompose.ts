import { db } from '@/lib/db';
import { MAIL_TEMPLATES } from '@/lib/notifications/mailTemplates';
import { substituteTokens } from '@/lib/notifications/templateTokens';

// Ports `bema/messages/message_add.cfm` (compose) and `message_view.cfm`'s reply POST
// handler — see docs/decisions/0033-bema-send-message.md. Legacy runs no database lookups of
// its own here: every token value (`trackingnum`, `firstname`, `rname`, `service`, ...) is
// already resolved client-side (by `messages-add.js`'s tracking-number/customer AJAX lookups)
// and submitted as plain form fields, so this reproduces the same shape — a pure
// substitute-and-insert, not a re-lookup.

export type ComposeMessageInput = {
  userId: string;
  parcelId?: string | null;
  messageTypeKey: string;
  senderId: string;
  subject: string;
  subjectGe: string;
  /** The composer's own free-text body, appended after the template — not itself a token. */
  message: string;
  gemessage: string;
  tokens: {
    trackingnum: string;
    firstname: string;
    today: string;
    rname: string;
    rcity: string;
    receiverid: string;
    senddate: string;
    deliverydate: string;
    servicetransit: string;
    missinginfo: string;
    service: string;
  };
};

/** Legacy's `{service}` token is `"#form.service# service"` when non-blank, else `""` — not
 *  the raw service name. */
function serviceToken(service: string): string {
  return service ? `${service} service` : '';
}

export async function composeMessage(input: ComposeMessageInput): Promise<number> {
  const templates = MAIL_TEMPLATES[input.messageTypeKey];
  // `{paidmessage}`/`{unpaidmessage}` are always blank — legacy's own `form.paidmessage`/
  // `form.unpaidmessage` inputs are commented out of the visible form (see the decision doc),
  // so `form.paidmessage` is always `""`. Still substituted (removing the literal token text
  // from any template that contains it), not left un-replaced.
  const tokenValues = {
    ...input.tokens,
    service: serviceToken(input.tokens.service),
    paidmessage: '',
    unpaidmessage: '',
  };

  // Legacy: `template & "<p>" & form.message & "</p>"` — the free-text body is appended
  // literally after substitution, not substituted as a `{message}` token itself (that's only
  // how the *client-side preview* treats it, for live-typing convenience).
  const bodyFormatted = `${templates ? substituteTokens(templates.en, tokenValues) : ''}<p>${input.message}</p>`;
  const bodyFormattedGe = `${templates ? substituteTokens(templates.ge, tokenValues) : ''}<p>${input.gemessage}</p>`;

  const created = await db.message.create({
    data: {
      userId: input.userId,
      parcelId: input.parcelId || null,
      messageTypeKey: input.messageTypeKey,
      senderId: input.senderId,
      subject: input.subject,
      subjectGe: input.subjectGe,
      body: input.message,
      bodyGe: input.gemessage,
      bodyFormatted,
      bodyFormattedGe,
    },
  });
  // Legacy: a freshly-composed message always self-chains (`UPDATE messages SET chain =
  // @@IDENTITY WHERE messageid = @@IDENTITY`), a second statement after the INSERT rather
  // than a `chain` value known at insert time.
  await db.message.update({ where: { id: created.id }, data: { chain: created.id } });
  return created.id;
}

export type ReplyToMessageInput = {
  reply: string;
  gereply: string;
};

/** Legacy idmessagetype 15, "Other" — hardcoded for every reply, matching
 *  `MSSQLEmailDAO`-style fixed ids used elsewhere in this port. */
const REPLY_MESSAGE_TYPE_KEY = 'other';

export async function replyToMessage(originalId: number, input: ReplyToMessageInput): Promise<number> {
  const original = await db.message.findUniqueOrThrow({ where: { id: originalId } });

  const created = await db.message.create({
    data: {
      // Legacy's literal `INSERT` reuses the *original* message's own `UserID`/`sender` --
      // the reply is not addressed back to whoever it's replying to, a real (if surprising)
      // legacy quirk reproduced as-is. See docs/findings.md.
      userId: original.userId,
      senderId: original.senderId,
      parcelId: original.parcelId,
      messageTypeKey: REPLY_MESSAGE_TYPE_KEY,
      replyToId: original.id,
      subject: `RE: ${original.subject ?? ''}`,
      subjectGe: `RE: ${original.subjectGe ?? ''}`,
      // No template substitution for a reply -- legacy's own INSERT writes the raw
      // `form.reply`/`form.gereply` into all four body columns unchanged.
      body: input.reply,
      bodyGe: input.gereply,
      bodyFormatted: input.reply,
      bodyFormattedGe: input.gereply,
      // Inherits the thread's existing chain (falling back to the original's own id if it
      // was blank) rather than starting a new one, unlike a freshly-composed message.
      chain: original.chain ?? original.id,
    },
  });
  return created.id;
}
