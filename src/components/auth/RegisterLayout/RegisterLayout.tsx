import type { ReactNode } from 'react';

// Shared chrome for `/authenticate/register` — legacy `register.html`'s
// `.container > h1 + .row > (.col-6.col-regform, .col-6.faq)` structure. All of these
// classes (`row`/`col`/`col-6`/`col-regform`) are the site's own custom 12-unit grid,
// already global in style.css — no CSS Module needed here, unlike the login page's
// `AuthLayout` (which needed real new CSS ported). See docs/decisions/0012-customer-auth.md.
export function RegisterLayout({ title, form, faq }: { title: string; form: ReactNode; faq: ReactNode }) {
  return (
    <section className="accountreg">
      <div className="container">
        <h1>{title}</h1>
        <div className="row">
          <div className="col col-6 col-regform">{form}</div>
          {faq}
        </div>
      </div>
    </section>
  );
}
