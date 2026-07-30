import { revalidatePath } from 'next/cache';

// Legacy writes a fresh `{sha1(url)}.json` cache file on every page save specifically so the
// public site never re-reads the DB for content that hasn't changed (MSSQLPageDAO.cfc). The
// direct Next.js equivalent is on-demand ISR: the DB stays the source of truth (no hand-rolled
// file cache), and `generateStaticParams` pre-renders every known page at build time — this
// just tells Next.js "this one path just changed, regenerate it now" instead of waiting for
// the next full deploy. See docs/decisions/0013-site-pages-cms.md.
export function revalidatePagePath(locale: string, slug: string) {
  const path = locale === 'ge' ? `/ge/${slug}` : `/${slug}`;
  revalidatePath(path);
}
