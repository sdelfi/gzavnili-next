import { CalculatorPortal } from './CalculatorPortal';
import { CALCULATOR_SLOT_ATTR } from './constants';

// Legacy Site Pages content isn't always plain HTML — `views/layouts/new.html` (the shared
// page layout, wrapping every rendered view, not just specific controllers) substitutes a
// handful of `{TOKEN}` placeholders into `request.pageContent` before output, each backed by
// its own CFML sub-template: `{CALCULATOR}` → `homecals.cfm`, `{COURIERCALC_FORM}` →
// `couriercalc_form.cfm`, `{QUESTIONFORM}`/`{QUOTEFORM}` → `question_form.cfm`/
// `quote_form.cfm`, `{HELPTOSHOP}` → `helpshop.cfm`, `{VOLUMECAL}` → `volumecals.cfm`, plus
// two plain date tokens (`{NEXTSEND}`/`{NEXTDEL}`, the next available ship/pickup dates,
// computed from `dayofweek(now())`). This is a *different* mechanism from the
// `{form}`/`{form_quotation}`/etc. substitution in the 5 hardcoded controllers
// (contact/pick-up-service/help-to-shop/quotation/mailing-list, see
// docs/decisions/0013-site-pages-cms.md) — this one runs on *any* CMS page's content.
//
// Only `{CALCULATOR}` is wired up (to the already-ported `Calculator` component) since it's
// the one confirmed in real content (`/parcel-service.html`) and the only one with an
// existing React port. The rest are left as literal, visible placeholder text rather than
// silently stripped — flagged in docs/decisions/0013-site-pages-cms.md as a known gap —
// until each of their source sub-templates gets its own React port.
const NEXT_SHIP_OFFSETS: Record<number, [send: number, del: number]> = {
  0: [1, 3], // Sunday
  1: [0, 2], // Monday
  2: [1, 3], // Tuesday
  3: [0, 2], // Wednesday
  4: [2, 4], // Thursday
  5: [1, 3], // Friday
  6: [0, 2], // Saturday
};

function formatMonthDay(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function PageContent({ content }: { content: string }) {
  const now = new Date();
  const [sendOffset, delOffset] = NEXT_SHIP_OFFSETS[now.getDay()];
  const hasCalculator = content.includes('{CALCULATOR}');

  const html = content
    .replaceAll('{NEXTSEND}', formatMonthDay(addDays(now, sendOffset)))
    .replaceAll('{NEXTDEL}', formatMonthDay(addDays(now, delOffset)))
    // An inert marker element, not a JSX split point — keeps the surrounding (possibly
    // still-open) parent tags intact across a single HTML parse. See CalculatorPortal.tsx.
    .replaceAll('{CALCULATOR}', `<div ${CALCULATOR_SLOT_ATTR}></div>`);

  return (
    <>
      {/* Admin-authored CMS content — same trust boundary as the legacy WYSIWYG output, not user input. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {hasCalculator && <CalculatorPortal />}
    </>
  );
}
