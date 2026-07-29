// Ported from the legacy layout at http/views/layouts/new.html (English branch only).
// Markup/classes are kept as-is so the original css/style.css + css/style_custom.css
// apply unchanged. Office-hours/language/session logic from the CFML version is
// dropped for now — this is a static first pass, not the final interactive header.
export function Header() {
  return (
    <header className="header">
      <div
        className="topbar"
        style={{ background: "#f9f9f9", paddingBottom: 0, marginBottom: 17 }}
      >
        <div className="container">
          <div className="topbar-inner">
            <div className="language">
              <div className="language-inner">
                <span>English</span>
                <ul>
                  <li>
                    <a href="/ge/">ქართული</a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="topbar-contacts">
              <div className="topbar-contacts-item active">
                <div className="phone">
                  <span>Phone:</span> <span>+995 332 247 00 22</span>
                </div>
                <div className="mail">
                  <a href="mailto:tbilisi@gzavnili.com">tbilisi@gzavnili.com</a>
                </div>
                <div className="time">
                  <span>Mon-Fri 11:00-19:00</span> <span>Sat-Sun 11:00-17:00</span>
                </div>
              </div>
              <div className="topbar-contacts-item">
                <div className="phone">
                  <span>Phone:</span> <span>+1 718 676 0022</span>
                </div>
                <div className="mail">
                  <a href="mailto:info@gzavnili.com">info@gzavnili.com</a>
                </div>
                <div className="time">
                  <span>Mon-Fri 9:00-19:00</span> <span>Sat-Sun 10:00-17:00</span>
                </div>
              </div>
              <div className="topbar-contacts-item">
                <div className="phone">
                  <span>Phone:</span> <span>+1 718 676 0022</span>
                </div>
                <div className="mail">
                  <a href="mailto:wilmington@gzavnili.com">wilmington@gzavnili.com</a>
                </div>
                <div className="time">
                  <span>Mon-Fri 9:00-19:00</span> <span>Sat-Sun Closed</span>
                </div>
              </div>
            </div>

            <div className="office">
              <div className="office-inner">
                <div className="curr">
                  <div className="title">Tbilisi</div>
                  <div className="opennow hide" style={{ color: "white" }}>
                    Open Now
                  </div>
                  <div className="closenow hide" style={{ color: "white" }}>
                    Closed Now
                  </div>
                </div>
                <ul>
                  <li className="active">Tbilisi</li>
                  <li>New York</li>
                  <li>Delaware</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottombar">
        <div className="container">
          <div className="logo">
            <a href="/">
              <img src="/img/logo.jpg" alt="Gzavnili, logistic company" />
            </a>
          </div>

          <ul className="usermenu">
            <li className="login-link1">
              <a href="/authenticate/login">
                <i className="icon icon-inbox"></i> <span>Inbox</span>
              </a>
            </li>
            <li className="tracking-link">
              <a href="#">
                <i className="icon icon-tracking"></i> <span>Tracking</span>
              </a>
            </li>
            <li className="login-link1">
              <a href="/authenticate/login">
                <i className="icon icon-login"></i> <span>Login</span>
              </a>
            </li>
          </ul>

          <div id="tracking-block">
            <h3>Tracking package</h3>
            <form action="/tracking.html" method="post">
              <div className="input-group">
                <input type="text" name="id" placeholder="Tracking No" />
              </div>
              <a href="#" className="btn btn-blue">
                Track <i className="icon icon-arr1"></i>
              </a>
            </form>
          </div>

          <div id="login-block">
            <h3>Login</h3>
            <form action="/authenticate/login" method="post">
              <div className="input-group">
                <input type="text" name="login_username" placeholder="Account number" />
              </div>
              <div className="input-group">
                <input type="password" name="login_password" placeholder="Password" />
              </div>
              <a href="#" className="btn btn-blue">
                Login <i className="icon icon-arr1"></i>
              </a>
            </form>
            <div className="or">
              <span>or</span>
            </div>
            <p>
              <a href="/authenticate/login/?testaccount=1" className="btn btn-blue">
                Temporary Access <i className="icon icon-arr1"></i>
              </a>
            </p>
            <p>
              New to Gzavnili? <a href="/authenticate/register">Create an account</a>
            </p>
            <p>
              <a href="/authenticate/forgot/">Restore Access!</a>
            </p>
          </div>

          <div className="headermenu-block">
            <div className="headermenu-toggler">
              <i className="icon icon-menu">
                <span></span>
              </i>{" "}
              Menu
            </div>
            <ul className="headermenu">
              <li>
                <a href="/">
                  <span>Home</span>
                </a>
              </li>
              <li>
                <a href="/parcel-service.html">
                  <span>Parcel Service</span>
                </a>
              </li>
              <li>
                <a href="/cargo.html">
                  <span>Cargo</span>
                </a>
              </li>
              <li>
                <a href="/courier.html">
                  <span>Courier</span>
                </a>
              </li>
              <li>
                <a href="/prices.html">
                  <span>Prices</span>
                </a>
              </li>
              <li>
                <a href="/contact.html">
                  <span>Contact</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
