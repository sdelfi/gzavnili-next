import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';

// Generic "Site Pages" CMS renderer — legacy's `Static.doGet()` + `views/static.html`
// (`#page.getContent()#`, nothing else). Any URL not matched by a more specific route
// (Next.js always prefers a static/literal route match over a catch-all, so
// `/authenticate/login` etc. are untouched by this) falls through here and gets looked up
// in Postgres by `(locale, slug)`. See docs/decisions/0013-site-pages-cms.md for the full
// architecture, including why this stays a plain DB read backed by ISR instead of the
// legacy hand-rolled `{sha1(url)}.json` file cache.
export async function generateStaticParams() {
  const pages = await db.page.findMany({ select: { locale: true, slug: true } });
  return pages
    .filter((p) => p.slug !== 'index.html') // superseded by the real homepage, see below
    .map((p) => ({ locale: p.locale, slug: p.slug.split('/') }));
}

async function getPage(locale: string, slug: string[]) {
  return db.page.findUnique({ where: { locale_slug: { locale, slug: slug.join('/') } } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPage(locale, slug);
  if (!page) return {};
  return {
    title: page.metaTitle || page.name,
    description: page.metaDescription || undefined,
    keywords: page.metaKeywords || undefined,
  };
}

export default async function CmsPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params;

  // Legacy 301-redirects `/index.html` to `/` for canonicalization (both ultimately render
  // the same CMS page content, just through the homepage's own view wrapper instead of the
  // generic one) — this stack's homepage is already a hand-built React port of that same
  // content (see PROGRESS.md), so the CMS row for `index.html` has nothing left to serve.
  if (slug.join('/') === 'index.html') {
    redirect(locale === 'ge' ? '/ge/' : '/');
  }

  const page = await getPage(locale, slug);
  if (!page) notFound();

  // Raw HTML by design — this is admin-authored content (bema Site Pages), the same trust
  // boundary as the legacy CMS's own WYSIWYG-produced markup, not user input.
  return <div dangerouslySetInnerHTML={{ __html: page.content }} />;
}

// Pages not yet in generateStaticParams (created after the last build) still render and
// cache on first request; every page is thereafter only regenerated on-demand via
// revalidatePagePath(), matching legacy's "write the file when it's saved, not before" —
// not a timer.
export const dynamicParams = true;
export const revalidate = false;
