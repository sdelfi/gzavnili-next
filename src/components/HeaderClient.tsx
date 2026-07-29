"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/Input";
import { isOfficeOpen, type OfficeId } from "@/lib/officeHours";
import { OFFICES, setOfficeCookie } from "@/lib/offices";
import { routes } from "@/lib/routes";

// The interactive half of Header (dropdown toggles, office switching, tracking/login
// popovers) — reimplements what main.js used to do via jQuery. Same markup/classes as
// http/views/layouts/new.html so css/style.css + css/style_custom.css apply unchanged.
//
// Receives the visitor's saved office + its open/closed status already computed
// server-side (see Header.tsx) so there's no flash of the wrong office/status on load; only
// re-derives officeOpenNow client-side afterwards to keep it live across a long-open tab.
type OpenDropdown = "language" | "office" | "menu" | null;

export function HeaderClient({
  initialOfficeId,
  initialOfficeOpenNow,
}: {
  initialOfficeId: OfficeId;
  initialOfficeOpenNow: boolean;
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
      <div className="topbar" style={{ background: "#f9f9f9", paddingBottom: 0, marginBottom: 17 }}>
        <div className="container">
          <div className="topbar-inner">
            <div className={`language${openDropdown === "language" ? " active" : ""}`}>
              <div className="language-inner">
                <span onClick={() => toggleDropdown("language")}>English</span>
                <ul>
                  <li>
                    <a href={routes.georgianHome()}>ქართული</a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="topbar-contacts">
              {OFFICES.map((office, i) => (
                <div key={office.id} className={`topbar-contacts-item${i === officeIndex ? " active" : ""}`}>
                  <div className="phone">
                    <span>Phone:</span> <span>{office.phone}</span>
                  </div>
                  <div className="mail">
                    <a href={office.mailHref}>{office.mail}</a>
                  </div>
                  <div className="time">
                    {office.hours.split(" · ").map((line) => (
                      <span key={line}>{line} </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={`office${openDropdown === "office" ? " active" : ""}`}>
              <div className="office-inner">
                <div className="curr" onClick={() => toggleDropdown("office")}>
                  <div className="title">{activeOffice.name}</div>
                  <div
                    className="opennow"
                    style={{ color: "white", display: officeOpenNow === true ? "block" : "none" }}
                  >
                    Open Now
                  </div>
                  <div
                    className="closenow"
                    style={{ color: "white", display: officeOpenNow === false ? "block" : "none" }}
                  >
                    Closed Now
                  </div>
                </div>
                <ul>
                  {OFFICES.map((office, i) => (
                    <li key={office.id} className={i === officeIndex ? "active" : ""} onClick={() => selectOffice(i)}>
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
            <Link href={routes.home()}>
              <Image src="/img/logo.jpg" alt="Gzavnili, logistic company" width={190} height={80} />
            </Link>
          </div>

          <ul className="usermenu">
            <li className="login-link1">
              <a href={routes.login()}>
                <i className="icon icon-inbox"></i> <span>Inbox</span>
              </a>
            </li>
            <li className="tracking-link">
              <a
                href={routes.tracking()}
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
                href={routes.login()}
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
                <Link href={routes.home()}>
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page("parcel-service")}>
                  <span>Parcel Service</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page("cargo")}>
                  <span>Cargo</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page("courier")}>
                  <span>Courier</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page("prices")}>
                  <span>Prices</span>
                </Link>
              </li>
              <li>
                <Link href={routes.page("contact")}>
                  <span>Contact</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Modal open={trackingOpen} onClose={() => setTrackingOpen(false)} variant="w420">
        <h3>Tracking package</h3>
        <form action={routes.tracking()} method="post">
          <div className="input-group">
            <Input type="text" name="id" placeholder="Tracking No" />
          </div>
          <button type="submit" className="btn btn-blue">
            Track <i className="icon icon-arr1"></i>
          </button>
        </form>
      </Modal>

      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} variant="w420">
        <h3>Login</h3>
        <form action={routes.login()} method="post">
          <div className="input-group">
            <Input type="text" name="login_username" placeholder="Account number" />
          </div>
          <div className="input-group">
            <Input type="password" name="login_password" placeholder="Password" />
          </div>
          <button type="submit" className="btn btn-blue">
            Login <i className="icon icon-arr1"></i>
          </button>
        </form>
        <div className="or">
          <span>or</span>
        </div>
        <p>
          <a href={routes.testAccountLogin()} className="btn btn-blue">
            Temporary Access <i className="icon icon-arr1"></i>
          </a>
        </p>
        <p>
          New to Gzavnili? <a href={routes.register()}>Create an account</a>
        </p>
        <p>
          <a href={routes.forgotPassword()}>Restore Access!</a>
        </p>
      </Modal>
    </header>
  );
}
