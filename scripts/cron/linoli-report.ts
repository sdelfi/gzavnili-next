#!/usr/bin/env bun
// Ported from legacy `http/cron/sendLinoli.cfm` — see docs/decisions/0027-cron-notifications.md.
// "Simple sweep" category (docs/decisions/0004-scheduled-jobs.md): a VDS crontab entry, once
// daily (legacy has no `cfschedule` block at all for this file — no source interval to match;
// "once a day" matches the report's own "today's received parcels" scope).
import 'dotenv/config';
import { runJob } from '../../src/lib/jobs/runJob';
import { runLinoliReport } from '../../src/lib/parcels/linoliReport';

runJob('linoli-report', runLinoliReport)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
