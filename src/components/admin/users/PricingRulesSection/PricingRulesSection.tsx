'use client';

import { useCallback, useEffect, useState } from 'react';
import { Table, type Column } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createPricingRule, deletePricingRule, listPricingRules, restorePricingRule } from '@/lib/api/bema/pricingRules';
import { ApiError } from '@/lib/api/http';
import s from './PricingRulesSection.module.css';

type PricingRule = {
  id: string;
  serviceType: 'Regular' | 'Express' | 'Cargo';
  mode: 'FixedPrice' | 'Discount';
  value: string;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
  // Soft-delete flag — legacy "Remove"/"Restore" toggle this, not a real row delete. The
  // Status column keys off this alone, not the valid-date window (see `isWithinValidWindow`).
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

const SERVICE_TYPE_OPTIONS = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Express', label: 'Express' },
  { value: 'Cargo', label: 'Cargo' },
];
const MODE_OPTIONS = [
  { value: 'FixedPrice', label: 'Fixed Price' },
  { value: 'Discount', label: 'Discount' },
];

const EMPTY_RULE = { serviceType: '', mode: '', value: '', validFrom: '', validTo: '', notes: '' };

function isWithinValidWindow(rule: PricingRule) {
  const now = new Date();
  return new Date(rule.validFrom) <= now && (!rule.validTo || new Date(rule.validTo) >= now);
}

// "Pricing Rules (Custom Rates & Discounts)" — legacy "Edit Customer" screen's per-customer
// shipping rate/discount overrides. Only meaningful for existing Customer accounts (a new,
// unsaved record has no `userId` to attach rules to yet) — see
// docs/decisions/0011-bema-admin.md.
export function PricingRulesSection({ userId }: { userId: string }) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    return listPricingRules<PricingRule>(userId).then((data) => setRules(data.rules));
  }, [userId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load pricing rules.'));
  }, [load]);

  const visibleRules = activeOnly ? rules.filter((r) => r.isActive && isWithinValidWindow(r)) : rules;

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.mode === 'Discount' && (Number(form.value) < 0 || Number(form.value) > 100)) {
      setError('Discount must be between 0 and 100.');
      return;
    }

    setSubmitting(true);
    try {
      await createPricingRule(userId, { ...form, value: Number(form.value), validTo: form.validTo || null });
      setForm(EMPTY_RULE);
      await load();
    } catch (err) {
      const fallback = 'Failed to add rule.';
      if (err instanceof ApiError) {
        const body = err.body as { error?: { formErrors?: string[] } | string } | null;
        const formError = typeof body?.error === 'object' ? body.error.formErrors?.[0] : body?.error;
        setError(formError ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(ruleId: string) {
    await deletePricingRule(userId, ruleId);
    await load();
  }

  async function handleRestore(ruleId: string) {
    setError(null);
    try {
      await restorePricingRule(userId, ruleId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError && typeof err.body === 'object' && (err.body as { error?: string })?.error
        ? (err.body as { error: string }).error
        : 'Failed to restore rule.');
    }
  }

  const columns: Column<PricingRule>[] = [
    { key: 'serviceType', label: 'Service Type' },
    { key: 'mode', label: 'Type', render: (r) => (r.mode === 'FixedPrice' ? 'Fixed Price' : 'Discount') },
    { key: 'value', label: 'Value', render: (r) => (r.mode === 'FixedPrice' ? `$${r.value}/kg` : `${r.value}%`) },
    {
      key: 'validPeriod',
      label: 'Valid Period',
      render: (r) => `${r.validFrom.slice(0, 10)} – ${r.validTo ? r.validTo.slice(0, 10) : '∞'}`,
    },
    { key: 'notes', label: 'Notes', render: (r) => r.notes ?? '' },
    { key: 'status', label: 'Status', render: (r) => (r.isActive ? 'Active' : 'Inactive') },
    { key: 'createdAt', label: 'Created', render: (r) => r.createdAt.slice(0, 10) },
    { key: 'createdBy', label: 'Created By', render: (r) => r.createdBy ?? '' },
    { key: 'updatedAt', label: 'Modified', render: (r) => r.updatedAt.slice(0, 10) },
    { key: 'updatedBy', label: 'Modified By', render: (r) => r.updatedBy ?? '' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) =>
        r.isActive ? (
          <Button type="button" variant="danger" onClick={() => handleDeactivate(r.id)}>
            Deactivate
          </Button>
        ) : (
          <Button type="button" variant="warning" onClick={() => handleRestore(r.id)}>
            Restore
          </Button>
        ),
    },
  ];

  return (
    <div className={s.section}>
      <h3 className={s.heading}>Pricing Rules (Custom Rates &amp; Discounts)</h3>
      <p className={s.hint}>Set custom shipping rates or discounts for this customer by service type and date range.</p>

      {error && <Alert variant="error">{error}</Alert>}

      <Button type="button" variant="secondary" onClick={() => setActiveOnly((prev) => !prev)}>
        {activeOnly ? 'Show All Rules' : 'Showing active rules only'}
      </Button>

      <Table columns={columns} rows={visibleRules} getRowKey={(r) => r.id} emptyMessage="No pricing rules defined yet" />

      <form className={s.addForm} onSubmit={handleAddRule}>
        <h4 className={s.addHeading}>Add New Pricing Rule</h4>
        <div className={s.addGrid}>
          <div className={s.field}>
            Service Type
            <Select
              instanceId="pricing-rule-service-type"
              options={SERVICE_TYPE_OPTIONS}
              value={form.serviceType}
              onChange={(v) => setForm((f) => ({ ...f, serviceType: v }))}
              placeholder="-- Select --"
            />
          </div>
          <div className={s.field}>
            Mode
            <Select
              instanceId="pricing-rule-mode"
              options={MODE_OPTIONS}
              value={form.mode}
              onChange={(v) => setForm((f) => ({ ...f, mode: v }))}
              placeholder="-- Select --"
            />
          </div>
          <label className={s.field}>
            Price/Discount
            <Input
              placeholder="e.g. 7.50 or 10"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
            <span className={s.fieldHint}>{form.mode === 'Discount' ? '% Discount (0-100)' : 'USD per KG'}</span>
          </label>
          <label className={s.field}>
            From Date
            <Input
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            />
          </label>
          <label className={s.field}>
            To Date (optional)
            <Input
              type="date"
              value={form.validTo}
              onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
            />
            <span className={s.fieldHint}>Leave blank for no expiration</span>
          </label>
          <label className={s.field}>
            Notes
            <Input
              placeholder="e.g., May promotional discount"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
        <div className={s.addActions}>
          <Button type="submit" disabled={submitting}>
            Add Rule
          </Button>
          <Button type="button" variant="secondary" onClick={() => setForm(EMPTY_RULE)}>
            Clear
          </Button>
        </div>
      </form>
    </div>
  );
}
