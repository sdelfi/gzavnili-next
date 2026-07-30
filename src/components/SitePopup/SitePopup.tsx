import { db } from '@/lib/db';
import { SitePopupClient } from './SitePopupClient';

// Site-wide announcement popup — legacy `views/layouts/new.html`'s `.message-popup`, shown
// on every page (unless a `showpopup` cookie is already set) whenever bema's "Site Settings"
// → "Popup" section has it enabled. See docs/decisions/0014-site-popup.md for the full
// investigation, including the legacy bug this deliberately does NOT reproduce: legacy shows
// the popup whenever `ePopup = 1`, even if the message text for the visitor's language is
// blank — an admin enabling the flag with no message shows every visitor an empty popup with
// nothing but a close button. Requiring non-empty content here is the actual fix.
export async function SitePopup({ locale }: { locale: string }) {
  const config = await db.config.findUnique({ where: { id: 1 } });
  if (!config?.popupEnabled) return null;

  const message = locale === 'ge' ? config.popupMessageGe : config.popupMessageEn;
  if (!message?.trim()) return null;

  return <SitePopupClient message={message} />;
}
