import type { ReactNode } from 'react';
import cn from 'classnames';
import { routes } from '@/lib/routes';
import s from './AuthLayout.module.css';

// Shared chrome for the login/register/forgot/reset page family — the `.page-heading`/
// `.breadcrumbs` banner (style.css — genuinely site-wide, every inner page uses these, so
// that CSS stays global rather than moving into this component's module) plus the
// `.container.loginpage` two-column body (AuthLayout.module.css). `aside` is optional since
// not every page in the family has the "Have a question?" side column (e.g. register.html
// never had a page-heading banner or a second column at all — out of scope until that page
// gets the same pixel-parity pass, see docs/decisions/0012-customer-auth.md).
export function AuthLayout({
  title,
  homeLabel,
  children,
  aside,
}: {
  title: string;
  homeLabel: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="accountreg">
      <div className="page-heading" style={{ background: 'url(/img/bg-contacts.jpg) 50% 50% no-repeat' }}>
        <div className="container">
          <div className="breadcrumbs">
            <a href={routes.home()}>{homeLabel}</a> <span className="sep">&gt;</span>{' '}
            <span className="current">{title}</span>
          </div>
          <h1>{title}</h1>
        </div>
      </div>

      <div className={cn('container', s.loginpage)}>
        <div className={s.row}>
          <div className={cn(s.colLoginform, s.loginform)}>
            <div className={s.inner}>{children}</div>
          </div>
          {aside && (
            <div className={s.colQuestion}>
              <div className={s.inner}>{aside}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
