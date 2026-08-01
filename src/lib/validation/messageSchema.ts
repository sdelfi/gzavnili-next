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
