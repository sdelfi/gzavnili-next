import { Calculator } from '@/components/Calculator';
import { QuoteForm } from '@/components/QuoteForm';
import { QuestionForm } from '@/components/QuestionForm';
import { SlotPortal } from './SlotPortal';
import { CmsFaqAccordion } from './CmsFaqAccordion';
import { CALCULATOR_SLOT_ATTR, QUOTE_FORM_SLOT_ATTR, QUESTION_FORM_SLOT_ATTR, CMS_CONTENT_ATTR } from './constants';

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
// `{CALCULATOR}`/`{QUOTEFORM}`/`{QUESTIONFORM}` are wired up (to Calculator/QuoteForm/
// QuestionForm) since they're the ones confirmed in real content and have an existing React
// port. `{COURIERCALC_FORM}`/`{HELPTOSHOP}`/`{VOLUMECAL}` are left as literal, visible
// placeholder text rather than silently stripped — flagged in
// docs/decisions/0013-site-pages-cms.md as a known gap — until each of their source
// sub-templates gets its own React port.
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

export function PageContent({ content, locale }: { content: string; locale: string }) {
  const now = new Date();
  const [sendOffset, delOffset] = NEXT_SHIP_OFFSETS[now.getDay()];
  const hasCalculator = content.includes('{CALCULATOR}');
  const hasQuoteForm = content.includes('{QUOTEFORM}');
  const hasQuestionForm = content.includes('{QUESTIONFORM}');
  const hasFaqAccordion = content.includes('faq-item');

  const html = content
    // The browser's HTML parser normalizes `\r\n`/`\r` to `\n` while parsing the initial
    // server-rendered document (an HTML5 spec step, not a React thing) — invisible as long as
    // nothing on the page ever hydrates this content against the original string. Once *any*
    // client component shares this tree (e.g. CmsFaqAccordion below, or a SlotPortal), React
    // starts comparing this node's markup for hydration and sees a mismatch, since the raw DB
    // content (imported verbatim, CRLF and all — see docs/decisions/0013-site-pages-cms.md)
    // still has `\r\n`. Normalizing here keeps the string identical to what the browser will
    // have already normalized it to.
    .replace(/\r\n?/g, '\n')
    .replaceAll('{NEXTSEND}', formatMonthDay(addDays(now, sendOffset)))
    .replaceAll('{NEXTDEL}', formatMonthDay(addDays(now, delOffset)))
    // Inert marker elements, not JSX split points — keeps the surrounding (possibly still-
    // open) parent tags intact across a single HTML parse. See SlotPortal.tsx.
    .replaceAll('{CALCULATOR}', `<div ${CALCULATOR_SLOT_ATTR}></div>`)
    .replaceAll('{QUOTEFORM}', `<div ${QUOTE_FORM_SLOT_ATTR}></div>`)
    .replaceAll('{QUESTIONFORM}', `<div ${QUESTION_FORM_SLOT_ATTR}></div>`);

  return (
    <>
      {/* Admin-authored CMS content — same trust boundary as the legacy WYSIWYG output, not user input. */}
      <div {...{ [CMS_CONTENT_ATTR]: '' }} dangerouslySetInnerHTML={{ __html: html }} />
      {hasFaqAccordion && <CmsFaqAccordion />}
      {hasCalculator && (
        <SlotPortal slotAttr={CALCULATOR_SLOT_ATTR}>
          <Calculator />
        </SlotPortal>
      )}
      {hasQuoteForm && (
        <SlotPortal slotAttr={QUOTE_FORM_SLOT_ATTR}>
          <QuoteForm locale={locale} />
        </SlotPortal>
      )}
      {hasQuestionForm && (
        <SlotPortal slotAttr={QUESTION_FORM_SLOT_ATTR}>
          <QuestionForm locale={locale} />
        </SlotPortal>
      )}
    </>
  );
}
