import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { routes } from "@/lib/routes";

// Ported from the legacy layout at http/views/layouts/new.html (English branch only).
export function Footer() {
  const year = new Date().getFullYear();

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
          <div className="txt">
            Everyday is a new day for us and we work really hard to satisfy our customer
            everywhere.
          </div>
          <div className="footer-signup">
            <label htmlFor="signup-input">Newsletter Setup</label>
            <div className="input-group">
              <Input type="text" id="signup-input" />
              <a className="signup-btn">
                <i className="icon icon-arr3"></i>
              </a>
            </div>
          </div>
          <div className="footer-copy">
            &copy; {year} gzavnili.com. All rights reserved
          </div>
        </div>

        <div className="footer-c">
          <div className="footermenu">
            <div className="title">Navigation</div>
            <ul>
              <li>
                <Link href={routes.home()}>Home</Link>
              </li>
              <li>
                <Link href={routes.page("parcel-service")}>Regular services</Link>
              </li>
              <li>
                <Link href={routes.page("cargo")}>Cargo services</Link>
              </li>
              <li>
                <Link href={routes.page("prices")}>Prices</Link>
              </li>
              <li>
                <Link href={routes.page("contact")}>Contacts</Link>
              </li>
            </ul>
          </div>
          <div className="footermenu">
            <div className="title">Useful Links</div>
            <ul>
              <li>
                <Link href={routes.page("terms-and-conditions")}>Terms and Conditions</Link>
              </li>
              <li>
                <Link href={routes.page("privacy-policy")}>Privacy Policy</Link>
              </li>
              <li>
                <Link href={routes.page("forbidden-items")}>Forbidden Goods</Link>
              </li>
              <li>
                <Link href={routes.page("dangerous-items")}>Dangerous Goods</Link>
              </li>
              <li>
                <Link href={routes.page("custom-clearence")}>Custom Clearance</Link>
              </li>
            </ul>
          </div>
          <div className="footermenu">
            <div className="title">Links</div>
            <ul>
              <li>
                <Link href={routes.page("faq")}>FAQs</Link>
              </li>
              <li>
                <Link href={routes.page("help-to-shop")}>Get a Quotes</Link>
              </li>
              <li>
                <Link href={routes.page("volumeweight")}>Volume Weight</Link>
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
