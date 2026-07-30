import { z } from 'zod';

// Only the "Popup" slice of legacy bema's `settings.cfm`/`vwSettings.cfm` mega-form is
// modeled here — see docs/decisions/0014-site-popup.md. The rest (Airway Bill/Date,
// Regular/Express/Cargo Services dates+AWB, Lari Rate, parcel pricing) belongs to the
// not-yet-built parcels domain and is deliberately out of scope for this change.
export const popupConfigSchema = z.object({
  popupEnabled: z.boolean(),
  popupMessageEn: z.string().max(2000).nullable().optional(),
  popupMessageGe: z.string().max(2000).nullable().optional(),
});
