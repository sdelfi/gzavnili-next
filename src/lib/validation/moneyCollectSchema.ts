import { z } from 'zod';

// "Money collect" — legacy `form.datestart`/`form.dateend`/`form.country` (the third a
// `<select>` with values `""`/`"us"`/`"ge"`). Dates use the same plain `yyyy-mm-dd` HTML5
// convention as the other bema report filters (see parcelReportsSchema.ts).
export const moneyCollectQuerySchema = z.object({
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Legacy submits the first option as `country=`. Treat that exactly like a missing query
  // parameter so both the UI and direct API callers can request all countries.
  country: z.preprocess((value) => (value === '' ? undefined : value), z.enum(['us', 'ge']).optional()),
});

export type MoneyCollectQuery = z.infer<typeof moneyCollectQuerySchema>;

// legacy `bema/ajax/moneyCollect.cfm` — a blank/missing password, aTotal, collectorId or cDate
// short-circuits to its "Invalid Params" response before any DB/auth work happens.
export const collectMoneySchema = z.object({
  userId: z.string().uuid(),
  cDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  aCash: z.number(),
  aCreditCard: z.number(),
  aBankDeposit: z.number(),
  aWireTransfer: z.number(),
  aTotal: z.number(),
  collectorUsername: z.string().min(1),
  gDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  password: z.string().min(1),
});

export type CollectMoneyBody = z.infer<typeof collectMoneySchema>;
