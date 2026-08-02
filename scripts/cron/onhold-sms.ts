#!/usr/bin/env bun
// Ported from legacy `http/cron/sendOnholdSMS.cfm` — see docs/decisions/0027-cron-
// notifications.md. "Simple sweep" category (docs/decisions/0004-scheduled-jobs.md): a VDS
// crontab entry, same 600-second interval as legacy's own commented-out `cfschedule`.
import 'dotenv/config';
import { runJob } from '../../src/lib/jobs/runJob';
import { runOnholdSmsSweep } from '../../src/lib/parcels/onholdSmsSweep';

runJob('onhold-sms', runOnholdSmsSweep)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
