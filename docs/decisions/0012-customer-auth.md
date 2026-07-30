# 0012 — Customer-facing auth realm (login/register/forgot/reset)

## Scope of this pass

The first customer-facing authenticated feature in the new stack. Client asked (2026-07-30,
prompted by the bema "Login as user" icon needing somewhere real to log a customer into) to
build a proper second auth realm — separate from the bema realm
(`docs/decisions/0011-bema-admin.md`) — rather than a stopgap link into the still-live legacy
site. Confirmed scope: login + "remember me" + forgot password (email link) + register.
Explicitly **not** in this pass: an `/account` dashboard (doesn't exist yet — successful
login/register just redirects to the site's home page, or `?ret=` if provided, matching
legacy's own `ret` param), SMS-based password recovery, Facebook OAuth, and the bema
"impersonate this customer" endpoint itself (needs this realm to exist first; wiring it is
follow-up work, see PROGRESS.md).

## Why URLs and `<title>`/meta match legacy exactly

Client note: public pages must keep the same URLs as legacy so SEO/backlink equity isn't
lost, and every page needs real `<title>`/meta description. So:

- `/authenticate/login`, `/authenticate/register`, `/authenticate/forgot/`,
  `/authenticate/reset` are the same paths as `http/views/authenticate/*.html`'s routes
  (`Authenticate.cfc`'s `doGet`/`doPost`/`doRegister`/`doForgotLogin`/`doPasswordReset`).
  `/authenticate/forgot/`'s legacy trailing slash isn't specially preserved — this app has
  no `trailingSlash: true`, so Next 308-redirects the slash variant to the slash-less one,
  which is a redirect to the same canonical page, not a broken/missing URL.
- Each page sets `metadata.title` to the exact string the legacy `setMetaTitle(...)` call
  produced (e.g. `"Sign in - Gzavnili"`), not a generic app-wide title.
- Visual/markup fidelity to the legacy `loginpage.css`-styled layout was **not** requested
  and isn't attempted here — same pattern as the bema panel's "functionality, not pixels"
  brief. Forms reuse the public site's existing global classes (`.container`, `.btn.btn-blue`,
  `.input-group`, via the shared `Input`/`Select` components) rather than the legacy
  loginpage-specific stylesheet.

## Architecture

Two independent auth realms per docs/migrations/03-target-architecture.md §3 — this is the
**customer** realm, wired the same way as the bema realm but kept completely separate:

- **Separate secret**: `CUSTOMER_AUTH_SECRET` (never `BEMA_AUTH_SECRET`), separate cookies
  (`gz_access_token`/`gz_refresh_token` vs. bema's `bema_access_token`/`bema_refresh_token`),
  separate lib files (`src/lib/auth/customerJwt.ts`/`customerCookies.ts`/
  `customerSession.ts`/`customerLogin.ts`/`customerRegister.ts`/`customerPasswordReset.ts`)
  rather than parameterizing the bema files — the bema token payload carries an `AdminRole`
  that has no customer-realm equivalent, and keeping the realms structurally independent
  (not just secret-independent) was already the established precedent.
- **Server Actions, not `/api/*` Route Handlers**: unlike bema (a CSR SPA calling
  `/api/bema/*` from `fetch`), the public site is server-rendered and its forms submit via
  Next.js Server Actions (`src/app/[locale]/authenticate/actions.ts`, `'use server'`) using
  `useActionState` — no client-side fetch/JSON plumbing needed, consistent with the rest of
  the public site having no client-state auth layer today. `src/lib/auth/customerSession.ts`
  therefore reads cookies via `next/headers`'s `cookies()`, not a `NextRequest`.
- **"Remember me"**: legacy stores a distinct `RememberMe` token/AES-encrypted cookie
  (`MSSQLUserDAO.createRememberMe`). Since this stack's session model is already a
  short-lived-access + refresh-token pair (not legacy's server-session store), the direct
  equivalent is simply a longer-lived refresh cookie when the box is checked (30 days,
  matching legacy's cookie expiry) vs. a shorter one when it's not (24h) — no separate
  token/DB column needed, see `customerJwt.ts`'s `REFRESH_TOKEN_TTL_SECONDS_PERSISTENT`.
- **Forgot/reset password** reuses the `User.passwordResetToken`/`passwordResetExpiresAt`
  columns already in the schema (added for bema), 60-minute expiry matching legacy's
  `generateResetToken`. No schema change needed for this pass.
- **Register**: username is never chosen by the customer — auto-generated as `GZ` + an
  incrementing number, porting legacy's `getNewUsername()` exactly
  (`customerRegister.ts`'s `generateNextUsername`). New accounts are `active`/`confirmed`
  immediately (**deliberate simplification**: legacy conditionally requires email
  verification before activating; that branch isn't built since there's no
  confirmation-email flow yet, only the reset-link email below — flagged here, not silent).
- **Outgoing email**: `src/lib/email/sendEmail.ts`, a thin `nodemailer` wrapper configured
  via `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM`. No SMTP credentials exist
  in this environment — if `SMTP_HOST` is unset, the email is logged to the server console
  instead of sent, so the reset-password flow is fully real and testable end-to-end, it just
  needs real credentials in `.env` to actually deliver in production.
- **Lockout policy**: reuses the exact same 15-failed-attempts/15-minute-lockout thresholds
  and shared `SecurityLog` table as the bema realm's login — legacy's `validateLogin` is one
  DAO method used by both realms with identical lockout behavior, so there's no reason for
  this realm's policy to differ (`customerLogin.ts`).
- **Header quick-login modal** (`HeaderClient.tsx`) now submits through the same
  `loginAction` Server Action as the dedicated `/authenticate/login` page — one code path,
  not two logins that could drift apart.

## Known gaps / follow-ups

- No `/account` dashboard — see "Scope" above.
- No email-verification-on-register flow (accounts auto-confirm instead).
- No SMS-based password recovery, no Facebook OAuth (both were in the legacy
  `Authenticate.cfc` but excluded from this pass's confirmed scope).
- The bema "Login as user" icon (`docs/decisions/0011-bema-admin.md`'s customers list) is
  still a disabled placeholder — this realm existing is the prerequisite, but the actual
  "bema mints a session for a given customer id" endpoint is separate, not-yet-built work.
- `routes.testAccountLogin()` (`/authenticate/login/?testaccount=1`, an auto-login-as-a-demo-
  account link already present in `HeaderClient.tsx`) isn't wired — the query param is
  currently ignored, so that link just shows the normal login form. Legacy auto-logged in as
  a hardcoded test account (`GZ123`/a fixed password); not implemented here.
