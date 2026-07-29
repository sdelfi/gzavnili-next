# 01 — Current State Audit

## 1. Stack

- **Backend/language**: Adobe ColdFusion / Lucee (CFML). Not PHP, Node, Python, or Ruby. Confirmed by 716 `.cfm`/`.cfc` files and zero `.php` files. No `composer.json`/`package.json` at the app root — this predates npm-era tooling entirely.
- **Database**: Microsoft SQL Server (MSSQL). Confirmed in `http/Application.cfc`: `application.dsn = 'gzavnili'`, `application.dbtype = 'MSSQL'`. A `DAOFactory` pattern (`extensions/components/DAO/DAOFactory.cfc`) nominally supports a `MySQL` case too, but only the MSSQL implementation (`extensions/components/DAO/MSSQL/*.cfc`, ~20 DAO classes) is wired up and used in production. No ORM anywhere — all data access is raw `<cfquery>` SQL inside DAO classes.
- **Frontend rendering**: Classic server-rendered MVC. Controllers build data, `<cfinclude>` a view fragment, wrap it in a layout (`http/views/layouts/default.html`, `mobile.html`, `new.html`, `static.html`). No SPA framework. Client-side interactivity is jQuery + Bower-vendored plugins (`http/bower_components/`: jQuery, select2, lightslider, datetimepicker, iCheck, featherlight, etc.) — no build tool (no Webpack/Gulp/Vite config anywhere), no React/Vue in use today.
- **Migrations**: no formal migrations framework. `database/` contains exactly two ad hoc T-SQL scripts (`migration_add_audit_columns.sql`, `migration_add_overlap_trigger.sql`), unrelated to the parcels domain — schema changes are otherwise undocumented/manual.

## 2. Directory structure

| Path | Purpose |
|---|---|
| `com/portline/` | Shared legacy CF component library: `DateTime.cfc`, `ValidationBean.cfc`, and subfolders for `payments/`, `shipping/` (`Ups.cfc`, `FedEx.cfc`, `Usps.cfc`, `ShippingMethod.cfc`), `ups/` (UPS address verification/rating), `rss/`. |
| `database/` | Two loose T-SQL migration scripts only, not a real migrations system. |
| `extensions/` | The application core: `components/` (models, DAOs, services), `controllers/` (`.cfc` controllers), `custom_tags/` (shared CFML custom tags, incl. the auth guard `require.cfm`). |
| `http/` | Web root. Contains the public site (`views/`, static assets), the `bema/` admin sub-application, several duplicate mobile API sub-apps (`API/`, `ApiNew/`, `ApiNew2/`, `api2/`), `ajax/`, `cron/`, `pp/`, `oauth/`, a vendored `firebase/` CFML library, and leftover unused Drupal cruft (`http/modules/`, `http/misc/`, `http/sites/all`) that appears dead. |
| `templates.cfm`, `templates_sms.cfm` | Email/SMS templates (repo root). |

Each of `http/` (main site), `http/bema/` (admin), `http/API`, `http/ApiNew`, `http/ApiNew2`, `http/api2`, `http/ajax`, `http/cron`, `http/pp` has its own `Application.cfc` — i.e. each is its own isolated CF application/session scope, not one unified app.

## 3. bema admin panel

Located at `http/bema/`. It is a **separate CF sub-application** — its own `Application.cfc` `extends="gzavnili.Application"` (inherits the main app's datasource/config), but overrides session auth (its own `session.buser` login check), forces SSL, and uses its own layout (`lytBema.cfm`). Same CFML/DAO stack, same MSSQL database as the main site — architecturally it's a distinct directory/sub-app, not a distinct framework.

Modules under `http/bema/`: `parcels/`, `products/`, `orders/`, `users/`, `coupons/` (**out of scope, see below**), `statements/`, `content/`, `reports/`, `messages/` (SMS/email), `config/`. Each module has a `.cfm` controller-ish file plus a paired view at `http/bema/views/<module>/vwXxx.cfm`. Bema's `include/` folder additionally vendors DataTables, Bootstrap, TinyMCE, and a "blueprint"/"protoplasm" CSS framework — same jQuery-plugin era, no modern bundler.

## 4. Public site vs. authorized zone

- **Public/marketing pages**: routed via `http/index.cfm`'s front controller to `controllers.Static` / `controllers.Homepage` / `controllers.Store`. Templates in `http/views/`: `home.html`, `home_ge.html`, `contact.html`, `pick-up-service.html`, `help-to-shop.html`, `services-online.html`, `services-online-store.html`, `quotation.html`, `mailing-list.html`, plus a handful of miscellaneous static pages (~16 top-level static views), and a product catalog under `http/views/store/*` (`browse.html`, `department.html`, `product.html`, `search.html`, `print.html`) served by `Store.cfc` (175 lines). Roughly 15-20 truly public/marketing routes plus the catalog. Most content is static/rarely-changing, though store/search/homepage pull some dynamic data via DAOs.
- **Public unauthenticated parcel tracking**: `http/views/tracking.html`, handled by `Static.cfc::doTracking`, queries `ParcelDAO.getParcelByTrackingNum()` against the same production DB as bema. This is a latency-sensitive, high-traffic public query.
- **Authorized customer zone ("personal cabinet")**: lives under `/account/*` and `/checkout/*`. Controllers: `Account.cfc` (1600 lines — the largest controller in the app) and `Checkout.cfc` (1284 lines). Views in `http/views/account/*` (settings, orders, parcels, statements, billing, shipping, invoices, receiver management, multi-step payment flows `pay/pay1-pay3`) and `http/views/checkout/*` (cart, order, PayPal, complete/cancel). This is the customer dashboard: order history, parcel tracking/management, statements/invoices, payments, address/receiver book, account settings.
- **Live site confirmation** (fetched from https://usa.gzavnili.com/): public nav includes Parcel Service, Cargo, Courier, Pricing (with an embedded calculator), News, Contact, FAQ, plus static pages (terms, privacy, customs procedures, forbidden/dangerous items, volume weight guidelines). A personal cabinet requiring login provides parcel tracking by number, shipment history, and account management, matching the code-level findings above.

### Auth/session model

- Native ColdFusion server-side sessions (`this.sessionManagement = true`, 1-day timeout in `http/Application.cfc`) — not JWT.
- Login sets `session.user` (a `model.users.User` CFC instance) in `Authenticate.cfc`; passwords hashed via `user.hashPassword(pw, salt)`.
- "Remember me" via an encrypted cookie (`cookie.rmt`), resolved in `onRequestStart`.
- A separate `session.buser` holds the bema (admin) identity — a distinct auth realm from the customer session.
- `application.enckey` / `GenerateSecretKey("DESEDE")` is used for a session-link token (`stoken`) passed across a cookie-bridging redirect (`get_cookies.cfm`) — a workaround for setting cookies cross-domain.
- **The public/authorized boundary is enforced per-route, not by folder or middleware.** The shared custom tag `extensions/custom_tags/require.cfm` is invoked at the top of each controller method needing protection (`<cfmodule template="/custom_tags/require.cfm" ssl="true" user="true" ...>`), checking `StructKeyExists(session,'user')`. The same tag with a `groups="..."` argument guards bema methods against `session.buser`. So public and authorized routes are mixed within the same controller files (e.g. both public and account-only methods can live in the same `.cfc`), distinguished only by this shared guard call — `bema` itself IS folder-separated, but customer-authorized pages are not separated from public pages at a structural/directory level.

## 5. API surfaces (needs Phase 0 audit)

Multiple overlapping, likely-duplicate mobile API surfaces exist under `http/`: `API/`, `ApiNew/`, `ApiNew2/`, `api2/` — near-identical sets of endpoints (parcels, tokens/push notifications, payments, SMS codes), plus a `pusher.cfc` and push-certificate `.p12` files. There is also a more structured REST-ish surface via the `Api.cfc` controller (HTTP Basic Auth against `application.api.id`/`application.api.password`), and an `ajax/` folder for same-origin AJAX calls from the main site (coupons, SMS codes, shipping rates).

**This duplication strongly suggests dead/superseded code.** Before any migration or rewrite decision, a Phase 0 audit must determine — from web server access logs / APM / mobile app version telemetry, not from code alone — which of `API`, `ApiNew`, `ApiNew2`, `api2` is actually live in production. Dead variants should be deleted, not migrated. The decision to migrate vs. rewrite the live surface is deferred pending client confirmation (see [07-risks-and-open-questions.md](07-risks-and-open-questions.md)).

## 6. Data sources / external integrations

- Single MSSQL database (`gzavnili` DSN) shared by the public site, account/checkout code, and bema admin.
- Shipping integrations: `com/portline/shipping/` (`Ups.cfc`, `FedEx.cfc`, `Usps.cfc`, `ShippingMethod.cfc`) and `com/portline/ups/` (UPS address verification/rating). **Exact call sites (synchronous in checkout vs. async/cron) need a follow-up code search before Phase 3 checkout work is scoped in detail** — not fully enumerated in this audit.
- Payment gateways: `extensions/components/orders/` — `PayPal.cfc`, `AuthorizeNet.cfc`, `CyberSource.cfc`, `PayFlowPro.cfc`, `Sage.cfc`, `InternetSecure.cfc`, plus a custom Georgian card gateway "GZPay" (`application.gzpay.*` config in `Application.cfc`, hitting `mpi.gc.ge`).
- SendGrid SMTP for outbound email; `openexchangerates.org` for currency conversion.

## 7. Scale

- Total project files (excl. `.git`, `node_modules`, `bower_components`): ~2,460.
- CFML files (`.cfc`/`.cfm`): 716 total.
- Main site (everything except `http/bema`, `http/sites`, bower): ~114,651 LOC across `.cfc`/`.cfm`/`.html`.
- Bema admin (`http/bema`, excluding vendored `include/` assets): ~257 files, ~40,327 LOC.
- Main site is ~3x bema's LOC, though bema is denser/single-purpose; main-site LOC is inflated by near-duplicate legacy view backups (e.g. `index.backup20180409.html`, `index.backup20190912.html` under `views/account/`).

## 8. Security note — plaintext secrets

`http/Application.cfc` contains **plaintext production secrets**: SendGrid SMTP credentials, payment gateway/GZPay credentials, and API basic-auth id/password. These must be **rotated before or independent of** migration work — do not carry them into any new config as-is, and do not commit them anywhere new. Flagged as a Phase 0 action item, not a migration-dependent one (see [06-phased-rollout-plan.md](06-phased-rollout-plan.md)).

## 9. Coupons module scope boundary (must confirm in Phase 0)

The client has explicitly excluded the coupons module from migration scope. Known coupon-related surfaces to leave untouched: bema's `coupons/` module (`http/bema/coupons/`), `MSSQLCouponDAO.cfc` (if present under `extensions/components/DAO/MSSQL/`), and coupon-related `ajax/`/cron endpoints (e.g. anything resembling `getCoupons.cfm`). Phase 0 must verify whether checkout or invoicing logic (`payMethod1/2`, `payAmount1/2`, or the checkout flow generally) references coupon codes/discounts inline — if so, the Postgres schema for in-scope domains must not silently drop a column another in-scope module depends on.
