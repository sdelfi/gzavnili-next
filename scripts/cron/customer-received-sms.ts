#!/usr/bin/env bun
// Ported from legacy `http/cron/sendCustomerSMS.cfm` — see docs/decisions/0027-cron-
// notifications.md. "Simple sweep" category (docs/decisions/0004-scheduled-jobs.md): a VDS
// crontab entry every 120 seconds, matching legacy's own commented-out `cfschedule` interval.
import 'dotenv/config';
import { runJob } from '../../src/lib/jobs/runJob';
import { runCustomerReceivedSmsSweep } from '../../src/lib/parcels/customerReceivedSmsSweep';

runJob('customer-received-sms', runCustomerReceivedSmsSweep)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
