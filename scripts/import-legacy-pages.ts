#!/usr/bin/env bun
// One-time ETL: imports the legacy bema "Site Pages" content cache (originally
// `../http/include/pages/*.json` in the sibling legacy checkout, one file per page, named
// `{sha1(url)}.json` — see MSSQLPageDAO.cfc) into this project's Postgres `pages` table. The
// source JSON files are snapshotted into `scripts/data/legacy-pages/` (committed to this
// repo) rather than read from that sibling checkout, because the checkout only exists on a
// dev machine — production never has it. See docs/decisions/0013-site-pages-cms.md for the
// full investigation that established these files are genuinely live content, not
// dead/orphaned.
//
// Idempotent: upserts on (locale, slug), safe to re-run. If the legacy source ever changes
// again, re-copy fresh files into `scripts/data/legacy-pages/` before re-running. Run with
// `bun run import:legacy-pages` (guarded to local DBs only, like db:migrate).
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../src/lib/db';

const LEGACY_PAGES_DIR = path.resolve(__dirname, 'data/legacy-pages');

type LegacyPage = {
  url: string;
  name: string;
  header?: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
};

function toLocaleSlug(url: string): { locale: 'en' | 'ge'; slug: string } {
  const trimmed = url.replace(/^\/+/, '');
  if (trimmed.startsWith('ge/')) {
    return { locale: 'ge', slug: trimmed.slice('ge/'.length) };
  }
  return { locale: 'en', slug: trimmed };
}

async function main() {
  const files = (await readdir(LEGACY_PAGES_DIR)).filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} legacy page files in ${LEGACY_PAGES_DIR}`);

  let imported = 0;
  let skipped = 0;
  for (const file of files) {
    const raw = await readFile(path.join(LEGACY_PAGES_DIR, file), 'utf-8');
    let parsed: LegacyPage;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`  skip ${file}: invalid JSON`);
      skipped++;
      continue;
    }
    if (!parsed.url || !parsed.content) {
      console.warn(`  skip ${file}: missing url/content`);
      skipped++;
      continue;
    }
    const { locale, slug } = toLocaleSlug(parsed.url);

    await db.page.upsert({
      where: { locale_slug: { locale, slug } },
      create: {
        locale,
        slug,
        name: parsed.name || slug,
        header: parsed.header || null,
        content: parsed.content,
        metaTitle: parsed.metaTitle || null,
        metaDescription: parsed.metaDescription || null,
        metaKeywords: parsed.metaKeywords || null,
      },
      update: {
        name: parsed.name || slug,
        header: parsed.header || null,
        content: parsed.content,
        metaTitle: parsed.metaTitle || null,
        metaDescription: parsed.metaDescription || null,
        metaKeywords: parsed.metaKeywords || null,
      },
    });
    imported++;
  }

  console.log(`Imported/updated ${imported} pages, skipped ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
