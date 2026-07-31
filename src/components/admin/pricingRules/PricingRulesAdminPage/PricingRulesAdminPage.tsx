'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageHeading } from '@/components/ui/PageHeading';
import { CustomerPicker } from '@/components/ui/CustomerPicker';
import { routes } from '@/lib/routes';
import {
  deletePricingRule,
  listAllPricingRules,
  restorePricingRule,
  pricingRulesAdminFiltersFromQuery,
  pricingRulesAdminFiltersToQuery,
  type PricingRulesAdminFiltersState,
} from '@/lib/api/bema/pricingRules';
import s from './PricingRulesAdminPage.module.css';

type AdminPricingRule = {
  id: string;
  serviceType: 'Regular' | 'Express' | 'Cargo';
  mode: 'FixedPrice' | 'Discount';
  value: string;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; username: string };
};

const SERVICE_TYPE_OPTIONS = [
  { value: '', label: '-- All --' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Express', label: 'Express' },
  { value: 'Cargo', label: 'Cargo' },
];
const MODE_OPTIONS = [
  { value: '', label: '-- All --' },
  { value: 'FixedPrice', label: 'Fixed Price per KG' },
  { value: 'Discount', label: 'Percentage Discount' },
];
const PAGE_SIZE_OPTIONS = ['25', '50', '100'].map((v) => ({ value: v, label: v }));

// "Pricing Rules Administration" — legacy `bema/pricing_global_rules.cfm` /
// `vwGlobalPricingRulesAdmin.cfm`: the cross-customer counterpart to the per-customer
// Pricing Rules section on the customer edit form. BemaAdministrator-only (see
// src/app/api/bema/pricing-rules/route.ts).
//
// Matches legacy's two-tier filter behavior: Page Size and Active Only apply immediately on
// change, while Service Type/Mode/Date Range/Customer only take effect on "Apply Filters"
// (or Enter in a date field) — mirrors `applyGlobalFilters()` vs. the page-size/active-only
// change handlers in the legacy JS.
export function PricingRulesAdminPage() {
  const searchParams = useSearchParams();
  // Remounted (via `key`) whenever the URL's filters change, so `pending`'s initial value —
  // the only time it should ever pick up an external filter change — stays a plain
  // `useState` initializer instead of a same-render `useEffect` sync. Same idiom as
  // `ParcelListPage`'s `key={filterKey}` on `ParcelFilters`.
  return <PricingRulesAdminPageInner key={searchParams.toString()} />;
}

function PricingRulesAdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = pricingRulesAdminFiltersFromQuery(searchParams);

  const [pending, setPending] = useState(filters);
  const [rows, setRows] = useState<AdminPricingRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllPricingRules<AdminPricingRule>(filters)
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load pricing rules.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  function pushFilters(next: PricingRulesAdminFiltersState) {
    router.push(`${routes.bema.pricingRules()}?${pricingRulesAdminFiltersToQuery(next).toString()}`);
  }

  function applyFilters() {
    pushFilters({ ...pending, page: 1 });
  }

  function resetFilters() {
    const reset: PricingRulesAdminFiltersState = {
      page: 1,
      perPage: 25,
      serviceType: '',
      mode: '',
      validFromFrom: '',
      validFromTo: '',
      customerId: '',
      customerLabel: '',
      activeOnly: true,
    };
    setPending(reset);
    pushFilters(reset);
  }

  async function reload() {
    const data = await listAllPricingRules<AdminPricingRule>(filters);
    setRows(data.items);
    setTotal(data.total);
  }

  async function handleDeactivate(rule: AdminPricingRule) {
    await deletePricingRule(rule.user.id, rule.id);
    await reload();
  }

  async function handleRestore(rule: AdminPricingRule) {
    setError(null);
    try {
      await restorePricingRule(rule.user.id, rule.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore rule.');
    }
  }

  const columns: Column<AdminPricingRule>[] = [
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => (
        <Link href={routes.bema.userEdit(r.user.id)}>
          {r.user.lastName ?? ''}, {r.user.firstName ?? ''}
        </Link>
      ),
    },
    { key: 'serviceType', label: 'Service Type' },
    { key: 'mode', label: 'Type', render: (r) => (r.mode === 'FixedPrice' ? 'Fixed Price' : 'Discount') },
    { key: 'value', label: 'Value', render: (r) => (r.mode === 'FixedPrice' ? `$${r.value}/kg` : `${r.value}%`) },
    {
      key: 'validPeriod',
      label: 'Valid Period',
      render: (r) => `${r.validFrom.slice(0, 10)} – ${r.validTo ? r.validTo.slice(0, 10) : '∞'}`,
    },
    { key: 'notes', label: 'Notes', render: (r) => r.notes ?? '' },
    { key: 'createdAt', label: 'Created', render: (r) => r.createdAt.slice(0, 10) },
    { key: 'createdBy', label: 'Created By', render: (r) => r.createdBy ?? '' },
    { key: 'updatedAt', label: 'Modified', render: (r) => r.updatedAt.slice(0, 10) },
    { key: 'updatedBy', label: 'Modified By', render: (r) => r.updatedBy ?? '' },
    { key: 'status', label: 'Status', render: (r) => (r.isActive ? 'Active' : 'Inactive') },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) =>
        r.isActive ? (
          <Button type="button" variant="danger" onClick={() => handleDeactivate(r)}>
            Deactivate
          </Button>
        ) : (
          <Button type="button" variant="warning" onClick={() => handleRestore(r)}>
            Restore
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeading>Pricing Rules Administration</PageHeading>
      <p className={s.subtitle}>View and manage all customer pricing rules across the system.</p>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filters}>
        <div className={s.filterGrid}>
          <div className={s.field}>
            Service Type
            <Select
              instanceId="pricing-admin-service-type"
              options={SERVICE_TYPE_OPTIONS}
              value={pending.serviceType}
              onChange={(v) => setPending((p) => ({ ...p, serviceType: v }))}
            />
          </div>
          <div className={s.field}>
            Pricing Mode
            <Select
              instanceId="pricing-admin-mode"
              options={MODE_OPTIONS}
              value={pending.mode}
              onChange={(v) => setPending((p) => ({ ...p, mode: v }))}
            />
          </div>
          <label className={s.field}>
            From Date
            <Input
              type="date"
              value={pending.validFromFrom}
              onChange={(e) => setPending((p) => ({ ...p, validFromFrom: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </label>
          <label className={s.field}>
            To Date
            <Input
              type="date"
              value={pending.validFromTo}
              onChange={(e) => setPending((p) => ({ ...p, validFromTo: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </label>
          <div className={s.field}>
            Customer
            <CustomerPicker
              value={pending.customerId}
              label={pending.customerLabel}
              onChange={(customer) => setPending((p) => ({ ...p, customerId: customer.id, customerLabel: customer.label }))}
              onClear={() => setPending((p) => ({ ...p, customerId: '', customerLabel: '' }))}
            />
          </div>
          <div className={s.field}>
            Rows per page
            <Select
              instanceId="pricing-admin-page-size"
              options={PAGE_SIZE_OPTIONS}
              value={String(filters.perPage)}
              onChange={(v) => pushFilters({ ...filters, perPage: Number(v) || 25, page: 1 })}
            />
          </div>
        </div>

        <div className={s.activeRow}>
          <Checkbox
            label="Active Only"
            checked={filters.activeOnly}
            onChange={(e) => pushFilters({ ...filters, activeOnly: e.target.checked, page: 1 })}
          />
        </div>

        <div className={s.filterActions}>
          <Button type="button" onClick={applyFilters}>
            Apply Filters
          </Button>
          <Button type="button" variant="secondary" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>

      <p className={s.resultsInfo}>
        {loading
          ? 'Loading…'
          : total === 0
            ? 'No pricing rules found'
            : `Showing ${(filters.page - 1) * filters.perPage + 1}–${Math.min(filters.page * filters.perPage, total)} of ${total} total rules`}
      </p>

      <Table columns={columns} rows={rows} getRowKey={(r) => r.id} emptyMessage="No pricing rules found" />

      <Pagination
        page={filters.page}
        perPage={filters.perPage}
        total={total}
        onPageChange={(p) => pushFilters({ ...filters, page: p })}
      />
    </div>
  );
}
