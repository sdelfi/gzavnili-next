"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { isOfficeOpen, type OfficeId } from "@/lib/officeHours";

// Ported from the legacy layout at http/views/layouts/new.html (English branch only).
// Markup/classes are kept as-is so css/style.css + css/style_custom.css apply unchanged.
// The interactive behavior that main.js used to provide via jQuery (dropdown toggles,
// office switching + open/closed indicator, tracking/login popovers) is reimplemented
// below as plain React state — no jQuery, no main.js.

type Office = {
  id: OfficeId;
  name: string;
  phone: string;
  mail: string;
  mailHref: string;
  hours: string;
};

const OFFICES: Office[] = [
  {
    id: "tbilisi",
    name: "Tbilisi",
    phone: "+995 332 247 00 22",
    mail: "tbilisi@gzavnili.com",
    mailHref: "mailto:tbilisi@gzavnili.com",
    hours: "Mon-Fri 11:00-19:00 · Sat-Sun 11:00-17:00",
  },
  {
    id: "newyork",
    name: "New York",
    phone: "+1 718 676 0022",
    mail: "info@gzavnili.com",
    mailHref: "mailto:info@gzavnili.com",
    hours: "Mon-Fri 9:00-19:00 · Sat-Sun 10:00-17:00",
  },
  {
    id: "delaware",
    name: "Delaware",
    phone: "+1 718 676 0022",
    mail: "wilmington@gzavnili.com",
    mailHref: "mailto:wilmington@gzavnili.com",
    hours: "Mon-Fri 9:00-19:00 · Sat-Sun Closed",
  },
];

type OpenDropdown = "language" | "office" | "menu" | null;

export function Header() {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [officeIndex, setOfficeIndex] = useState(0);
  const [officeOpenNow, setOfficeOpenNow] = useState<boolean | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const activeOffice = OFFICES[officeIndex];

  useEffect(() => {
    // Computed on the client (needs the visitor's/office's real time), so this
    // stays null during SSR/prerender and fills in after mount — matching how
    // main.js's checkOpennow() only ever ran in the browser too.
    setOfficeOpenNow(isOfficeOpen(activeOffice.id));
    const id = setInterval(() => setOfficeOpenNow(isOfficeOpen(activeOffice.id)), 60_000);
    return () => clearInterval(id);
  }, [activeOffice.id]);

  const toggleDropdown = (which: OpenDropdown) =>
    setOpenDropdown((current) => (current === which ? null : which));

  return (
    <header className="header">
      <div
        className="topbar"
        style={{ background: "#f9f9f9", paddingBottom: 0, marginBottom: 17 }}
      >
        <div className="container">
          <div className="topbar-inner">
            <div className={`language${openDropdown === "language" ? " active" : ""}`}>
              <div className="language-inner">
                <span onClick={() => toggleDropdown("language")}>English</span>
                <ul>
                  <li>
                    <a href="/ge/">ქართული</a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="topbar-contacts">
              {OFFICES.map((office, i) => (
                <div
                  key={office.id}
                  className={`topbar-contacts-item${i === officeIndex ? " active" : ""}`}
                >
                  <div className="phone">
                    <span>Phone:</span> <span>{office.phone}</span>
                  </div>
                  <div className="mail">
                    <a href={office.mailHref}>{office.mail}</a>
                  </div>
                  <div className="time">
                    {office.hours.split(" · ").map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={`office${openDropdown === "office" ? " active" : ""}`}>
              <div className="office-inner">
                <div className="curr" onClick={() => toggleDropdown("office")}>
                  <div className="title">{activeOffice.name}</div>
                  <div className="opennow" style={{ color: "white", display: officeOpenNow ? "block" : "none" }}>
                    Open Now
                  </div>
                  <div className="closenow" style={{ color: "white", display: officeOpenNow === false ? "block" : "none" }}>
                    Closed Now
                  </div>
                </div>
                <ul>
                  {OFFICES.map((office, i) => (
                    <li
                      key={office.id}
                      className={i === officeIndex ? "active" : ""}
                      onClick={() => {
                        setOfficeIndex(i);
                        setOpenDropdown(null);
                      }}
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
              <a
                href="/tracking.html"
                onClick={(e) => {
                  e.preventDefault();
                  setTrackingOpen(true);
                }}
              >
                <i className="icon icon-tracking"></i> <span>Tracking</span>
              </a>
            </li>
            <li className="login-link1">
              <a
                href="/authenticate/login"
                onClick={(e) => {
                  e.preventDefault();
                  setLoginOpen(true);
                }}
              >
                <i className="icon icon-login"></i> <span>Login</span>
              </a>
            </li>
          </ul>

          <div className={`headermenu-block${openDropdown === "menu" ? " active" : ""}`}>
            <div className="headermenu-toggler" onClick={() => toggleDropdown("menu")}>
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

      <Modal open={trackingOpen} onClose={() => setTrackingOpen(false)} variant="w420">
        <h3>Tracking package</h3>
        <form action="/tracking.html" method="post">
          <div className="input-group">
            <input type="text" name="id" placeholder="Tracking No" />
          </div>
          <button type="submit" className="btn btn-blue">
            Track <i className="icon icon-arr1"></i>
          </button>
        </form>
      </Modal>

      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} variant="w420">
        <h3>Login</h3>
        <form action="/authenticate/login" method="post">
          <div className="input-group">
            <input type="text" name="login_username" placeholder="Account number" />
          </div>
          <div className="input-group">
            <input type="password" name="login_password" placeholder="Password" />
          </div>
          <button type="submit" className="btn btn-blue">
            Login <i className="icon icon-arr1"></i>
          </button>
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
      </Modal>
    </header>
  );
}
