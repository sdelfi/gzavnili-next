#!/usr/bin/env bun
// Bootstraps the very first bema admin account. There's no other way to create one — the
// admin panel is itself login-gated, and account creation goes through it — so this exists
// specifically to break that chicken-and-egg problem. Safe to run any number of times: it
// only ever creates an account when zero `BemaUser` accounts exist yet; if one already
// exists it does nothing (no update, no overwrite) — run again with different env vars
// won't touch an existing account, so it can't be used to reset someone's password by
// accident.
import 'dotenv/config';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const existing = await db.user.count({ where: { accountType: 'BemaUser' } });
  if (existing > 0) {
    console.log(`[seed-admin] ${existing} BEMA user(s) already exist — nothing to do.`);
    return;
  }

  const username = process.env.BEMA_SEED_USERNAME;
  const email = process.env.BEMA_SEED_EMAIL;
  const password = process.env.BEMA_SEED_PASSWORD;
  if (!username || !email || !password) {
    console.error(
      '[seed-admin] No BEMA user exists yet, but BEMA_SEED_USERNAME/BEMA_SEED_EMAIL/BEMA_SEED_PASSWORD ' +
        'are not all set — refusing to guess. Set them (e.g. in the environment for this one invocation) and re-run.',
    );
    process.exitCode = 1;
    return;
  }

  const { hash, algo } = await hashPassword(password);
  const user = await db.user.create({
    data: {
      username,
      email,
      firstName: 'Admin',
      lastName: 'User',
      accountType: 'BemaUser',
      adminRole: 'BemaAdministrator',
      active: true,
      confirmed: true,
      passwordHash: hash,
      passwordAlgo: algo,
    },
  });
  console.log(`[seed-admin] Created BEMA administrator "${user.username}" (${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
