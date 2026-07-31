'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { ParcelFilters } from '@/components/admin/parcels/ParcelFilters';
import { ParcelExtraFilters } from '@/components/admin/parcels/ParcelExtraFilters';
import { ParcelOperationsBar, type OperationRequest } from '@/components/admin/parcels/ParcelOperationsBar';
import { ParcelGroupCard } from '@/components/admin/parcels/ParcelGroupCard';
import { groupParcels, selectionDebt } from '@/lib/parcels/groupParcels';
import { routes } from '@/lib/routes';
import {
  EMPTY_PARCEL_FILTERS,
  clearParcelHold,
  deleteParcel,
  listParcels,
  parcelFiltersFromQuery,
  parcelFiltersToQuery,
  parcelsExportUrl,
  runParcelOperation,
  type ParcelFiltersState,
} from '@/lib/api/bema/parcels';
import { listUsers } from '@/lib/api/bema/users';
import type { ParcelListItem } from '@/lib/parcels/types';
import s from './ParcelListPage.module.css';

// The bema parcels list — the screen `bema/parcels/parcels.cfm` + `vwParcels_work2.cfm` were.
// This component owns the three things the legacy page held in URL params and jQuery globals:
// which filters are applied, which parcels are ticked, and what the bulk toolbar does with
// them. Everything it renders lives in its own component.
//
// Filters live in the URL (like legacy's GET forms) so a filtered list stays bookmarkable and
// survives Back; the selection deliberately does not, and is cleared whenever the rows change
// underneath it.
//
// Not ported, because it is dead in legacy: the "Recent Parcels" block above the main list.
// Its render is gated on `<cfif grps.recordCount and 0>` — permanently false — so the second
// `getParcels()` call feeding it (the same query again, ordered differently, over the last 30
// days) only ever cost time. Building the UI for something no operator has seen in years
// would be porting a bug, so this screen issues one query, not two.

/** BEMA accounts, for the "Received By" filter and Delivery Request's "assign to" select. */
type AdminOption = { id: string; name: string };

export function ParcelListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useBemaAuth();

  const [items, setItems] = useState<ParcelListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [lariRate, setLariRate] = useState<number | null>(null);
  const [forcedReceivedBy, setForcedReceivedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  // Bumped after any write so the list refetches without the filters having changed.
  const [reloadToken, setReloadToken] = useState(0);
  // The request whose results `items` currently holds. `loading` is derived from it rather
  // than being its own flag flipped at the top of the fetch effect — same information, and
  // it stays correct while a second request is in flight.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const filters = useMemo(() => parcelFiltersFromQuery(searchParams), [searchParams]);
  const isAgent = user?.adminRole === 'BemaAgent';
  // Legacy hides the whole operations toolbar and the extra-search form from agents, and
  // guards the operation endpoint with the two administrator roles.
  const canOperate = !isAgent;
  const deliveryRequest = filters.deliveryRequest === '1';

  const applyFilters = useCallback(
    (patch: Partial<ParcelFiltersState>) => {
      const next = { ...filters, ...patch };
      router.push(`${routes.bema.parcels()}?${parcelFiltersToQuery(next).toString()}`);
    },
    [filters, router],
  );

  // Filter state is serialised rather than passed by reference so the effect doesn't refetch
  // on every render of an equal-but-new object.
  const filterKey = parcelFiltersToQuery(filters).toString();
  const requestKey = `${filterKey}#${reloadToken}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    listParcels(parcelFiltersFromQuery(new URLSearchParams(filterKey)))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setLariRate(data.lariRate);
        setForcedReceivedBy(data.forcedReceivedBy);
        // A stale tick would apply the next operation to a parcel that is no longer listed.
        setSelectedIds(new Set());
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load parcels.');
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [filterKey, requestKey]);

  useEffect(() => {
    let cancelled = false;
    listUsers<{ id: string; firstName: string | null; lastName: string | null; username: string }>({
      accountType: 'BemaUser',
      page: 1,
      perPage: 500,
      sort: 'lastName',
      dir: 'asc',
      active: 'true',
    })
      .then((data) => {
        if (cancelled) return;
        setAdmins(
          data.items.map((a) => ({
            id: a.id,
            name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.username,
          })),
        );
      })
      .catch(() => {
        // A missing admin list only degrades two optional dropdowns; the list itself is fine.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupParcels(items), [items]);
  const debtTotal = useMemo(() => selectionDebt(items, selectedIds), [items, selectedIds]);

  const toggleParcel = useCallback((parcelId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(parcelId);
      else next.delete(parcelId);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((parcelIds: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of parcelIds) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  /** Runs one write, then reports what it did and reloads — the single place every mutation
   *  on this screen funnels through, so none of them can forget to refresh the list. */
  const runWrite = useCallback(async (label: string, action: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      setNotice(message || `${label} completed.`);
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }, []);

  function handleOperation(request: OperationRequest) {
    const parcelIds = [...selectedIds];
    void runWrite('Operation', async () => {
      const result = await runParcelOperation({ ...request, parcelIds });
      const skipped = result.skipped.length ? `, ${result.skipped.length} skipped` : '';
      return `${result.operation}: ${result.affected} parcel(s) updated${skipped}.`;
    });
  }

  function handleGroupPay(parcelIds: string[], payMethod: string) {
    if (!window.confirm('Are you sure you want to complete this operation?')) return;
    void runWrite('Group pay', async () => {
      const result = await runParcelOperation({ operation: 'paid', parcelIds, payMethod1: payMethod });
      return `Group pay: ${result.affected} parcel(s) paid.`;
    });
  }

  function handleDelete(parcelId: string) {
    if (!window.confirm('Are you sure you want to delete this parcel?')) return;
    void runWrite('Delete', async () => {
      await deleteParcel(parcelId);
      return 'Parcel deleted.';
    });
  }

  function handleConfirmHold(parcelId: string) {
    void runWrite('Confirm', async () => {
      await clearParcelHold(parcelId);
      return 'Hold cleared.';
    });
  }

  return (
    <div>
      <div className={s.heading}>
        <h1 className={s.title}>{deliveryRequest ? 'Delivery Requests' : 'Browse Parcels'}</h1>
        <span className={s.total}>{total} parcel(s)</span>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* The server scopes an otherwise-unfiltered list to the current admin's own received
          parcels (and always does so for an agent) — legacy did the same silently, which is
          exactly why an operator could not tell why the list looked short. */}
      {forcedReceivedBy && (
        <Alert variant="success">
          Showing parcels you received.{' '}
          {!isAgent && (
            <button type="button" className={s.linkButton} onClick={() => applyFilters({ allReceivers: '1', page: 1 })}>
              Show parcels received by everyone.
            </button>
          )}
        </Alert>
      )}

      {/* Keyed on the applied filters so each form remounts with a fresh draft when they
          change from outside it — prefixed per form, since sibling keys must be unique. */}
      <ParcelFilters
        key={`main-${filterKey}`}
        filters={filters}
        onApply={applyFilters}
        exportHref={parcelsExportUrl(filters)}
        canExport={!isAgent}
      />

      {canOperate && <ParcelExtraFilters key={filterKey} filters={filters} onApply={applyFilters} admins={admins} />}

      <div className={s.toolbar}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => applyFilters({ ...EMPTY_PARCEL_FILTERS, deliveryRequest: filters.deliveryRequest })}
        >
          Clear filters
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            toggleGroup(
              items.map((item) => item.id),
              !allSelected,
            )
          }
          disabled={items.length === 0}
        >
          {allSelected ? 'Deselect all' : `Select all ${items.length} on this page`}
        </Button>
      </div>

      {canOperate && (
        <ParcelOperationsBar
          selectedCount={selectedIds.size}
          selectionDebt={debtTotal}
          lariRate={lariRate}
          adminCountry={user?.billingAddress?.country ?? null}
          admins={admins}
          deliveryRequest={deliveryRequest}
          busy={busy}
          onRun={handleOperation}
        />
      )}

      {loading && <p className={s.empty}>Loading…</p>}
      {!loading && groups.length === 0 && (
        <p className={s.empty}>There are no parcels that match your search criteria.</p>
      )}

      {groups.map((group) => (
        <ParcelGroupCard
          key={group.key}
          group={group}
          selectedIds={selectedIds}
          onToggleParcel={toggleParcel}
          onToggleGroup={toggleGroup}
          onDeleteParcel={handleDelete}
          onConfirmHold={handleConfirmHold}
          onGroupPay={handleGroupPay}
          lariRate={lariRate}
          adminCountry={user?.billingAddress?.country ?? null}
          canOperate={canOperate}
          showBuser={deliveryRequest}
        />
      ))}

      <Pagination
        page={filters.page}
        perPage={filters.perPage}
        total={total}
        onPageChange={(page) => applyFilters({ page })}
      />
    </div>
  );
}
