'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorList } from '@/components/ui/Alert';
import { getPopupConfig, updatePopupConfig, type PopupConfig } from '@/lib/api/bema/config';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './SiteSettingsForm.module.css';

// bema "Site Settings" → "Popup" section (legacy `bema/config/settings.cfm`'s `ePopup`/
// `PopupMessageen`/`PopupMessagege` fields) — see docs/decisions/0014-site-popup.md. Only the
// popup fields are built here; the rest of legacy's Site Settings mega-form (Airway Bill/Date,
// shipping dates+AWB, Lari Rate, parcel pricing) belongs to the not-yet-built parcels domain.
export function SiteSettingsForm() {
  const [values, setValues] = useState<PopupConfig | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPopupConfig()
      .then((data) => setValues(data.config))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load settings.'));
  }, []);

  function set<K extends keyof PopupConfig>(key: K, value: PopupConfig[K]) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const data = await updatePopupConfig(values);
      setValues(data.config);
      setSaved(true);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <ErrorList errors={[loadError]} />;
  if (!values) return <div>Loading…</div>;

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />
      {saved && <p className={s.saved}>Saved.</p>}

      <label className={s.checkbox}>
        <input
          type="checkbox"
          checked={values.popupEnabled}
          onChange={(e) => set('popupEnabled', e.target.checked)}
        />
        Show site-wide announcement popup
      </label>

      <label className={s.field}>
        Message (English)
        <textarea
          className={s.textarea}
          value={values.popupMessageEn}
          onChange={(e) => set('popupMessageEn', e.target.value)}
          rows={6}
        />
      </label>

      <label className={s.field}>
        Message (Georgian)
        <textarea
          className={s.textarea}
          value={values.popupMessageGe}
          onChange={(e) => set('popupMessageGe', e.target.value)}
          rows={6}
        />
      </label>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
