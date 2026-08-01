// Central place for every internal href. Add a new named helper here instead of typing a
// path literal in a component — keeps renames/typos to one place and makes it obvious which
// legacy `.html` routes still exist. See AGENTS.md for the "shared/reusable" rule this follows.

// Known static marketing pages ported (or referenced) so far — extend as more are added.
export type StaticPageSlug =
  | 'parcel-service'
  | 'cargo'
  | 'courier'
  | 'prices'
  | 'contact'
  | 'faq'
  | 'faqregistration'
  | 'terms-and-conditions'
  | 'privacy-policy'
  | 'forbidden-items'
  | 'dangerous-items'
  | 'custom-clearence'
  | 'help-to-shop'
  | 'volumeweight';

export const routes = {
  home: () => '/',
  georgianHome: () => '/ge/',
  tracking: () => '/tracking.html',
  login: () => '/authenticate/login',
  logout: () => '/authenticate/logout',
  register: () => '/authenticate/register',
  forgotPassword: () => '/authenticate/forgot/',
  resetPassword: (token: string) => `/authenticate/reset?token=${encodeURIComponent(token)}`,
  testAccountLogin: () => '/authenticate/login/?testaccount=1',
  /** Any other static `<slug>.html` marketing page. */
  page: (slug: StaticPageSlug) => `/${slug}.html`,

  // bema admin panel (docs/decisions/0011-bema-admin.md) — a separate auth realm from the
  // customer-facing `routes.login()`/`routes.logout()` above, hence its own nested object
  // rather than reusing those names.
  bema: {
    login: () => '/bema/login',
    users: (params?: { accountType?: 'BemaUser' | 'Customer' }) =>
      params?.accountType ? `/bema/users?accountType=${params.accountType}` : '/bema/users',
    userNew: () => '/bema/users/new',
    userEdit: (id: string) => `/bema/users/${id}`,
    // Legacy "View Statement" icon-link (`../statements/statement.cfm?userid=...`) —
    // stubbed until the statements module is built, see PROGRESS.md.
    userStatement: (id: string) => `/bema/statements/${id}`,
    // Standalone Receivers admin screen — legacy `bema/parcels/receivers.cfm`. Distinct from
    // the parcel form's inline receiver picker, which has no route of its own.
    receivers: () => '/bema/receivers',
    receiverNew: () => '/bema/receivers/new',
    receiverEdit: (id: string) => `/bema/receivers/${id}`,
    // Parcels — legacy `bema/parcels/parcels.cfm`. `deliveryRequests()` is the same screen
    // with legacy's `delreq=1` slice applied (its own sidebar entry there too), not a
    // separate page.
    parcels: () => '/bema/parcels',
    parcelEdit: (id: string) => `/bema/parcels/${id}`,
    // Legacy `parcels-add.cfm` — the batch multi-parcel-per-customer screen, distinct from
    // `parcelEdit()`'s single-parcel form.
    parcelAdd: () => '/bema/parcels/add',
    deliveryRequests: () => '/bema/parcels?deliveryRequest=1',
    // Legacy `bema/parcels/parcels-reports.cfm` — date-range Total Sale/Payment
    // Collected/Remain Payment report, distinct from the separate "Parcels Reports 2"
    // screen (`parcelsReports2()` below).
    parcelsReports: (params?: { dateStart?: string; dateEnd?: string }) =>
      params?.dateStart && params?.dateEnd
        ? `/bema/parcels/reports?dateStart=${params.dateStart}&dateEnd=${params.dateEnd}`
        : '/bema/parcels/reports',
    // Legacy `bema/parcels/parcels-reports-2-v2.cfm` — the per-payment-event DataTables
    // report (the `-v2` suffix is the version actually linked from the sidebar; the plain
    // `parcels-reports-2.cfm` has no live link and was not ported, see docs/findings.md).
    parcelsReports2: (params?: { dateStart?: string; dateEnd?: string }) =>
      params?.dateStart && params?.dateEnd
        ? `/bema/parcels/reports-2?dateStart=${params.dateStart}&dateEnd=${params.dateEnd}`
        : '/bema/parcels/reports-2',
    // Legacy `bema/parcels/money-collect.cfm` — per-agent/per-day payment totals with a
    // password-gated "Collect Money" action, distinct from both Parcels Reports screens.
    moneyCollect: (params?: { dateStart?: string; dateEnd?: string; country?: 'us' | 'ge' }) => {
      if (!params?.dateStart || !params?.dateEnd) return '/bema/parcels/money-collect';
      const query = new URLSearchParams({ dateStart: params.dateStart, dateEnd: params.dateEnd });
      if (params.country) query.set('country', params.country);
      return `/bema/parcels/money-collect?${query.toString()}`;
    },
    // "Pricing Rules Administration" — legacy `bema/pricing_global_rules.cfm`, the
    // cross-customer counterpart to the per-customer Pricing Rules section on the customer
    // edit form (which has no route of its own — it's inline on `userEdit()`).
    pricingRules: () => '/bema/pricing-rules',
    // Site Pages CMS (docs/decisions/0013-site-pages-cms.md) — legacy `bema/content/pages.cfm`.
    pages: () => '/bema/pages',
    pageNew: () => '/bema/pages/new',
    pageEdit: (id: string) => `/bema/pages/${id}`,
    // Site Settings (docs/decisions/0014-site-popup.md) — legacy `bema/config/settings.cfm`.
    settings: () => '/bema/settings',
    // Payment Preferences (docs/decisions/0020-payment-config.md) — legacy
    // `bema/config/payment.cfm`.
    paymentConfig: () => '/bema/payment',
    // Messages / SMS list (docs/decisions/0021-bema-messages.md) — legacy
    // `bema/messages/messages.cfm` / `sms.cfm`, one shared `messages` table.
    messages: () => '/bema/messages',
    smsList: () => '/bema/sms',
  },
};
