import { z } from 'zod';

// `slug` mirrors the legacy `pages.Url` column minus its locale prefix (next-intl's
// `[locale]` segment already owns that) and minus the leading slash — e.g. legacy
// `/parcel-service.html` and `/ge/parcel-service.html` both become slug `parcel-service.html`,
// distinguished by `locale` instead of by two different URL strings. Leading/trailing slashes
// rejected outright rather than silently stripped, so what's stored is exactly what the
// catch-all route (`src/app/[locale]/[...slug]/page.tsx`) will look up.
export const pageSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required.')
    .max(255)
    .regex(/^[^/].*[^/]$|^[^/]$/, 'Slug must not start or end with a slash.'),
  locale: z.enum(['en', 'ge']),
  name: z.string().min(1, 'Name is required.').max(100),
  header: z.string().max(255).nullable().optional(),
  content: z.string(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
  metaKeywords: z.string().max(255).nullable().optional(),
});

export const listPagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().optional(),
  locale: z.enum(['en', 'ge']).optional(),
  sort: z.enum(['name', 'slug', 'updatedAt']).default('name'),
  dir: z.enum(['asc', 'desc']).default('asc'),
});
