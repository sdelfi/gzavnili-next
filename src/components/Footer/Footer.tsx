import { getTranslations } from 'next-intl/server';
import cn from 'classnames';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/Input';
import { routes } from '@/lib/routes';
import s from './Footer.module.css';

// Ported from the legacy layout at http/views/layouts/new.html.
export async function Footer() {
  const year = new Date().getFullYear();
  const t = await getTranslations('Footer');

  return (
    <footer className={s.footer}>
      <div className="container">
        <div className={s.footerL}>
          <div className={s.footerLt}>
            <div className={s.logo}>
              {/* text-indent hides the label; style.css draws the real logo via an icons.png
                  sprite background — same technique as Modal.tsx's close icon. */}
              <Link href={routes.home()}>Gzavnili</Link>
            </div>
            <ul className={s.social}>
              <li className={s.socialFb}>
                <a href="https://www.facebook.com/gzavnili">Facebook</a>
              </li>
            </ul>
          </div>
          <div className={s.txt}>{t('tagline')}</div>
          <div className={s.footerSignup}>
            <label htmlFor="signup-input">{t('newsletterLabel')}</label>
            <div className={s.inputGroup}>
              <Input type="text" id="signup-input" className={s.signupInput} />
              <a className={s.signupBtn}>
                <i className="icon icon-arr3"></i>
              </a>
            </div>
            <a href="https://tawk.to/chat/56ba62ae4003e62e173fad2a/default/?$_tawk_popout=true">Chat</a>
          </div>
          <div className={s.footerCopy}>
            &copy; {year} {t('copyright')}
          </div>
        </div>

        <div className={s.footerC}>
          <div className={s.footermenu}>
            <div className={s.title}>{t('navigation.title')}</div>
            <ul>
              <li>
                <Link href={routes.home()}>{t('navigation.home')}</Link>
              </li>
              <li>
                <Link href={routes.page('parcel-service')}>{t('navigation.regularServices')}</Link>
              </li>
              <li>
                <Link href={routes.page('cargo')}>{t('navigation.cargoServices')}</Link>
              </li>
              <li>
                <Link href={routes.page('prices')}>{t('navigation.prices')}</Link>
              </li>
              <li>
                <Link href={routes.page('contact')}>{t('navigation.contacts')}</Link>
              </li>
            </ul>
          </div>
          <div className={s.footermenu}>
            <div className={s.title}>{t('usefulLinks.title')}</div>
            <ul>
              <li>
                <Link href={routes.page('terms-and-conditions')}>{t('usefulLinks.termsAndConditions')}</Link>
              </li>
              <li>
                <Link href={routes.page('privacy-policy')}>{t('usefulLinks.privacyPolicy')}</Link>
              </li>
              <li>
                <Link href={routes.page('forbidden-items')}>{t('usefulLinks.forbiddenGoods')}</Link>
              </li>
              <li>
                <Link href={routes.page('dangerous-items')}>{t('usefulLinks.dangerousGoods')}</Link>
              </li>
              <li>
                <Link href={routes.page('custom-clearence')}>{t('usefulLinks.customClearance')}</Link>
              </li>
            </ul>
          </div>
          <div className={s.footermenu}>
            <div className={s.title}>{t('links.title')}</div>
            <ul>
              <li>
                <Link href={routes.page('faq')}>{t('links.faqs')}</Link>
              </li>
              <li>
                <Link href={routes.page('help-to-shop')}>{t('links.getAQuotes')}</Link>
              </li>
              <li>
                <Link href={routes.page('volumeweight')}>{t('links.volumeWeight')}</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={s.footerR}>
          {/* // TODO: copy dropdown and logic from original site */}
          <div className={cn(s.footerContactsItem, s.active)}>
            <p>
              1914 Kings Highway, 2 FL <br />
              Brooklyn NY 11229
            </p>
            <p>
              Tel: +1 718 676 0022 <br />
              Fax: +1 718 988 4444
            </p>
            <p>
              <a href="mailto:info@gzavnili.com">info@gzavnili.com</a>
            </p>
            <p>
              Mon-Fri 9:00-19:00 <br />
              Sat-Sun 10:00-17:00
            </p>
          </div>
          <div className={s.footerContactsItem}>
            <p>
              41 Tashkenti Street <br />
              Tbilisi, Georgia
            </p>
            <p>Tel: +995 332 247 00 22</p>
            <p>
              <a href="mailto:tbilisi@gzavnili.com">tbilisi@gzavnili.com</a>
            </p>
            <p>
              Mon-Fri 9:00-20:00 <br />
              Sat-Sun 10:00-17:00
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
