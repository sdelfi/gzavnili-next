# 02 — Parcels Domain Analysis (the central technical problem)

This is the client's stated core pain point: the `bema/parcels` admin section runs very slow, complex queries to compute parcel status and related fields. This document is the detailed business-logic and technical analysis that Phase 1's schema redesign ([04-postgres-schema-design.md](04-postgres-schema-design.md)) must satisfy.

## 1. Where this lives

- **Controller/page**: `http/bema/parcels/parcels.cfm` — the main admin parcels list page. Calls `parcelDao.getParcels(...)` **twice per request** (once for the current page, once for a secondary "upcoming trips" grid with a 30-day-back `dateStart`), plus a CSV export branch (`url.export eq 1`) that calls `getParcels(recordsPerPage = 9999, ...)` — a near-unbounded synchronous export of the same heavy query.
- **View**: `http/bema/views/parcels/vwParcels_work2.cfm` (and a `vwParcels_work.cfm` variant, selected by an IP-based A/B switch on `cgi.remote_addr` — an odd, likely-stale mechanism worth removing rather than porting).
- **DAO (interface, unused stub)**: `extensions/components/DAO/ParcelDAO.cfc` — an empty abstract class.
- **DAO (actual implementation used in production)**: `extensions/components/DAO/MSSQL/MSSQLParcelDAO.cfc`. Confirmed active via `application.dbtype = 'MSSQL'` → `MSSQLDAOFactory.getParcelDAO()` returns this exact class. There is also a **dead duplicate copy** at `extensions/components/DAO/MSSQL/B/MSSQLParcelDAO.cfc` (not wired into the factory) — flag as tech debt, do not migrate, but confirm it's truly dead before deleting.
- **Model**: `extensions/components/parcels/Parcel.cfc` — a plain bean; `status` is just a settable string property, never computed here. All status computation lives in SQL.
- The core method, `getParcels()`, spans **lines 207–1324** of `MSSQLParcelDAO.cfc` — over 1,100 lines for one function.

## 2. The query structure and its problems

`getParcels()` runs **three near-duplicate full queries per call**, all sharing nearly identical WHERE clauses:

1. A `COUNT(*)` query (lines ~275-560) for total row count.
2. The main query (lines ~567-1319): manual pagination using a T-SQL table variable (`@results`), `INSERT INTO @results SELECT TOP N ...`, plus a `parcelid not in (select top #prevrec# parcelid from (...same joins/filters...))` "skip" subquery (lines ~1010-1297) — instead of `OFFSET/FETCH`. The entire filter predicate, including correlated subqueries, is evaluated redundantly at least twice per call, and the skip-subquery cost **grows linearly with page number**.

### 2.1 The status CASE (non-sargable, computed per row, per query)

At lines 666-682:

```sql
status =
CASE
    WHEN bNotOnHold = 1 THEN 'notOnHold'
    WHEN bOnHold = 1 THEN 'OnHold'
    WHEN len(parcels.TrackingDeliveredSigned) > 1 THEN 'delivered'
    WHEN len(parcels.TrackingOutDelivery) > 1 THEN 'outdelivery'
    WHEN len(parcels.TrackingSendRegion) > 1 THEN 'region'
    WHEN len(parcels.TrackingOffice) > 1 THEN 'office'
    WHEN len(parcels.TrackingProcessingCustom) > 1 THEN 'processingCustom'
    WHEN len(parcels.TrackingCustom) > 1 THEN 'Custom'
    WHEN len(parcels.TrackingDelay) > 1 THEN 'Delay'
    WHEN len(parcels.TrackingShipped) > 1 THEN 'Shipped'
    WHEN len(parcels.TrackingReceived) > 1 THEN 'Received'
    WHEN len(parcels.TrackingAway) > 1 THEN 'Awaiting'
    ELSE 'New'
END
```

`len()` is applied to `datetime` columns — an implicit varchar conversion. This is **non-sargable**: SQL Server must convert every row's timestamp to a string to test its length, per row, per query, up to three times per page load. No index can help this.

Filtering (`arguments.status`, `arguments.estatus`) **re-implements the same precedence waterfall as raw `AND`-chains of `len(...) > 1` checks, written out fully three separate times** (once per each of the three queries in `getParcels()`), instead of filtering on one computed expression.

### 2.2 Six correlated/scalar subqueries per row (lines 690-713)

- **Paid** — `EXISTS(SELECT 1 FROM invoices_items ii WHERE ii.ParcelId = parcels.ParcelId)`
- **Invoiced** — the exact same `EXISTS` pattern, duplicated rather than reused.
- **InvoiceId** — `SELECT TOP 1 InvoiceId FROM invoices_items WHERE ParcelId = ...`
- **invoiceamount** — `SELECT SUM(ii.amount) FROM invoices i JOIN invoices_items ii ... WHERE ii.ParcelId = parcels.ParcelId AND i.UserId = parcels.UserId AND i.InvoiceDate > '2011-04-01'`
- **paidamount** — `SELECT SUM(amount) FROM payments WHERE UserId = parcels.UserId AND PaymentDate > '2011-04-01' AND paymentmethodid != 'balance'` — **this is a user-level aggregate, recomputed identically for every parcel row belonging to that user.** This is the single worst offender: for a user with N parcels on the page, the same SUM is computed N times.
- **officename** — `SELECT TOP 1 officename FROM parceloffice po JOIN delivery_offices do ON do.officeid = po.officeid WHERE po.parcelid = parcels.parcelid`
- Plus two more scalar subqueries (`tfname`/`tlname`) against `users` for `trackingreceivedby`.

### 2.3 Inconsistency between list and detail views

The single-parcel `read()` function (lines 1334-1349) uses a **different priority order** than the list query: it checks `delivered` **before** the hold flags (`bNotOnHold`/`bOnHold`), unlike the list query where hold flags win first. **This is an actual data/logic bug** — the same parcel can show a different status depending on whether you're viewing the list or the detail page. This discrepancy must be resolved as an explicit business decision (which order is correct?) before the new schema's single status-computation function is written — see [07-risks-and-open-questions.md](07-risks-and-open-questions.md).

## 3. Business meaning of "parcel status"

Status is **not a stored column** — it's a derived value computed at query time from a strict-priority waterfall over milestone timestamp columns plus two hold flags. Priority order, top to bottom (as used in the list query):

| Priority | Status | Determined by |
|---|---|---|
| 1 | `notOnHold` | `bNotOnHold = 1` — hold released; admin/data-quality gate |
| 2 | `OnHold` | `bOnHold = 1` — missing required data (Store/Value/Contents not declared) past a cutoff trip date; blocks further shipment until customs/declaration info is completed. Set/cleared by cron job `http/cron/onhold.cfm` (and legacy inline code in `parcels.cfm`) via bulk `UPDATE parcels SET bOnHold=1/bNotOnHold=1` based on `Store`, `Value`, `Contents` being null/blank/"Not Declared" |
| 3 | `delivered` | `TrackingDeliveredSigned` populated — final delivery confirmed/signed |
| 4 | `outdelivery` | `TrackingOutDelivery` populated, not yet delivered — out for local delivery |
| 5 | `region` | `TrackingSendRegion` populated — sent to regional office |
| 6 | `office` | `TrackingOffice` populated — arrived at pickup office |
| 7 | `processingCustom` | `TrackingProcessingCustom` populated — in customs processing |
| 8 | `Custom` | `TrackingCustom` populated — cleared/at customs |
| 9 | `Delay` | `TrackingDelay` populated — flagged delayed |
| 10 | `Shipped` | `TrackingShipped` populated — left origin warehouse/US |
| 11 | `Received` | `TrackingReceived` populated — received at US warehouse. Also auto-transitioned: cron `http/cron/changeParcelStatus.cfm` finds parcels still `Received` on their `TripDate` and force-sets `TrackingShipped = tripdate` |
| 12 | `Awaiting` | `TrackingAway` populated — awaiting/pre-arrival |
| 13 | `New` | none of the above set — just created, nothing has happened yet |

Each state is "the most-advanced non-null milestone timestamp wins," with the two hold flags overriding everything else. There's also a parallel, independent boolean concept — `Paid`/`Invoiced` (does the parcel have any `invoices_items` row) and a `bPaidDelivery` flag for delivery-fee payment (tracking numbers prefixed `DR-`) — surfaced alongside `status` but not merged into it.

## 4. Related tables and key columns

- **`parcels`** (central table): `ParcelId`, `UserId`, `ReceiverId`, `TrackingNum`, `TrackingNum2`, `TripDate`, `Created`, `Debt`, `Value`, `Weight`, `Contents`, `Store`, `Service`, `GroupId`, `Location`/`iLocation`, `Notes`, `bOnHold`, `bNotOnHold`, `bPaidDelivery`, the 11 `Tracking*` milestone timestamp columns (`TrackingAway`, `TrackingReceived`, `TrackingShipped`, `TrackingDelay`, `TrackingCustom`, `TrackingProcessingCustom`, `TrackingOffice`, `TrackingSendRegion`, `TrackingOutDelivery`, `TrackingDeliveredSigned`), plus `TrackingEstDelivery`, `TrackingEstShip`, `TrackingReceivedBy`, `TrackingDeliveredSignedBy`, `TopFlag`, `awb`, `IsDR`, `payMethod1/2`, `payAmount1/2`, `parceltype`, `bNotify`, `bNotDeclared`, `length`/`width`/`high`/`dimweight`, `additional_username/firstname/lastname`, `buser`, `onlinesource`, `balanceAdjust`.
- **`users`**: `UserId`, `Username`, `BillingAddressId`, `FirstName`, `LastName`, `Organization`, `balanceAdjust`.
- **`addressbook`** (joined twice — `a1` as sender via `users.BillingAddressId`, `a2` as receiver via `receivers.AddressId`): `FirstName`/`LastName`/`FirstNameGe`/`LastNameGe`, `Organization`, `City`, `State`, `Country`, `PostalCode`, `Street1`/`Street2`, `Phone1`/`Phone2`/`Phone3`.
- **`receivers`**: `ReceiverId`, `AddressId`.
- **`invoices_items`** / **`invoices`**: consulted only via correlated `EXISTS`/`SUM` subqueries to derive `Paid`, `Invoiced`, `InvoiceId`, `invoiceamount` per parcel — no join, no FK-based aggregation table exists.
- **`payments`**: `SUM(amount)` per `UserId`, used for `paidamount` — user-level, yet computed once per parcel row.
- **`parceloffice`** / **`delivery_offices`**: resolves the current pickup office name (`officeid`, `officeName`, `officeNameGE`, `city`, `letter`, `searchPatterns`).
- **`operations`**: write-only log table (`ParcelID`, `Operation`, `OperationTime`), appended to by `changeParcelStatus.cfm` on the Received→Shipped auto-transition.
- **`config`**: single-row operational config table (`crate`, `dtexpressship`, `dtexpressest`, `dtregularship`, `dtregularest`, `expawb`, etc.), used to backfill trip/estimate dates. A cross-cutting dependency for multiple modules — migrate early (see Phase 1 in [06-phased-rollout-plan.md](06-phased-rollout-plan.md)).

Unrelated to parcels but the only other existing SQL migration artifacts in the repo: `customer_pricing_rules` (`database/migration_add_audit_columns.sql`, `migration_add_overlap_trigger.sql`) — shows the team already does ad hoc raw-SQL schema changes for pricing, not parcels.

## 5. Indexes, views, caching — none exist

No `CREATE INDEX`, `CREATE VIEW`, or materialized view definitions were found anywhere in the repository (checked all `.sql`, `.cfm`, `.cfc`). No caching layer (`cfcache`, query caching, Redis, etc.) wraps `getParcels()`. There is no formal schema/migration tracking for the parcels domain today. This is a green field for the Postgres redesign's indexing/materialization strategy — see [04-postgres-schema-design.md](04-postgres-schema-design.md).

## 6. Evidence of known problems / workarounds in the code

- `parcels.cfm` (early lines): IP-based `<cfabort>` gates and commented-out abort statements — apparent ad hoc throttling/debug leftovers, not a real fix.
- `parcels.cfm`: large commented-out blocks of one-off bulk `UPDATE`/`DELETE` maintenance queries against `parcels`/`invoices_items` left inline in the controller — evidence of manual, undocumented data-patching workarounds rather than proper migrations or cron jobs.
- `MSSQLParcelDAO.cfc` around line 1644: a bare, truncated `<!--- TODO: check` comment inside `update()`.
- Commented-out duplicate CASE blocks in `http/ApiNew/getParcelList.cfm`, `services.cfm`, `getParcels.cfm` show the same status logic iterated on and copy-pasted across many API files, left half-disabled rather than centralized.
- No explicit "this is slow" comment was found, but the sheer duplication (WHERE clause repeated 3x per call, status CASE duplicated across ~10 files, 6 scalar subqueries per row) is itself the implicit evidence of the performance problem the client is reporting.

## 7. All known duplicate copies of the status-precedence logic

At least **8-10 independent copies** exist and have already drifted out of sync:

1. `MSSQLParcelDAO.cfc` `getParcels()` (list) — lines 666-682.
2. `MSSQLParcelDAO.cfc` `read()` (detail) — lines 1334-1349, **different priority order** (see §2.3).
3. `http/bema/ajax/getParcel.cfm` — AJAX single-parcel lookup used elsewhere in the bema UI.
4. `http/cron/changeParcelStatus.cfm` — nightly job, also computes status before auto-transitioning Received→Shipped.
5. `http/ApiNew/addparcel.cfm` and `http/ApiNew2/addparcel.cfm` — customer-facing parcel-creation API, recomputes status inline for its response.
6. `http/ApiNew(2)/getParcelList.cfm`, `services.cfm`, `getParcels.cfm` — customer-facing "my parcels" API endpoints, each with their own (partially commented-out) copy of the CASE.
7. `http/bema/messages/sms_add_bulk.cfm` — bulk SMS tool, recomputes status to decide which message template to send.

**Net effect**: this is the strongest argument for the Postgres migration to introduce a single authoritative `status` (maintained column via trigger/function), rather than recomputing it ad hoc at every call site. See [04-postgres-schema-design.md](04-postgres-schema-design.md) §1.
