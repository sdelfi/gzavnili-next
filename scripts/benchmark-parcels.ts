#!/usr/bin/env bun
// Reproducible version of the manual benchmark behind docs/decisions/0016-parcels-
// performance.md and docs/decisions/0018-parcel-edit-history.md: point it at a disposable
// database, it seeds a realistic volume of parcels (plus the invoices/payments/receivers/
// offices/parcel_history rows the list and reports' joins touch), then drives the *real*
// /api/bema/parcels and /api/bema/parcels/reports endpoints over HTTP and reports timings —
// so re-running this after a schema or query change answers "did it get faster or slower"
// without redoing the manual work by hand.
//
// Usage:
//   bun scripts/benchmark-parcels.ts --seed --bench --confirm=<db name from DATABASE_URL>
//   bun scripts/benchmark-parcels.ts --bench                    # measure only, already seeded
//   bun scripts/benchmark-parcels.ts --reset --confirm=<db name>  # wipe what this script owns
//
// Flags:
//   --seed              Populate the database (see --scale).
//   --bench             Run the timed scenarios against a running `next dev`/`next start`.
//   --reset             Truncate every table this script writes to, then exit.
//   --scale=<n>          Parcel count to seed. Default 200000 — big enough to see the same
//                        planner behaviour as 1M without a multi-minute run every time; pass
//                        1000000 to reproduce the exact numbers in the decision doc.
//   --confirm=<name>    Required for --seed/--reset: must equal the database name in
//                        DATABASE_URL. Exists so a mistyped .env can't seed/wipe a database
//                        you didn't mean to point this at (see the safety check below — this
//                        is deliberately a *different, additional* guard from
//                        guard-local-db.mjs, since a benchmark database is not always local).
//   --api-base=<url>     Default http://localhost:3000.
//   --json=<path>        Also write the results as JSON (for diffing two runs).
//
// What it seeds, at --scale=N: N parcels, N/20 receivers, N/20 customers, N/50 addresses,
// invoices+items+payments for ~65% of parcels (the delivered ones), office assignments for
// ~1 in 5 with a tracking_office date, and — for the Parcels Reports screen
// (docs/decisions/0018-parcel-edit-history.md) — a `parcel_history` edit log: one 'Paid' row
// per delivered parcel (the same population the invoice/payment step covers), plus 1-2
// non-payment edit rows per parcel, for a combined history table on the order of 2-3x the
// parcel count — comparable to the 200k-row scale that decision doc's own measurements were
// taken against. Same shape as the manual seed in 0016, parameterised.
//
// A handful of synthetic BEMA admin accounts (`RPTADM-*`, plus `tornikero`/`gzavnili` — two
// real entries of `BEMA_GE_USERNAMES`/`BEMA_US_USERNAMES`, see parcelReports.ts) are seeded as
// the `parcel_history.updater_id` population, spanning every branch the reports' per-admin
// attribution takes: on-list GE, on-list US, off-list GE (the branch with the reproduced
// legacy total-crediting bug), off-list US, a `BemaAgent` (excluded from every figure), and a
// `NULL` updater with `updater_name = 'Online'` (money-collect.cfm's backfill shape).
//
// Safety: this is direct SQL against whatever DATABASE_URL points at — not routed through
// Prisma's migration tooling, and not subject to guard-local-db.mjs (which only wraps the
// `db:migrate`/`db:studio` scripts). Never point this at a database you are not prepared to
// have truncated. --confirm is the deliberate friction; there is no default database name.

import 'dotenv/config';
import { Client } from 'pg';
import { signAccessToken } from '../src/lib/auth/jwt';

// --- Arg parsing --------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
function flag(name: string): boolean {
  return args.has(`--${name}`);
}
function option(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = [...args].find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const doSeed = flag('seed');
const doBench = flag('bench');
const doReset = flag('reset');
const scale = Number(option('scale', '200000'));
const apiBase = option('api-base', 'http://localhost:3000')!;
const jsonOut = option('json');
const confirm = option('confirm');

if (!doSeed && !doBench && !doReset) {
  console.error('Nothing to do — pass at least one of --seed, --bench, --reset. See the file header for usage.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const targetDbName = new URL(databaseUrl).pathname.replace(/^\//, '');

if ((doSeed || doReset) && confirm !== targetDbName) {
  console.error(
    `Refusing to ${doSeed ? 'seed' : 'reset'}: pass --confirm=${targetDbName} to acknowledge this writes to\n` +
      `the "${targetDbName}" database (from DATABASE_URL). This is a deliberate extra step — there is no\n` +
      'default target, and the wrong database here means real data loss.',
  );
  process.exit(1);
}

// --- DB plumbing ---------------------------------------------------------------------------
//
// A plain `pg` client, not the app's Prisma singleton (src/lib/db.ts): the seed is bulk raw
// SQL with generate_series, which Prisma's query builder has no vocabulary for, and pg's
// simple query protocol lets one `client.query(sql)` call run a whole multi-statement batch —
// exactly how the manual benchmark ran its .sql files through psql.

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// --- Reset ----------------------------------------------------------------------------------

async function reset() {
  console.log(`Truncating benchmark tables in "${targetDbName}"…`);
  await withClient((client) =>
    client.query(`
      TRUNCATE TABLE
        parcel_history, parcel_status_history, invoices_items, payments, invoices, parceloffice,
        parcels, receivers, users, addressbook
      RESTART IDENTITY CASCADE;
    `),
  );
  console.log('Done.');
}

// --- Seed -----------------------------------------------------------------------------------

async function seed() {
  const addressCount = Math.max(1000, Math.round(scale / 25));
  const customerCount = Math.max(500, Math.round(scale / 50));

  console.log(
    `Seeding "${targetDbName}": ${scale.toLocaleString()} parcels, ${customerCount.toLocaleString()} customers, ` +
      `${addressCount.toLocaleString()} addresses…`,
  );

  await withClient(async (client) => {
    const step = async (label: string, sql: string) => {
      const start = performance.now();
      await client.query(sql);
      console.log(`  ${label}: ${((performance.now() - start) / 1000).toFixed(1)}s`);
    };

    await step(
      'addresses',
      `
      SET synchronous_commit = off;
      INSERT INTO addressbook (id, first_name, last_name, first_name_ge, last_name_ge, city, state, country,
                                cell_phone, home_phone, private_number, street1, organization)
      SELECT gen_random_uuid(),
             'First' || i, 'Last' || i,
             CASE WHEN i % 4 = 0 THEN 'ბენჩ' || i END, CASE WHEN i % 4 = 0 THEN 'მარკი' || i END,
             (ARRAY['Tbilisi','Batumi','Kutaisi','Rustavi','New York'])[1 + (i % 5)],
             'GE', (ARRAY['GE','US'])[1 + (i % 2)],
             '5991' || lpad((i % 100000)::text, 5, '0'),
             '3223' || lpad((i % 100000)::text, 5, '0'),
             '0100' || lpad((i % 1000000)::text, 7, '0'),
             i || ' Some Street',
             CASE WHEN i % 13 = 0 THEN 'Org' || i END
      FROM generate_series(1, ${addressCount}) i;
    `,
    );

    await step(
      'customers',
      `
      SET synchronous_commit = off;
      INSERT INTO users (id, username, email, first_name, last_name, billing_address_id, account_type,
                          active, confirmed, updated_at)
      SELECT gen_random_uuid(), 'BENCH' || (100000 + i), 'bench' || i || '@example.com',
             'Sender' || i, 'Family' || i,
             (SELECT id FROM addressbook OFFSET (i % ${addressCount}) LIMIT 1),
             'customer', true, true, now()
      FROM generate_series(1, ${customerCount}) i;
    `,
    );

    await step(
      'bema admins (parcel_history.updater_id population for the reports screen)',
      `
      SET synchronous_commit = off;
      -- Deliberately NOT prefixed 'BENCH' — several steps below scope themselves to
      -- "username LIKE 'BENCH%'" meaning *customers*; these must stay outside that filter.
      -- 'tornikero'/'gzavnili' are real entries of BEMA_GE_USERNAMES/BEMA_US_USERNAMES
      -- (src/lib/services/parcelReports.ts) — reusing them here exercises the reports'
      -- on-list attribution branch, not just the off-list/country-only ones.
      INSERT INTO users (id, username, email, first_name, last_name, billing_address_id,
                          account_type, admin_role, active, confirmed, updated_at)
      VALUES
        (gen_random_uuid(), 'tornikero', 'bench-admin-ge-onlist@example.com', 'Torn', 'Ikero',
         (SELECT id FROM addressbook WHERE country = 'GE' ORDER BY random() LIMIT 1),
         'bema_user', 'bema_standard', true, true, now()),
        (gen_random_uuid(), 'gzavnili', 'bench-admin-us-onlist@example.com', 'Gza', 'Vnili',
         (SELECT id FROM addressbook WHERE country = 'US' ORDER BY random() LIMIT 1),
         'bema_user', 'bema_standard', true, true, now()),
        -- Off-list, billed in Georgia: the branch carrying the reproduced legacy bug
        -- (credits the "Colected In Georgia" table but the "Colected In USA" total —
        -- see parcelReports.ts / docs/findings.md).
        (gen_random_uuid(), 'RPTADM-GE-OFFLIST', 'bench-admin-ge-offlist@example.com', 'Ge', 'Offlist',
         (SELECT id FROM addressbook WHERE country = 'GE' ORDER BY random() LIMIT 1),
         'bema_user', 'bema_standard', true, true, now()),
        (gen_random_uuid(), 'RPTADM-US-OFFLIST', 'bench-admin-us-offlist@example.com', 'Us', 'Offlist',
         (SELECT id FROM addressbook WHERE country = 'US' ORDER BY random() LIMIT 1),
         'bema_user', 'bema_standard', true, true, now()),
        -- BemaAgent: every figure on the reports screen must exclude edits this account made.
        (gen_random_uuid(), 'RPTADM-AGENT', 'bench-admin-agent@example.com', 'Agent', 'Bench',
         (SELECT id FROM addressbook WHERE country = 'US' ORDER BY random() LIMIT 1),
         'bema_user', 'bema_agent', true, true, now())
      ON CONFLICT (username) DO NOTHING;
    `,
    );

    await step(
      'receivers (one per customer, round-robin over addresses)',
      `
      SET synchronous_commit = off;
      WITH addr AS (SELECT id, row_number() OVER (ORDER BY id) - 1 AS n FROM addressbook),
           cust AS (SELECT id, row_number() OVER (ORDER BY id) - 1 AS n FROM users WHERE username LIKE 'BENCH%')
      INSERT INTO receivers (id, user_id, address_id)
      SELECT gen_random_uuid(), cust.id, addr.id
      FROM cust JOIN addr ON addr.n = cust.n % ${addressCount};
    `,
    );

    await step(
      `parcels (${scale.toLocaleString()} rows, ~5yr spread, realistic milestone mix)`,
      `
      SET synchronous_commit = off;
      WITH pair AS (
        SELECT r.id AS receiver_id, r.user_id, row_number() OVER (ORDER BY r.id) - 1 AS n
        FROM receivers r JOIN users u ON u.id = r.user_id WHERE u.username LIKE 'BENCH%'
      ), admin1 AS (SELECT id FROM users WHERE account_type = 'bema_user' LIMIT 1)
      INSERT INTO parcels (
        id, user_id, receiver_id, tracking_num, tracking_num2, awb, pcode, group_id, service,
        parcel_type, contents, store, notes, created, trip_date, weight, value, debt,
        tracking_away, tracking_received, tracking_shipped, tracking_office,
        tracking_out_delivery, tracking_delivered_signed, tracking_received_by, is_dr, top_flag
      )
      SELECT
        gen_random_uuid(), pair.user_id, pair.receiver_id,
        'BENCH' || (ARRAY['P','D','R'])[1 + (i % 3)] || lpad(i::text, 10, '0'),
        CASE WHEN i % 7 = 0 THEN 'X' || lpad(i::text, 9, '0') END,
        'AWB-' || (i % 500), 'C' || (i % ${Math.max(customerCount, 1)}), (i % 5)::text,
        (ARRAY['Regular','Express','Online','Cargo'])[1 + (i % 4)],
        (ARRAY['Personal','Online','Bussiness'])[1 + (i % 3)],
        (ARRAY['Clothes','Books','Laptop','Cosmetics','Car Parts'])[1 + (i % 5)],
        (ARRAY['Amazon','eBay','Walmart','Target'])[1 + (i % 4)],
        CASE WHEN i % 11 = 0 THEN 'Note ' || i END,
        now() - ((i % 1800) || ' days')::interval,
        now() - ((i % 1800) || ' days')::interval + interval '3 days',
        round((random() * 30 + 0.5)::numeric, 2), round((random() * 900 + 10)::numeric, 2),
        round((random() * 200)::numeric, 2),
        now() - ((i % 1800) || ' days')::interval,
        CASE WHEN i % 20 > 0 THEN now() - ((i % 1800) || ' days')::interval + interval '1 day' END,
        CASE WHEN i % 20 > 1 THEN now() - ((i % 1800) || ' days')::interval + interval '3 days' END,
        CASE WHEN i % 20 > 3 THEN now() - ((i % 1800) || ' days')::interval + interval '9 days' END,
        CASE WHEN i % 20 > 5 THEN now() - ((i % 1800) || ' days')::interval + interval '10 days' END,
        CASE WHEN i % 20 > 6 THEN now() - ((i % 1800) || ' days')::interval + interval '11 days' END,
        CASE WHEN i % 3 = 0 THEN (SELECT id FROM admin1) END,
        false, false
      FROM generate_series(1, ${scale}) i
      JOIN pair ON pair.n = i % GREATEST(${customerCount}, 1);
    `,
    );

    await step(
      'invoices + items + payments (delivered parcels)',
      `
      SET synchronous_commit = off;
      ALTER TABLE invoices DISABLE TRIGGER USER;
      ALTER TABLE invoices_items DISABLE TRIGGER USER;
      ALTER TABLE payments DISABLE TRIGGER USER;

      INSERT INTO invoices (id, user_id, invoice_date)
      SELECT gen_random_uuid(), p.user_id, p.tracking_delivered_signed
      FROM parcels p WHERE p.tracking_delivered_signed IS NOT NULL AND p.tracking_num LIKE 'BENCH%';

      WITH inv AS (
        SELECT i.id, i.user_id, i.invoice_date, row_number() OVER (ORDER BY i.id) AS n
        FROM invoices i JOIN users u ON u.id = i.user_id WHERE u.username LIKE 'BENCH%'
      ), par AS (
        SELECT p.id, p.debt, row_number() OVER (ORDER BY p.id) AS n
        FROM parcels p WHERE p.tracking_delivered_signed IS NOT NULL AND p.tracking_num LIKE 'BENCH%'
      )
      INSERT INTO invoices_items (id, invoice_id, parcel_id, amount)
      SELECT gen_random_uuid(), inv.id, par.id, coalesce(par.debt, 0) FROM inv JOIN par ON par.n = inv.n;

      INSERT INTO payments (id, user_id, payment_date, amount, payment_method_id)
      SELECT gen_random_uuid(), i.user_id, i.invoice_date, 25, 'Cash GE'
      FROM invoices i JOIN users u ON u.id = i.user_id WHERE u.username LIKE 'BENCH%';

      ALTER TABLE invoices ENABLE TRIGGER USER;
      ALTER TABLE invoices_items ENABLE TRIGGER USER;
      ALTER TABLE payments ENABLE TRIGGER USER;

      -- Denormalised columns the disabled triggers would have maintained.
      UPDATE parcels p SET is_paid = true, is_invoiced = true, invoice_id = ii.invoice_id, invoice_amount = ii.amount
      FROM invoices_items ii WHERE ii.parcel_id = p.id AND p.tracking_num LIKE 'BENCH%';

      INSERT INTO user_balances (user_id, paid_amount, invoice_amount, balance, updated_at)
      SELECT u.id, 0, 0, 0, now() FROM users u WHERE u.username LIKE 'BENCH%'
      ON CONFLICT (user_id) DO NOTHING;
      UPDATE user_balances b SET
        paid_amount = coalesce((SELECT sum(amount) FROM payments WHERE user_id = b.user_id), 0),
        invoice_amount = coalesce((SELECT sum(ii.amount) FROM invoices i JOIN invoices_items ii ON ii.invoice_id = i.id WHERE i.user_id = b.user_id), 0)
      FROM users u WHERE u.id = b.user_id AND u.username LIKE 'BENCH%';
      UPDATE user_balances SET balance = paid_amount - invoice_amount;
    `,
    );

    await step(
      "parcel history — payment events ('Paid', same population as invoices/payments)",
      `
      SET synchronous_commit = off;
      WITH admins AS (
        SELECT id, row_number() OVER (ORDER BY username) - 1 AS n
        FROM users WHERE username IN ('tornikero', 'gzavnili', 'RPTADM-GE-OFFLIST', 'RPTADM-US-OFFLIST', 'RPTADM-AGENT')
      ), delivered AS (
        SELECT p.id AS parcel_id, p.debt, p.tracking_delivered_signed AS paid_at,
               row_number() OVER (ORDER BY p.id) AS n
        FROM parcels p WHERE p.tracking_delivered_signed IS NOT NULL AND p.tracking_num LIKE 'BENCH%'
      )
      INSERT INTO parcel_history (
        id, parcel_id, edit_date_time, edit_status, value_name, old_value, new_value,
        pay_method, pay_amount, updater_id, updater_name
      )
      SELECT
        gen_random_uuid(), delivered.parcel_id, delivered.paid_at, 'delivered', 'Paid', '', '',
        -- Includes 'Debt', which the reports' payMethod != 'Debt' filter must exclude —
        -- roughly 1 in 6 rows here exist specifically to exercise that.
        (ARRAY['Cash GE', 'CreditCard GE', 'Cash', 'CreditCard', 'PayPal', 'Debt'])[1 + (delivered.n % 6)],
        coalesce(delivered.debt, 0),
        -- ~1 in 17 rows: no operator at all — money-collect.cfm's 'Online' backfill shape
        -- (NULL updater_id, updater_name = 'Online'), which the reports must still include.
        CASE WHEN delivered.n % 17 = 0 THEN NULL ELSE admins.id END,
        CASE WHEN delivered.n % 17 = 0 THEN 'Online' ELSE NULL END
      FROM delivered
      LEFT JOIN admins ON admins.n = delivered.n % 5;
    `,
    );

    await step(
      'parcel history — non-payment edit rows (History tab volume, 2 per parcel)',
      `
      SET synchronous_commit = off;
      WITH admins AS (
        SELECT id, row_number() OVER (ORDER BY username) - 1 AS n
        FROM users WHERE username IN ('tornikero', 'gzavnili', 'RPTADM-GE-OFFLIST', 'RPTADM-US-OFFLIST', 'RPTADM-AGENT')
      ), src AS (
        SELECT p.id AS parcel_id, p.created, row_number() OVER (ORDER BY p.id) AS n
        FROM parcels p WHERE p.tracking_num LIKE 'BENCH%'
      ), reps AS (SELECT generate_series(1, 2) AS rep)
      INSERT INTO parcel_history (
        id, parcel_id, edit_date_time, edit_status, value_name, old_value, new_value, updater_id
      )
      SELECT
        gen_random_uuid(), src.parcel_id, src.created + (interval '1 hour' * ((src.n + reps.rep) % 48)),
        (ARRAY['awaiting', 'received', 'shipped', 'office', 'delivered'])[1 + ((src.n + reps.rep) % 5)],
        (ARRAY['Content', 'Value', 'Debt', 'Merchant'])[1 + ((src.n + reps.rep) % 4)],
        'old-' || src.n || '-' || reps.rep, 'new-' || src.n || '-' || reps.rep,
        admins.id
      FROM src
      CROSS JOIN reps
      LEFT JOIN admins ON admins.n = (src.n + reps.rep) % 5;
    `,
    );

    await step(
      'delivery office + office assignments (~1 in 5 parcels)',
      `
      SET synchronous_commit = off;
      INSERT INTO delivery_offices (id, office_name, city, letter)
      SELECT gen_random_uuid(), 'Benchmark Office', 'Tbilisi', 'X'
      WHERE NOT EXISTS (SELECT 1 FROM delivery_offices WHERE office_name = 'Benchmark Office');

      INSERT INTO parceloffice (id, parcel_id, office_id, assigned_at)
      SELECT gen_random_uuid(), p.id, (SELECT id FROM delivery_offices WHERE office_name = 'Benchmark Office'), now()
      FROM parcels p
      WHERE p.tracking_office IS NOT NULL AND p.tracking_num LIKE 'BENCH%'
        AND (('x' || substr(md5(p.id::text), 1, 8))::bit(32)::int % 5) = 0;

      UPDATE parcels p SET office_name = 'Benchmark Office'
      FROM parceloffice po WHERE po.parcel_id = p.id AND p.tracking_num LIKE 'BENCH%';
    `,
    );

    await step('vacuum analyze', 'VACUUM ANALYZE;');
  });

  console.log('Seed complete.');
}

// --- Bench ------------------------------------------------------------------------------

type Scenario = { label: string; query: Record<string, string> };

async function buildScenarios(client: Client): Promise<Scenario[]> {
  // Real values pulled from whatever is actually in the target database, so the scenarios
  // are meaningful whether this was just seeded or is a restored production dump.
  // Sequential, not `Promise.all` — a single `pg` `Client` (as opposed to a `Pool`) can only
  // run one query at a time; issuing three concurrently just produces a deprecation warning
  // and serialises anyway.
  //
  // The sampled last name is drawn only from addresses actually reachable through a
  // receiver — `addressbook` can hold more rows than are ever attached to a parcel (this
  // script's own address pool is wider than its receiver pool), and sampling one of those
  // would benchmark a search that legitimately finds nothing.
  const { rows: lastNames } = await client.query(`
    SELECT a.last_name FROM addressbook a
    JOIN receivers r ON r.address_id = a.id
    WHERE a.last_name IS NOT NULL ORDER BY random() LIMIT 1
  `);
  const { rows: trackingNums } = await client.query(
    `SELECT tracking_num FROM parcels WHERE tracking_num IS NOT NULL ORDER BY random() LIMIT 1`,
  );
  const { rows: usernames } = await client.query(
    `SELECT username FROM users WHERE account_type = 'customer' ORDER BY random() LIMIT 1`,
  );
  const sampleLastName = lastNames[0]?.last_name ?? 'Smith';
  const sampleTrackingFragment = String(trackingNums[0]?.tracking_num ?? 'P0000000001').slice(-8);
  const sampleUsername = usernames[0]?.username ?? '';

  return [
    { label: 'no filter (default scope)', query: { allReceivers: '1' } },
    { label: 'keyword search', query: { allReceivers: '1', search: sampleLastName } },
    { label: 'tracking # search', query: { allReceivers: '1', search: sampleTrackingFragment } },
    { label: 'sender search', query: { allReceivers: '1', sender: sampleUsername } },
    { label: 'status=delivered', query: { allReceivers: '1', status: 'delivered' } },
    { label: 'status=awaiting (8-predicate waterfall)', query: { allReceivers: '1', status: 'awaiting' } },
    { label: 'paid=N', query: { allReceivers: '1', isPaid: 'N' } },
    { label: 'city=Tbilisi', query: { allReceivers: '1', city: '1' } },
    {
      label: 'extra search: delivered, one month',
      query: { allReceivers: '1', extraStatus: 'delivered', fromDate: '2025-06-01', toDate: '2025-07-01' },
    },
    { label: 'page 200', query: { allReceivers: '1', page: '200' } },
    { label: 'perPage=500', query: { allReceivers: '1', perPage: '500' } },
  ];
}

// The Parcels Reports screen (docs/decisions/0018-parcel-edit-history.md) — a handful of
// date-range windows against the same ~5-year spread the parcels/parcel_history seed uses
// (`now() - (i % 1800 days)`), so each one lands somewhere meaningfully different in that
// distribution rather than all hitting the same slice.
type ReportScenario = { label: string; query: Record<string, string> };

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildReportScenarios(): ReportScenario[] {
  return [
    {
      label: 'reports: full ~5yr range',
      query: { dateStart: ymd(daysAgo(1800)), dateEnd: ymd(daysAgo(0)) },
    },
    {
      label: 'reports: one-month window (mid-range)',
      query: { dateStart: ymd(daysAgo(430)), dateEnd: ymd(daysAgo(400)) },
    },
    {
      label: 'reports: last 24h (narrow, index-selective)',
      query: { dateStart: ymd(daysAgo(1)), dateEnd: ymd(daysAgo(0)) },
    },
    {
      label: 'reports: no results (future window)',
      query: { dateStart: ymd(daysAgo(-30)), dateEnd: ymd(daysAgo(-1)) },
    },
  ];
}

// `admin_role` in the database holds the `@map`-ed value ('bema_administrator'), not the
// Prisma enum key (`BemaAdministrator`) `signAccessToken`/`hasRole` expect — see the
// `AdminRole` enum in prisma/schema.prisma.
const ADMIN_ROLE_FROM_DB: Record<string, 'BemaStandard' | 'BemaAdministrator' | 'BemaAgent'> = {
  bema_standard: 'BemaStandard',
  bema_administrator: 'BemaAdministrator',
  bema_agent: 'BemaAgent',
};

async function mintToken(client: Client): Promise<string> {
  // Excludes BemaAgent deliberately: /api/bema/parcels/reports is BemaStandard/
  // BemaAdministrator-only (narrower than the parcels list's 3-role gate — see
  // src/app/api/bema/parcels/reports/route.ts), and this one token drives both benchmarks.
  const { rows } = await client.query(
    `SELECT id, admin_role FROM users
     WHERE account_type = 'bema_user' AND active = true AND admin_role != 'bema_agent'
     ORDER BY (admin_role = 'bema_administrator') DESC LIMIT 1`,
  );
  if (rows.length === 0) {
    throw new Error(
      'No non-agent BemaUser account exists in this database — run `bun scripts/seed-admin.ts` first ' +
        '(see its own env vars).',
    );
  }
  const role = ADMIN_ROLE_FROM_DB[rows[0].admin_role as string];
  if (!role) {
    throw new Error(`Unrecognised admin_role "${rows[0].admin_role}" on the account this script picked.`);
  }
  return signAccessToken({ sub: rows[0].id, role });
}

async function timeRequest(url: string, cookie: string): Promise<{ ms: number; total: number | null; status: number }> {
  const start = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookie } });
  const ms = performance.now() - start;
  const body = res.ok ? ((await res.json()) as { total?: number; totalIsExact?: boolean }) : null;
  const total = body ? (body.totalIsExact === false ? -(body.total ?? 0) : (body.total ?? null)) : null;
  return { ms, total, status: res.status };
}

// The reports endpoint isn't paginated, so there's no `total` to report — the row counts
// across its several sections stand in for it instead, as a sanity signal that the query
// actually found the seeded data (not just "responded fast because it found nothing").
async function timeReportRequest(
  url: string,
  cookie: string,
): Promise<{ ms: number; status: number; rows: string }> {
  const start = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookie } });
  const ms = performance.now() - start;
  if (!res.ok) return { ms, status: res.status, rows: '?' };
  const body = (await res.json()) as {
    transactions?: unknown[];
    history?: unknown[];
    collectedUs?: unknown[];
    collectedGe?: unknown[];
  };
  const rows =
    `txn=${body.transactions?.length ?? '?'} hist=${body.history?.length ?? '?'} ` +
    `us=${body.collectedUs?.length ?? '?'} ge=${body.collectedGe?.length ?? '?'}`;
  return { ms, status: res.status, rows };
}

async function bench() {
  const results = await withClient(async (client) => {
    const scenarios = await buildScenarios(client);
    const reportScenarios = buildReportScenarios();
    const token = await mintToken(client);
    const cookie = `bema_access_token=${token}`;

    console.log(`Benchmarking against ${apiBase} (3 warm-up + 1 measured request per scenario)…\n`);

    const rows: { label: string; ms: number; status: number; total: string }[] = [];
    for (const scenario of scenarios) {
      const url = `${apiBase}/api/bema/parcels?${new URLSearchParams(scenario.query).toString()}`;
      let last = { ms: 0, total: null as number | null, status: 0 };
      for (let i = 0; i < 4; i++) {
        last = await timeRequest(url, cookie);
      }
      const total = last.total === null ? '?' : last.total < 0 ? `${-last.total}+` : String(last.total);
      rows.push({ label: scenario.label, ms: last.ms, status: last.status, total });
    }

    for (const scenario of reportScenarios) {
      const url = `${apiBase}/api/bema/parcels/reports?${new URLSearchParams(scenario.query).toString()}`;
      let last = { ms: 0, status: 0, rows: '?' };
      for (let i = 0; i < 4; i++) {
        last = await timeReportRequest(url, cookie);
      }
      rows.push({ label: scenario.label, ms: last.ms, status: last.status, total: last.rows });
    }
    return rows;
  });

  const labelWidth = Math.max(...results.map((r) => r.label.length)) + 2;
  for (const r of results) {
    const flag = r.status !== 200 ? `  [HTTP ${r.status}]` : '';
    console.log(`${r.label.padEnd(labelWidth)} ${r.ms.toFixed(1).padStart(8)} ms   total=${r.total}${flag}`);
  }

  if (jsonOut) {
    await Bun.write(jsonOut, JSON.stringify({ scale, apiBase, at: new Date().toISOString(), results }, null, 2));
    console.log(`\nWrote ${jsonOut}`);
  }
}

// --- Main -----------------------------------------------------------------------------------

async function main() {
  if (doReset) await reset();
  if (doSeed) await seed();
  if (doBench) await bench();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
