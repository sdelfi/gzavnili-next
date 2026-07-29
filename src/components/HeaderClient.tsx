"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { isOfficeOpen, type OfficeId } from "@/lib/officeHours";
import { OFFICES, setOfficeCookie } from "@/lib/offices";

// The interactive half of Header (dropdown toggles, office switching, tracking/login
// popovers) — reimplements what main.js used to do via jQuery. Same markup/classes as
// http/views/layouts/new.html so css/style.css + css/style_custom.css apply unchanged.
//
// Receives the visitor's saved office + its open/closed status already computed
// server-side (see HeaderPersonalized.tsx) so there's no post-hydration flash; only
// re-derives officeOpenNow client-side afterwards to keep it live (the initial value can be
// a few minutes stale by the time this streams in).
type OpenDropdown = "language" | "office" | "menu" | null;

export function HeaderClient({
  initialOfficeId,
  initialOfficeOpenNow,
}: {
  initialOfficeId: OfficeId;
  // null only for the Suspense fallback (see Header.tsx) — that's prerendered at build time,
  // and `new Date()` isn't allowed there without a request-data source, so it can't compute a
  // real value. Resolves to a real boolean within the same request via HeaderPersonalized.
  initialOfficeOpenNow: boolean | null;
}) {
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

  const activeOffice = OFFICES[officeIndex];

  useEffect(() => {
    const id = setInterval(() => setOfficeOpenNow(isOfficeOpen(activeOffice.id)), 60_000);
    return () => clearInterval(id);
  }, [activeOffice.id]);

  const toggleDropdown = (which: OpenDropdown) =>
    setOpenDropdown((current) => (current === which ? null : which));

  const selectOffice = (i: number) => {
    setOfficeIndex(i);
    setOfficeOpenNow(isOfficeOpen(OFFICES[i].id));
    setOpenDropdown(null);
    setOfficeCookie(OFFICES[i].id);
  };

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
                  <div className="opennow" style={{ color: "white", display: officeOpenNow === true ? "block" : "none" }}>
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

      <div className="bottombar">
        <div className="container">
          <div className="logo">
            <Link href="/">
              <img src="/img/logo.jpg" alt="Gzavnili, logistic company" />
            </Link>
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
                <Link href="/">
                  <span>Home</span>
                </Link>
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
