import { z } from 'zod';

// bema "Messages" (legacy `bema/messages/messages.cfm`) — see
// docs/decisions/0021-bema-messages.md. `sort`/`dir`/`active`/`grp` params legacy declares
// but never applies to the query (always ordered `dtCreate desc`, no `status` filter) are not
// exposed here — see docs/findings.md.
export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().optional(),
  chain: z.coerce.number().int().optional(),
  userId: z.string().uuid().optional(),
});

// bema "SMS list" (legacy `bema/messages/sms.cfm`) — same shared `messages` table, `isSms`
// rows only. No `chain` filter (legacy `sms.cfm` never declares one).
export const listSmsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().optional(),
  userId: z.string().uuid().optional(),
});

// bema "Send SMS" (legacy `bema/messages/sms_add.cfm`) — see
// docs/decisions/0024-bema-send-sms.md. `phone1` is the raw (unformatted) destination number;
// the route runs it through `formatPhone()` itself. `message` has no `required` counterpart in
// legacy's own form (only the readonly receiver-name field is `required`), so an empty body is
// accepted here too.
export const sendSmsSchema = z.object({
  phone1: z.string().min(1),
  message: z.string(),
});

// bema "Send Bulk SMS" (legacy `bema/messages/sms_add_bulk.cfm`) — see
// docs/decisions/0025-bema-send-bulk-sms.md. `status` is left a free string rather than a
// `ParcelStatus` enum: legacy's own dropdown includes `"paid"`, which the route resolves to
// "no candidates" rather than rejecting (see `smsBulkQueue.ts`'s `BULK_SMS_STATUS_FILTER`).
export const sendBulkSmsSchema = z.object({
  status: z.string().optional().default(''),
  country: z.enum(['GE', 'US', '']).optional().default(''),
  sendTo: z.array(z.enum(['customer', 'receiver'])).default([]),
  message: z.string(),
});

// bema "Send message" (legacy `bema/messages/message_add.cfm`) — see
// docs/decisions/0033-bema-send-message.md. Legacy's own server-side validation is limited to
// what the form's `required` HTML attributes cover (customer, message type); everything else
// (subject, body text, the tracking-number-lookup-derived fields) is accepted as-is, including
// blank.
export const composeMessageSchema = z.object({
  userId: z.string().uuid('Customer is required.'),
  parcelId: z.string().uuid().optional().nullable(),
  messageTypeKey: z.string().min(1, 'Message type is required.'),
  subject: z.string().optional().default(''),
  subjectGe: z.string().optional().default(''),
  message: z.string().optional().default(''),
  gemessage: z.string().optional().default(''),
  trackingnum: z.string().optional().default(''),
  trackingnum2: z.string().optional().default(''),
  // Legacy renders this hidden field once, server-side, at page-load time
  // (`DateFormat(Now(), "mmm-dd-yyyy")`) and submits it back unchanged — not recomputed at
  // POST time. Computed client-side here for the same reason.
  today: z.string().optional().default(''),
  firstname: z.string().optional().default(''),
  rname: z.string().optional().default(''),
  rcity: z.string().optional().default(''),
  receiverid: z.string().optional().default(''),
  senddate: z.string().optional().default(''),
  deliverydate: z.string().optional().default(''),
  servicetransit: z.string().optional().default(''),
  missinginfo: z.string().optional().default(''),
  service: z.string().optional().default(''),
});

// `message_view.cfm`'s reply POST handler has no validation at all — a blank reply is
// accepted (creates an empty-body reply row) just like legacy.
export const replyMessageSchema = z.object({
  reply: z.string().optional().default(''),
  gereply: z.string().optional().default(''),
});
