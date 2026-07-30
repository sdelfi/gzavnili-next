'use client';

import { useActionState, useEffect, useState } from 'react';
import Image from 'next/image';
import cn from 'classnames';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { isOfficeOpen, type OfficeId } from '@/lib/officeHours';
import { OFFICES, setOfficeCookie } from '@/lib/offices';
import { routes } from '@/lib/routes';
import { loginAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import s from './HeaderClient.module.css';

// The interactive half of Header (dropdown toggles, office switching, tracking/login
// popovers) — reimplements what main.js used to do via jQuery. Ported from
// http/views/layouts/new.html; styling moved off that markup's original global classes
// (`.header`, `#tracking-block`, `#login-block`, ...) into HeaderClient.module.css — see
// AGENTS.md's "shared components" rule and the HomeHero precedent. `.btn`/`.input-group`
// stay global (genuinely shared across components); everything header-specific doesn't.
//
// Receives the visitor's saved office + its open/closed status already computed
// server-side (see Header.tsx) so there's no flash of the wrong office/status on load; only
// re-derives officeOpenNow client-side afterwards to keep it live across a long-open tab.
type OpenDropdown = 'language' | 'office' | 'menu' | null;

export function HeaderClient({
  initialOfficeId,
  initialOfficeOpenNow,
}: {
  initialOfficeId: OfficeId;
  initialOfficeOpenNow: boolean;
}) {
  const t = useTranslations('Header');
  const locale = useLocale();
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [officeIndex, setOfficeIndex] = useState(() =>
    Math.max(
      0,
      OFFICES.findIndex((o) => o.id === initialOfficeId),
    ),
  );
  const [officeOpenNow, setOfficeOpenNow] = useState(initialOfficeOpenNow);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginState, loginFormAction, loginPending] = useActionState<ActionState, FormData>(loginAction, undefined);

  const activeOffice = OFFICES[officeIndex];
  const otherLocale = locale === 'en' ? 'ge' : 'en';

  useEffect(() => {
    const id = setInterval(() => setOfficeOpenNow(isOfficeOpen(activeOffice.id)), 60_000);
    return () => clearInterval(id);
  }, [activeOffice.id]);

  const toggleDropdown = (which: OpenDropdown) => setOpenDropdown((current) => (current === which ? null : which));

  const selectOffice = (i: number) => {
    setOfficeIndex(i);
    setOfficeOpenNow(isOfficeOpen(OFFICES[i].id));
    setOpenDropdown(null);
    setOfficeCookie(OFFICES[i].id);
  };

  return (
    <header className={s.header}>
      <div className={s.topbar}>
        <div className="container">
          <div className={s.topbarInner}>
            <div className={cn(s.language, { [s.active]: openDropdown === 'language' })}>
              <div className={s.languageInner}>
                <span onClick={() => toggleDropdown('language')}>
                  {t(locale === 'en' ? 'languageEn' : 'languageGe')}
                </span>
                <ul>
                  <li>
                    <Link href={pathname} locale={otherLocale}>
                      {t(otherLocale === 'en' ? 'languageEn' : 'languageGe')}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className={s.topbarContacts}>
              {OFFICES.map((office, i) => (
                <div key={office.id} className={cn(s.topbarContactsItem, { [s.active]: i === officeIndex })}>
                  <div className={s.phone}>
                    <span>{t('phoneLabel')}</span> <span>{office.phone}</span>
                  </div>
                  <div className={s.mail}>
                    <a href={office.mailHref}>{office.mail}</a>
                  </div>
                  <div className={s.time}>
                    {office.hours.split(' · ').map((line) => (
                      <span key={line}>{line} </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={cn(s.office, { [s.active]: openDropdown === 'office' })}>
              <div className={s.officeInner}>
                <div className={s.curr} onClick={() => toggleDropdown('office')}>
                  <div className={s.title}>{activeOffice.name}</div>
                  <div className={s.opennow} style={{ display: officeOpenNow === true ? 'block' : 'none' }}>
                    {t('openNow')}
                  </div>
                  <div className={s.closenow} style={{ display: officeOpenNow === false ? 'block' : 'none' }}>
                    {t('closedNow')}
                  </div>
                </div>
                <ul>
                  {OFFICES.map((office, i) => (
                    <li
                      key={office.id}
                      className={cn({ [s.active]: i === officeIndex })}
                      onClick={() => selectOffice(i)}
                    >
                      {office.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.bottombar}>
        <div className={cn('container', s.container)}>
          <div className={s.logo}>
            <Link href={routes.home()}>
              <Image src="/img/logo.jpg" alt="Gzavnili, logistic company" width={190} height={80} />
            </Link>
          </div>

          <ul className={s.usermenu}>
            <li>
              <a href={routes.login()}>
                <Icon name="inbox" /> <span>{t('inbox')}</span>
              </a>
            </li>
            <li>
              <a
                href={routes.tracking()}
                onClick={(e) => {
                  e.preventDefault();
                  setTrackingOpen(true);
                }}
              >
                <Icon name="tracking" /> <span>{t('tracking')}</span>
              </a>
            </li>
            <li>
              <a
                href={routes.login()}
                onClick={(e) => {
                  e.preventDefault();
                  setLoginOpen(true);
                }}
              >
                <Icon name="login" /> <span>{t('login')}</span>
              </a>
            </li>
          </ul>

          <div className={cn(s.headermenuBlock, { [s.active]: openDropdown === 'menu' })}>
            <div className={s.headermenuToggler} onClick={() => toggleDropdown('menu')}>
              <Icon name="menu">
                <span></span>
              </Icon>{' '}
              {t('menu')}
            </div>
            <ul className={s.headermenu}>
              <li>
                <Link href={routes.home()}>
                  <span>{t('nav.home')}</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page('parcel-service')}>
                  <span>{t('nav.parcelService')}</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page('cargo')}>
                  <span>{t('nav.cargo')}</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page('courier')}>
                  <span>{t('nav.courier')}</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page('prices')}>
                  <span>{t('nav.prices')}</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page('contact')}>
                  <span>{t('nav.contact')}</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Modal open={trackingOpen} onClose={() => setTrackingOpen(false)} variant="w420">
        <div className={s.trackingBlock}>
          <h3>{t('trackingModal.title')}</h3>
          <form action={routes.tracking()} method="post">
            <div className="input-group">
              <Input type="text" name="id" placeholder={t('trackingModal.placeholder')} />
            </div>
            <button type="submit" className="btn btn-blue">
              {t('trackingModal.submit')} <Icon name="arr1" inButton />
            </button>
          </form>
        </div>
      </Modal>

      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} variant="w420">
        <div className={s.loginBlock}>
          <h3>{t('loginModal.title')}</h3>
          {loginState?.error && <Alert variant="error">{loginState.error}</Alert>}
          <form action={loginFormAction}>
            <input type="hidden" name="locale" value={locale} />
            <div className="input-group">
              <Input type="text" name="login_username" placeholder={t('loginModal.accountPlaceholder')} required />
            </div>
            <div className="input-group">
              <Input
                type="password"
                name="login_password"
                placeholder={t('loginModal.passwordPlaceholder')}
                required
              />
            </div>
            <button type="submit" className="btn btn-blue" disabled={loginPending}>
              {t('loginModal.submit')} <Icon name="arr1" inButton />
            </button>
          </form>
          <div className={s.or}>
            <span>{t('loginModal.or')}</span>
          </div>
          <p>
            <a href={routes.testAccountLogin()} className="btn btn-blue">
              {t('loginModal.temporaryAccess')} <Icon name="arr1" inButton />
            </a>
          </p>
          <p>
            {t('loginModal.newToGzavnili')} <a href={routes.register()}>{t('loginModal.createAccount')}</a>
          </p>
          <p>
            <a href={routes.forgotPassword()}>{t('loginModal.restoreAccess')}</a>
          </p>
        </div>
      </Modal>
    </header>
  );
}
