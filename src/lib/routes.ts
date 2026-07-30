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
  },
};
