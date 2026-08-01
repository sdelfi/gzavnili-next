'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { CollapsibleSection } from '@/components/ui/admin/CollapsibleSection';
import { Textarea } from '@/components/ui/admin/Textarea';
import { routes } from '@/lib/routes';
import { createPage, updatePage } from '@/lib/api/bema/pages';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './PageForm.module.css';

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ge', label: 'Georgian' },
];

export type PageFormValues = {
  slug: string;
  locale: 'en' | 'ge';
  name: string;
  header: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

const FIELD_LABELS: Record<string, string> = {
  slug: 'URL',
  locale: 'Locale',
  name: 'Name',
  header: 'Header',
  content: 'Content',
  metaTitle: 'Meta Title',
  metaDescription: 'Meta Description',
  metaKeywords: 'Meta Keywords',
};

// bema "Site Page" create/edit form — legacy `bema/content/page_edit.cfm`. Content is a
// plain `<textarea>` of raw HTML rather than a WYSIWYG editor (legacy uses TinyMCE) — a
// deliberate simplification, matching the bema panel's "functionality over pixel/tooling
// parity" brief (docs/decisions/0011-bema-admin.md); pulling in a rich-text editor dependency
// wasn't asked for. See docs/decisions/0013-site-pages-cms.md.
export function PageForm({
  initialValues,
  pageId,
  returnTo,
}: {
  initialValues?: Partial<PageFormValues>;
  pageId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PageFormValues>({
    slug: initialValues?.slug ?? '',
    locale: initialValues?.locale ?? 'en',
    name: initialValues?.name ?? '',
    header: initialValues?.header ?? '',
    content: initialValues?.content ?? '',
    metaTitle: initialValues?.metaTitle ?? '',
    metaDescription: initialValues?.metaDescription ?? '',
    metaKeywords: initialValues?.metaKeywords ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      if (pageId) {
        await updatePage(pageId, values);
      } else {
        await createPage(values);
      }
      router.push(returnTo || routes.bema.pages());
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body, FIELD_LABELS) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />

      <CollapsibleSection title="Page Details">
        <div className={s.grid}>
          <label className={s.field}>
            Name
            <Input value={values.name} onChange={(e) => set('name', e.target.value)} required />
            <span className={s.hint}>Internal admin label, not shown publicly.</span>
          </label>
          <div className={s.field}>
            Locale
            <Select
              instanceId="page-form-locale"
              options={LOCALE_OPTIONS}
              value={values.locale}
              onChange={(value) => set('locale', value as 'en' | 'ge')}
            />
          </div>

          <label className={s.field}>
            URL
            <Input
              value={values.slug}
              onChange={(e) => set('slug', e.target.value)}
              required
              placeholder="prices.html"
            />
            <span className={s.hint}>
              Public URL: {values.locale === 'ge' ? '/ge/' : '/'}
              {values.slug || '…'}
            </span>
          </label>
          <label className={s.field}>
            Header
            <Input value={values.header} onChange={(e) => set('header', e.target.value)} />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Content">
        <label className={s.field}>
          <Textarea
            className={s.contentArea}
            value={values.content}
            onChange={(e) => set('content', e.target.value)}
            rows={20}
          />
          <span className={s.hint}>Raw HTML — matches the legacy page body exactly.</span>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="SEO">
        <div className={s.grid}>
          <label className={s.field}>
            Meta Title
            <Input value={values.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
          </label>
          <label className={s.field}>
            Meta Keywords
            <Input value={values.metaKeywords} onChange={(e) => set('metaKeywords', e.target.value)} />
          </label>
          <label className={s.field}>
            Meta Description
            <Input value={values.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
          </label>
        </div>
      </CollapsibleSection>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="warning" onClick={() => router.push(returnTo || routes.bema.pages())}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
