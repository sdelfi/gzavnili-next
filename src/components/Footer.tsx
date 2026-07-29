import Link from "next/link";

// Ported from the legacy layout at http/views/layouts/new.html (English branch only).
export async function Footer() {
  // `new Date()` is non-deterministic and Cache Components rejects it at prerender without
  // an explicit request-data source or 'use cache' — the copyright year only needs to be
  // right to within a cache revalidation, not per-request, so cache it rather than making
  // the whole footer dynamic. See docs/decisions/0005-cache-components.md.
  "use cache";
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-l">
          <div className="footer-lt">
            <div className="logo">
              <Link href="/">Gzavnili</Link>
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
              <input type="text" id="signup-input" />
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
                <Link href="/">Home</Link>
              </li>
              <li>
                <a href="/parcel-service.html">Regular services</a>
              </li>
              <li>
                <a href="/cargo.html">Cargo services</a>
              </li>
              <li>
                <a href="/prices.html">Prices</a>
              </li>
              <li>
                <a href="/contact.html">Contacts</a>
              </li>
            </ul>
          </div>
          <div className="footermenu">
            <div className="title">Useful Links</div>
            <ul>
              <li>
                <a href="/terms-and-conditions.html">Terms and Conditions</a>
              </li>
              <li>
                <a href="/privacy-policy.html">Privacy Policy</a>
              </li>
              <li>
                <a href="/forbidden-items.html">Forbidden Goods</a>
              </li>
              <li>
                <a href="/dangerous-items.html">Dangerous Goods</a>
              </li>
              <li>
                <a href="/custom-clearence.html">Custom Clearance</a>
              </li>
            </ul>
          </div>
          <div className="footermenu">
            <div className="title">Links</div>
            <ul>
              <li>
                <a href="/faq.html">FAQs</a>
              </li>
              <li>
                <a href="/help-to-shop.html">Get a Quotes</a>
              </li>
              <li>
                <a href="/volumeweight.html">Volume Weight</a>
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
