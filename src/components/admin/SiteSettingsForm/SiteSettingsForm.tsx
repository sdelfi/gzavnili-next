'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Input } from '@/components/ui/admin/Input';
import { Field } from '@/components/ui/admin/Field';
import { CollapsibleSection } from '@/components/ui/admin/CollapsibleSection';
import { getSiteSettings, updateSiteSettings, type SiteSettings } from '@/lib/api/bema/config';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './SiteSettingsForm.module.css';

// bema "Site Settings" (legacy `bema/config/settings.cfm`/`vwSettings.cfm`) — a single
// singleton-row form, ported section-for-section. `siteMessage2` is not modeled at all: it's
// write-only in legacy (no input for it anywhere in `vwSettings.cfm`, so every legacy submit
// silently blanks it) and never read by any view either — see docs/findings.md.
export function SiteSettingsForm() {
  const [values, setValues] = useState<SiteSettings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSiteSettings()
      .then((data) => setValues(data.config))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load settings.'));
  }, []);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const data = await updateSiteSettings(values);
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

      <label className={s.field}>
        Header Site Message
        <Textarea value={values.siteMessage} onChange={(e) => set('siteMessage', e.target.value)} rows={6} />
      </label>

      <label className={s.field}>
        Consignee
        <Textarea value={values.consignee} onChange={(e) => set('consignee', e.target.value)} rows={6} />
      </label>

      <CollapsibleSection title="Popup">
        <div className={s.checkbox}>
          <Checkbox
            label="Show site-wide announcement popup"
            checked={values.popupEnabled}
            onChange={(e) => set('popupEnabled', e.target.checked)}
          />
        </div>
        <label className={s.field}>
          Message (English)
          <Textarea value={values.popupMessageEn} onChange={(e) => set('popupMessageEn', e.target.value)} rows={6} />
        </label>
        <label className={s.field}>
          Message (Georgian)
          <Textarea value={values.popupMessageGe} onChange={(e) => set('popupMessageGe', e.target.value)} rows={6} />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Airway">
        <div className={s.row}>
          <Field label="Airway Bill" htmlFor="airwayBill">
            <Input
              id="airwayBill"
              maxLength={18}
              value={values.airwayBill}
              onChange={(e) => set('airwayBill', e.target.value)}
            />
          </Field>
          <Field label="Airway Date" htmlFor="airwayDate">
            <Input
              id="airwayDate"
              type="date"
              value={values.airwayDate ?? ''}
              onChange={(e) => set('airwayDate', e.target.value || null)}
            />
          </Field>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Regular Services">
        <div className={s.row}>
          <Field label="Regular Trip Date" htmlFor="dtRegularShip">
            <Input
              id="dtRegularShip"
              type="date"
              value={values.dtRegularShip ?? ''}
              onChange={(e) => set('dtRegularShip', e.target.value || null)}
            />
          </Field>
          <Field label="Regular Estimate Delivery" htmlFor="dtRegularEst">
            <Input
              id="dtRegularEst"
              type="date"
              value={values.dtRegularEst ?? ''}
              onChange={(e) => set('dtRegularEst', e.target.value || null)}
            />
          </Field>
          <Field label="Regular Airway Bill" htmlFor="regAwb">
            <Input id="regAwb" maxLength={18} value={values.regAwb} onChange={(e) => set('regAwb', e.target.value)} />
          </Field>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Express Services">
        <div className={s.row}>
          <Field label="Express Trip Date" htmlFor="dtExpressShip">
            <Input
              id="dtExpressShip"
              type="date"
              value={values.dtExpressShip ?? ''}
              onChange={(e) => set('dtExpressShip', e.target.value || null)}
            />
          </Field>
          <Field label="Express Estimate Delivery" htmlFor="dtExpressEst">
            <Input
              id="dtExpressEst"
              type="date"
              value={values.dtExpressEst ?? ''}
              onChange={(e) => set('dtExpressEst', e.target.value || null)}
            />
          </Field>
          <Field label="Express Airway Bill" htmlFor="expAwb">
            <Input id="expAwb" maxLength={18} value={values.expAwb} onChange={(e) => set('expAwb', e.target.value)} />
          </Field>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Cargo Services">
        <div className={s.row}>
          <Field label="Cargo Trip Date" htmlFor="dtCargoShip">
            <Input
              id="dtCargoShip"
              type="date"
              value={values.dtCargoShip ?? ''}
              onChange={(e) => set('dtCargoShip', e.target.value || null)}
            />
          </Field>
          <Field label="Cargo Estimate Delivery" htmlFor="dtCargoEst">
            <Input
              id="dtCargoEst"
              type="date"
              value={values.dtCargoEst ?? ''}
              onChange={(e) => set('dtCargoEst', e.target.value || null)}
            />
          </Field>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Lari Rate">
        <Field label="Lari Rate" htmlFor="crate">
          <Input id="crate" value={values.crate} onChange={(e) => set('crate', e.target.value)} />
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Price for parcels">
        <div className={s.row}>
          <Field label="Declared parcels price" htmlFor="declaredPrice">
            <Input
              id="declaredPrice"
              value={values.declaredPrice}
              onChange={(e) => set('declaredPrice', e.target.value)}
            />
          </Field>
          <Field label="Non-declared parcels price" htmlFor="nonDeclaredPrice">
            <Input
              id="nonDeclaredPrice"
              value={values.nonDeclaredPrice}
              onChange={(e) => set('nonDeclaredPrice', e.target.value)}
            />
          </Field>
        </div>
      </CollapsibleSection>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
