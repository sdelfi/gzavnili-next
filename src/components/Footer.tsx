import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/Input';
import { routes } from '@/lib/routes';

// Ported from the legacy layout at http/views/layouts/new.html.
export async function Footer() {
  const year = new Date().getFullYear();
  const t = await getTranslations('Footer');

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-l">
          <div className="footer-lt">
            <div className="logo">
              <Link href={routes.home()}>Gzavnili</Link>
            </div>
            <ul className="social">
              <li className="icon-social icon-fb-footer">
                <a href="https://www.facebook.com/gzavnili">Facebook</a>
              </li>
            </ul>
          </div>
          <div className="txt">{t('tagline')}</div>
          <div className="footer-signup">
            <label htmlFor="signup-input">{t('newsletterLabel')}</label>
            <div className="input-group">
              <Input type="text" id="signup-input" />
              <a className="signup-btn">
                <i className="icon icon-arr3"></i>
              </a>
            </div>
          </div>
          <div className="footer-copy">
            &copy; {year} {t('copyright')}
          </div>
        </div>

        <div className="footer-c">
          <div className="footermenu">
            <div className="title">{t('navigation.title')}</div>
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
          <div className="footermenu">
            <div className="title">{t('usefulLinks.title')}</div>
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
          <div className="footermenu">
            <div className="title">{t('links.title')}</div>
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

        <div className="footer-r">
          <div className="footer-contacts">
            <div className="footer-contacts-item active">
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
            <div className="footer-contacts-item">
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
      </div>
    </footer>
  );
}
